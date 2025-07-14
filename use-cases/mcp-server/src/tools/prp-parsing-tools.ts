import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PRPParser } from "../llm/prp-parser.js";
import { withDatabase } from "../database";
import { ParsePRPSchema } from "../types/taskmaster.js";
import { z } from "zod";
import type { ParsedPRPData, Project, Task, Documentation } from "../types/taskmaster.js";
import { convertProjectRow, convertTaskRow, convertDocumentationRow } from "../database/models.js";

interface Props {
  login: string;
  name: string;
  email: string;
  accessToken: string;
}

interface Env {
  DATABASE_URL: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
}

const PRIVILEGED_USERS = new Set<string>(['coleam00']);

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

async function createProjectFromParsedData(
  db: any,
  parsedData: ParsedPRPData,
  projectName: string,
  createdBy: string
): Promise<Project> {
  const [project] = await db`
    INSERT INTO projects (name, description, goals, why_statement, target_users, created_by)
    VALUES (
      ${projectName},
      ${parsedData.project_info.description},
      ${parsedData.project_info.goals},
      ${parsedData.project_info.why_statement},
      ${parsedData.project_info.target_users},
      ${createdBy}
    )
    ON CONFLICT (name) DO UPDATE SET
      description = EXCLUDED.description,
      goals = EXCLUDED.goals,
      why_statement = EXCLUDED.why_statement,
      target_users = EXCLUDED.target_users,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  
  return convertProjectRow(project);
}

async function createTasksFromParsedData(
  db: any,
  projectId: string,
  parsedData: ParsedPRPData,
  createdBy: string
): Promise<Task[]> {
  const tasks: Task[] = [];
  
  // Create tasks in transaction for consistency
  await db.begin(async (tx: any) => {
    for (const taskData of parsedData.tasks) {
      const [task] = await tx`
        INSERT INTO tasks (
          project_id, title, description, priority, 
          estimated_hours, acceptance_criteria, created_by
        )
        VALUES (
          ${projectId}, ${taskData.title}, ${taskData.description}, 
          ${taskData.priority}, ${taskData.estimated_hours || null}, 
          ${taskData.acceptance_criteria || null}, ${createdBy}
        )
        RETURNING *
      `;
      
      const convertedTask = convertTaskRow(task);
      tasks.push(convertedTask);
      
      // Create tags and link them to tasks
      if (taskData.tags && taskData.tags.length > 0) {
        for (const tagName of taskData.tags) {
          await upsertTagAndLink(tx, task.id, tagName, createdBy);
        }
      }
    }
    
    // Create task dependencies after all tasks are created
    const taskNameToId = new Map(tasks.map(t => [t.title, t.id]));
    
    for (let i = 0; i < parsedData.tasks.length; i++) {
      const taskData = parsedData.tasks[i];
      const task = tasks[i];
      
      if (taskData.dependencies && taskData.dependencies.length > 0) {
        for (const depName of taskData.dependencies) {
          const depTaskId = taskNameToId.get(depName);
          if (depTaskId) {
            await tx`
              INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
              VALUES (${task.id}, ${depTaskId}, 'blocks')
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
    }
  });
  
  return tasks;
}

