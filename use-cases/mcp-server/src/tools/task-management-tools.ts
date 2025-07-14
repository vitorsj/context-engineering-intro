import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withDatabase, validateSqlQuery, isWriteOperation } from "../database";
import { z } from "zod";
import type { Task, TaskWithRelations, Tag, TaskDependency } from "../types/taskmaster.js";
import {
  convertTaskRow,
  convertTagRow,
  convertTaskDependencyRow,
  SQL_QUERIES,
} from "../database/models.js";

interface Props {
  login: string;
  name: string;
  email: string;
  accessToken: string;
}

interface Env {
  DATABASE_URL: string;
}

// Permission configuration
const TASK_MANAGERS = new Set<string>(['coleam00']); // Can modify any task
const TASK_VIEWERS = new Set<string>(['coleam00']); // All authenticated users can view

function createErrorResponse(message: string, details?: any): any {
  return {
    content: [{
      type: "text",
      text: `**Error**\n\n${message}${details ? `\n\n**Details:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\`` : ''}`,
      isError: true
    }]
  };
}

function createSuccessResponse(message: string, data?: any): any {
  return {
    content: [{
      type: "text",
      text: `**Success**\n\n${message}${data ? `\n\n**Data:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` : ''}`
    }]
  };
}

function canModifyTask(username: string, task?: Task): boolean {
  // Task managers can modify any task
  if (TASK_MANAGERS.has(username)) return true;
  
  // Task creators can modify their own tasks
  if (task && task.created_by === username) return true;
  
  // Assigned users can modify their assigned tasks
  if (task && task.assigned_to === username) return true;
  
  return false;
}

function canViewTasks(username: string): boolean {
  return TASK_VIEWERS.has(username) || TASK_MANAGERS.has(username);
}

async function getTaskWithRelations(db: any, taskId: string): Promise<TaskWithRelations | null> {
  const [taskRow] = await db`
    SELECT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ${taskId}
  `;
  
  if (!taskRow) return null;
  
  const task = convertTaskRow(taskRow);
  
  // Get tags
  const tagRows = await db`
    SELECT tag.* FROM tags tag
    JOIN task_tags tt ON tag.id = tt.tag_id
    WHERE tt.task_id = ${taskId}
  `;
  const tags = tagRows.map(convertTagRow);
  
  // Get dependencies
  const depRows = await db`
    SELECT td.*, t.title as depends_on_title
    FROM task_dependencies td
    JOIN tasks t ON td.depends_on_task_id = t.id
    WHERE td.task_id = ${taskId}
  `;
  const dependencies = depRows.map(convertTaskDependencyRow);
  
  return {
    ...task,
    tags,
    dependencies,
  };
}

async function upsertTagAndLink(tx: any, taskId: string, tagName: string, createdBy: string): Promise<void> {
  // Insert or get existing tag
  const [tag] = await tx`
    INSERT INTO tags (name, created_by)
    VALUES (${tagName}, ${createdBy})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  
  // Link tag to task
  await tx`
    INSERT INTO task_tags (task_id, tag_id)
    VALUES (${taskId}, ${tag.id})
    ON CONFLICT DO NOTHING
  `;
}

async function logAuditEntry(
  db: any,
  tableName: string,
  recordId: string,
  action: 'insert' | 'update' | 'delete',
  changedBy: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  await db`
    INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (${tableName}, ${recordId}, ${action}, ${oldValues || null}, ${newValues || null}, ${changedBy})
  `;
}

export function registerTaskManagementTools(server: McpServer, env: Env, props: Props) {
  
  // Tool 1: Create Task
  if (TASK_MANAGERS.has(props.login)) {
    server.tool(
      "createTask",
      "Create a new task with metadata, tags, and validation (privileged users only)",
      {
        project_id: z.string().uuid(),
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
        assigned_to: z.string().optional(),
        parent_task_id: z.string().uuid().optional(),
        estimated_hours: z.number().int().positive().optional(),
        due_date: z.string().datetime().optional(),
        acceptance_criteria: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      },
      async ({ project_id, title, description, priority, assigned_to, parent_task_id, estimated_hours, due_date, acceptance_criteria, tags }) => {
        try {
          console.log(`Task creation initiated by ${props.login}: ${title}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Verify project exists
            const [project] = await db`
              SELECT id, name FROM projects WHERE id = ${project_id}
            `;
            
            if (!project) {
              return createErrorResponse("Project not found", { project_id });
            }
            
            // Verify parent task exists if specified
            if (parent_task_id) {
              const [parentTask] = await db`
                SELECT id FROM tasks WHERE id = ${parent_task_id}
              `;
              
              if (!parentTask) {
                return createErrorResponse("Parent task not found", { parent_task_id });
              }
            }
            
            // Create task in transaction
            const taskData = await db.begin(async (tx: any) => {
              // Insert task
              const [task] = await tx`
                INSERT INTO tasks (
                  project_id, title, description, priority, assigned_to,
                  parent_task_id, estimated_hours, due_date, acceptance_criteria, created_by
                )
                VALUES (
                  ${project_id}, ${title}, ${description || null}, ${priority},
                  ${assigned_to || null}, ${parent_task_id || null},
                  ${estimated_hours || null}, ${due_date ? new Date(due_date) : null},
                  ${acceptance_criteria || null}, ${props.login}
                )
                RETURNING *
              `;
              
              const convertedTask = convertTaskRow(task);
              
              // Add tags if provided
              if (tags && tags.length > 0) {
                for (const tagName of tags) {
                  await upsertTagAndLink(tx, task.id, tagName, props.login);
                }
              }
              
              // Log audit entry
              await logAuditEntry(tx, 'tasks', task.id, 'insert', props.login, null, convertedTask);
              
              return convertedTask;
            });
            
            return createSuccessResponse(
              `Task created successfully: ${taskData.title}`,
              {
                task: taskData,
                project_name: project.name,
                created_by: props.name,
                next_steps: [
                  "Use `updateTask` to modify task details",
                  "Use `getTask` to view full task information",
                  "Use `listTasks` to see all project tasks"
                ]
              }
            );
          });
          
        } catch (error) {
          console.error('Task creation error:', error);
          return createErrorResponse(
            `Task creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, task_title: title }
          );
        }
      }
    );
  }

  // Tool 2: List Tasks (available to all authenticated users)
  if (canViewTasks(props.login)) {
    server.tool(
      "listTasks",
      "List tasks with filtering options (status, priority, assigned user, tags, project)",
      {
        project_id: z.string().uuid().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assigned_to: z.string().optional(),
        tag: z.string().optional(),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      },
      async ({ project_id, status, priority, assigned_to, tag, limit, offset }) => {
        try {
          console.log(`Task listing requested by ${props.login}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Execute the complex query with filters
            const tasks = await db`
              SELECT DISTINCT t.*, p.name as project_name
              FROM tasks t
              LEFT JOIN projects p ON t.project_id = p.id
              LEFT JOIN task_tags tt ON t.id = tt.task_id
              LEFT JOIN tags tag ON tt.tag_id = tag.id
              WHERE (${project_id || null}::uuid IS NULL OR t.project_id = ${project_id || null})
              AND (${status || null}::text IS NULL OR t.status = ${status || null})
              AND (${priority || null}::text IS NULL OR t.priority = ${priority || null})
              AND (${assigned_to || null}::text IS NULL OR t.assigned_to = ${assigned_to || null})
              AND (${tag || null}::text IS NULL OR tag.name = ${tag || null})
              ORDER BY t.created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `;
            
            const convertedTasks = tasks.map(convertTaskRow);
            
            // Get total count for pagination
            const [countResult] = await db`
              SELECT COUNT(DISTINCT t.id) as total
              FROM tasks t
              LEFT JOIN task_tags tt ON t.id = tt.task_id
              LEFT JOIN tags tag ON tt.tag_id = tag.id
              WHERE (${project_id || null}::uuid IS NULL OR t.project_id = ${project_id || null})
              AND (${status || null}::text IS NULL OR t.status = ${status || null})
              AND (${priority || null}::text IS NULL OR t.priority = ${priority || null})
              AND (${assigned_to || null}::text IS NULL OR t.assigned_to = ${assigned_to || null})
              AND (${tag || null}::text IS NULL OR tag.name = ${tag || null})
            `;
            
            const totalTasks = parseInt(countResult.total);
            const hasMore = offset + limit < totalTasks;
            
            return createSuccessResponse(
              `Found ${convertedTasks.length} tasks`,
              {
                tasks: convertedTasks,
                pagination: {
                  total: totalTasks,
                  limit,
                  offset,
                  has_more: hasMore,
                  next_offset: hasMore ? offset + limit : null
                },
                filters_applied: {
                  project_id,
                  status,
                  priority,
                  assigned_to,
                  tag
                }
              }
            );
          });
          
        } catch (error) {
          console.error('Task listing error:', error);
          return createErrorResponse(
            `Task listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login }
          );
        }
      }
    );
  }

  // Tool 3: Get Task Details
  if (canViewTasks(props.login)) {
    server.tool(
      "getTask",
      "Get detailed information about a specific task including tags, dependencies, and related data",
      {
        id: z.string().uuid(),
      },
      async ({ id }) => {
        try {
          console.log(`Task details requested by ${props.login}: ${id}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            const taskWithRelations = await getTaskWithRelations(db, id);
            
            if (!taskWithRelations) {
              return createErrorResponse("Task not found", { task_id: id });
            }
            
            // Get subtasks if this is a parent task
            const subtasks = await db`
              SELECT id, title, status, priority, assigned_to
              FROM tasks
              WHERE parent_task_id = ${id}
              ORDER BY created_at ASC
            `;
            
            // Get tasks that depend on this task
            const dependentTasks = await db`
              SELECT t.id, t.title, t.status, td.dependency_type
              FROM task_dependencies td
              JOIN tasks t ON td.task_id = t.id
              WHERE td.depends_on_task_id = ${id}
              ORDER BY t.created_at ASC
            `;
            
            return createSuccessResponse(
              `Task details retrieved: ${taskWithRelations.title}`,
              {
                task: taskWithRelations,
                subtasks: subtasks.map(convertTaskRow),
                dependent_tasks: dependentTasks,
                permissions: {
                  can_modify: canModifyTask(props.login, taskWithRelations),
                  can_delete: TASK_MANAGERS.has(props.login),
                  can_assign: TASK_MANAGERS.has(props.login)
                }
              }
            );
          });
          
        } catch (error) {
          console.error('Task retrieval error:', error);
          return createErrorResponse(
            `Task retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, task_id: id }
          );
        }
      }
    );
  }

  // Tool 4: Update Task
  server.tool(
    "updateTask",
    "Update task details, status, priority, assignments, and metadata",
    {
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      assigned_to: z.string().optional(),
      parent_task_id: z.string().uuid().optional(),
      estimated_hours: z.number().int().positive().optional(),
      actual_hours: z.number().int().min(0).optional(),
      due_date: z.string().datetime().optional(),
      acceptance_criteria: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    },
    async (updateData) => {
      try {
        console.log(`Task update initiated by ${props.login}: ${updateData.id}`);
        
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Get existing task for permission check
          const existingTask = await getTaskWithRelations(db, updateData.id);
          
          if (!existingTask) {
            return createErrorResponse("Task not found", { task_id: updateData.id });
          }
          
          // Check permissions
          if (!canModifyTask(props.login, existingTask)) {
            return createErrorResponse(
              "Insufficient permissions to modify this task",
              { 
                task_id: updateData.id,
                required_permissions: "task manager, task creator, or assigned user"
              }
            );
          }
          
          // Update task in transaction
          const updatedTask = await db.begin(async (tx: any) => {
            // Build dynamic update query
            const updateFields: any = { updated_at: new Date() };
            if (updateData.title !== undefined) updateFields.title = updateData.title;
            if (updateData.description !== undefined) updateFields.description = updateData.description;
            if (updateData.status !== undefined) updateFields.status = updateData.status;
            if (updateData.priority !== undefined) updateFields.priority = updateData.priority;
            if (updateData.assigned_to !== undefined) updateFields.assigned_to = updateData.assigned_to;
            if (updateData.parent_task_id !== undefined) updateFields.parent_task_id = updateData.parent_task_id;
            if (updateData.estimated_hours !== undefined) updateFields.estimated_hours = updateData.estimated_hours;
            if (updateData.actual_hours !== undefined) updateFields.actual_hours = updateData.actual_hours;
            if (updateData.due_date !== undefined) updateFields.due_date = updateData.due_date ? new Date(updateData.due_date) : null;
            if (updateData.acceptance_criteria !== undefined) updateFields.acceptance_criteria = updateData.acceptance_criteria;
            
            // Only update if there are fields to update besides updated_at
            if (Object.keys(updateFields).length > 1) {
              const [task] = await tx`
                UPDATE tasks SET ${tx(updateFields)} WHERE id = ${updateData.id}
                RETURNING *
              `;
              
              // Handle tags update
              if (updateData.tags !== undefined) {
                // Remove existing tags
                await tx`DELETE FROM task_tags WHERE task_id = ${updateData.id}`;
                
                // Add new tags
                if (updateData.tags.length > 0) {
                  for (const tagName of updateData.tags) {
                    await upsertTagAndLink(tx, updateData.id, tagName, props.login);
                  }
                }
              }
              
              // Log audit entry
              await logAuditEntry(tx, 'tasks', updateData.id, 'update', props.login, existingTask, convertTaskRow(task));
              
              return convertTaskRow(task);
            }
            
            return existingTask;
          });
          
          return createSuccessResponse(
            `Task updated successfully: ${updatedTask.title}`,
            {
              task: updatedTask,
              updated_by: props.name,
              changes_made: Object.keys(updateData).filter(key => (updateData as any)[key] !== undefined)
            }
          );
        });
        
      } catch (error) {
        console.error('Task update error:', error);
        return createErrorResponse(
          `Task update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { user: props.login, task_id: updateData.id }
        );
      }
    }
  );

  // Tool 5: Delete Task (privileged users only)
  if (TASK_MANAGERS.has(props.login)) {
    server.tool(
      "deleteTask",
      "Delete a task and all its relationships (privileged users only)",
      {
        id: z.string().uuid(),
      },
      async ({ id }) => {
        try {
          console.log(`Task deletion initiated by ${props.login}: ${id}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get task before deletion for audit log
            const existingTask = await getTaskWithRelations(db, id);
            
            if (!existingTask) {
              return createErrorResponse("Task not found", { task_id: id });
            }
            
            // Delete in transaction (cascading deletes will handle relationships)
            await db.begin(async (tx: any) => {
              // Log audit entry before deletion
              await logAuditEntry(tx, 'tasks', id, 'delete', props.login, existingTask, null);
              
              // Delete task (cascading deletes will handle tags, dependencies)
              await tx`DELETE FROM tasks WHERE id = ${id}`;
            });
            
            return createSuccessResponse(
              `Task deleted successfully: ${existingTask.title}`,
              {
                deleted_task: {
                  id: existingTask.id,
                  title: existingTask.title,
                  project_id: existingTask.project_id
                },
                deleted_by: props.name
              }
            );
          });
          
        } catch (error) {
          console.error('Task deletion error:', error);
          return createErrorResponse(
            `Task deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, task_id: id }
          );
        }
      }
    );
  }

  // Tool 6: Create Task Dependency
  if (TASK_MANAGERS.has(props.login)) {
    server.tool(
      "createTaskDependency",
      "Create a dependency relationship between two tasks (privileged users only)",
      {
        task_id: z.string().uuid(),
        depends_on_task_id: z.string().uuid(),
        dependency_type: z.enum(['blocks', 'related', 'subtask']).default('blocks'),
      },
      async ({ task_id, depends_on_task_id, dependency_type }) => {
        try {
          console.log(`Task dependency creation by ${props.login}: ${task_id} depends on ${depends_on_task_id}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Verify both tasks exist
            const [task] = await db`SELECT id, title FROM tasks WHERE id = ${task_id}`;
            const [dependsOnTask] = await db`SELECT id, title FROM tasks WHERE id = ${depends_on_task_id}`;
            
            if (!task) {
              return createErrorResponse("Task not found", { task_id });
            }
            
            if (!dependsOnTask) {
              return createErrorResponse("Dependency task not found", { depends_on_task_id });
            }
            
            // Check for circular dependencies
            const circularCheck = await db`
              WITH RECURSIVE dependency_chain AS (
                SELECT task_id, depends_on_task_id, 1 as depth
                FROM task_dependencies
                WHERE depends_on_task_id = ${task_id}
                
                UNION ALL
                
                SELECT td.task_id, td.depends_on_task_id, dc.depth + 1
                FROM task_dependencies td
                JOIN dependency_chain dc ON td.depends_on_task_id = dc.task_id
                WHERE dc.depth < 10
              )
              SELECT 1 FROM dependency_chain WHERE task_id = ${depends_on_task_id}
            `;
            
            if (circularCheck.length > 0) {
              return createErrorResponse(
                "Cannot create dependency: would create circular dependency",
                { task_id, depends_on_task_id }
              );
            }
            
            // Create dependency
            await db`
              INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
              VALUES (${task_id}, ${depends_on_task_id}, ${dependency_type})
              ON CONFLICT DO NOTHING
            `;
            
            return createSuccessResponse(
              `Task dependency created: "${task.title}" depends on "${dependsOnTask.title}"`,
              {
                dependency: {
                  task: { id: task.id, title: task.title },
                  depends_on: { id: dependsOnTask.id, title: dependsOnTask.title },
                  type: dependency_type
                },
                created_by: props.name
              }
            );
          });
          
        } catch (error) {
          console.error('Task dependency creation error:', error);
          return createErrorResponse(
            `Task dependency creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, task_id, depends_on_task_id }
          );
        }
      }
    );
  }
}