async function createDocumentationFromParsedData(
  db: any,
  projectId: string,
  parsedData: ParsedPRPData,
  createdBy: string
): Promise<Documentation[]> {
  const documentation: Documentation[] = [];
  
  for (const docData of parsedData.documentation) {
    const [doc] = await db`
      INSERT INTO documentation (project_id, type, title, content, created_by)
      VALUES (${projectId}, ${docData.type}, ${docData.title}, ${docData.content}, ${createdBy})
      RETURNING *
    `;
    
    documentation.push(convertDocumentationRow(doc));
  }
  
  return documentation;
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

export function registerPRPParsingTools(server: McpServer, env: Env, props: Props) {
  // Tool 1: Parse PRP Content
  server.tool(
    "parsePRP",
    "Parse a Product Requirement Prompt (PRP) to extract tasks, goals, and documentation using AI",
    {
      prp_content: z.string().min(10).max(100000),
      project_name: z.string().min(1).max(255).optional(),
      project_context: z.string().optional(),
      auto_create_tasks: z.boolean().default(false),
    },
    async ({ prp_content, project_name, project_context, auto_create_tasks }) => {
      try {
        console.log(`PRP parsing initiated by ${props.login}`);
        
        // Initialize PRP parser
        const parser = new PRPParser(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
        
        // Parse PRP with options
        const parsingResult = await parser.parsePRP(prp_content, {
          project_context,
          auto_validate: true,
          include_validation_report: true,
        });
        
        const { parsed_data, validation_report, metrics } = parsingResult;
        
        // Use provided project name or extracted name
        const finalProjectName = project_name || parsed_data.project_info.name;
        
        if (auto_create_tasks && PRIVILEGED_USERS.has(props.login)) {
          // Auto-create project and tasks in database
          return await withDatabase(env.DATABASE_URL, async (db) => {
            const project = await createProjectFromParsedData(db, parsed_data, finalProjectName, props.login);
            const tasks = await createTasksFromParsedData(db, project.id, parsed_data, props.login);
            const documentation = await createDocumentationFromParsedData(db, project.id, parsed_data, props.login);
            
            return createSuccessResponse(
              `PRP parsed and project created successfully!`,
              {
                project: project.name,
                tasks_created: tasks.length,
                documentation_created: documentation.length,
                metrics,
                validation_report,
                next_steps: [
                  "Use `listTasks` to view all created tasks",
                  "Use `updateTask` to modify task details",
                  "Use `getProjectOverview` for comprehensive project status"
                ]
              }
            );
          });
        } else {
          // Return parsed data without creating in database
          return createSuccessResponse(
            "PRP parsed successfully! Use auto_create_tasks=true to save to database (privileged users only).",
            {
              project_info: parsed_data.project_info,
              task_count: parsed_data.tasks.length,
              documentation_count: parsed_data.documentation.length,
              suggested_tags: parsed_data.suggested_tags,
              metrics,
              validation_report,
              parsed_tasks: parsed_data.tasks.map(t => ({
                title: t.title,
                description: t.description.substring(0, 100) + "...",
                priority: t.priority,
                estimated_hours: t.estimated_hours
              }))
            }
          );
        }
        
      } catch (error) {
        console.error('PRP parsing error:', error);
        return createErrorResponse(
          `PRP parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { user: props.login, error_type: 'parsing_error' }
        );
      }
    }
  );

  // Tool 2: Validate PRP Format
  server.tool(
    "validatePRP",
    "Validate PRP content format and provide feedback on structure and completeness",
    {
      prp_content: z.string().min(10).max(100000),
    },
    async ({ prp_content }) => {
      try {
        console.log(`PRP validation initiated by ${props.login}`);
        
        // Basic validation checks
        const validationIssues: string[] = [];
        const suggestions: string[] = [];
        
        // Length checks
        if (prp_content.length < 100) {
          validationIssues.push("PRP content is very short and may not contain enough detail");
        }
        if (prp_content.length > 50000) {
          validationIssues.push("PRP content is very long and may be difficult to parse effectively");
        }
        
        // Structure checks
        const hasGoals = /goal|objective|aim/i.test(prp_content);
        const hasWhy = /why|purpose|reason|motivation|value/i.test(prp_content);
        const hasUsers = /user|customer|audience|persona/i.test(prp_content);
        const hasTasks = /task|step|implement|build|create|develop/i.test(prp_content);
        
        if (!hasGoals) suggestions.push("Consider adding explicit goals or objectives");
        if (!hasWhy) suggestions.push("Consider explaining why this project is valuable");
        if (!hasUsers) suggestions.push("Consider describing target users or audiences");
        if (!hasTasks) suggestions.push("Consider including more specific implementation tasks");
        
        // Calculate completeness score
        const completenessFactors = [hasGoals, hasWhy, hasUsers, hasTasks];
        const completenessScore = (completenessFactors.filter(Boolean).length / completenessFactors.length) * 100;
        
        return createSuccessResponse(
          "PRP validation completed",
          {
            is_valid: validationIssues.length === 0,
            completeness_score: Math.round(completenessScore),
            character_count: prp_content.length,
            word_count: prp_content.split(/\s+/).length,
            validation_issues: validationIssues,
            suggestions: suggestions,
            structure_analysis: {
              has_goals: hasGoals,
              has_why_statement: hasWhy,
              has_target_users: hasUsers,
              has_actionable_tasks: hasTasks,
            }
          }
        );
        
      } catch (error) {
        console.error('PRP validation error:', error);
        return createErrorResponse(
          `PRP validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { user: props.login }
        );
      }
    }
  );

  // Tool 3: Get Parsing Metrics
  if (PRIVILEGED_USERS.has(props.login)) {
    server.tool(
      "getPRPParsingMetrics",
      "Get API usage metrics for PRP parsing operations (privileged users only)",
      {},
      async () => {
        try {
          const parser = new PRPParser(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
          const metrics = parser.getClientMetrics();
          
          return createSuccessResponse(
            "PRP parsing metrics retrieved",
            {
              anthropic_api_metrics: metrics,
              cost_estimation: {
                input_tokens: metrics.total_input_tokens,
                output_tokens: metrics.total_output_tokens,
                estimated_cost_usd: (metrics.total_input_tokens * 0.003 + metrics.total_output_tokens * 0.015) / 1000
              }
            }
          );
          
        } catch (error) {
          console.error('Metrics retrieval error:', error);
          return createErrorResponse(
            `Failed to retrieve metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login }
          );
        }
      }
    );
  }
}