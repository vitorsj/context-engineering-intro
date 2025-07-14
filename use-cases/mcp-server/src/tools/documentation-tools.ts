import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withDatabase } from "../database";
import { z } from "zod";
import type { Documentation, Project } from "../types/taskmaster.js";
import { convertDocumentationRow, convertProjectRow } from "../database/models.js";

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
const DOC_MANAGERS = new Set<string>(['coleam00']); // Can modify any documentation
const DOC_VIEWERS = new Set<string>(['coleam00']); // All authenticated users can view

// Convert Zod schemas to simple object format for MCP tools

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

function canModifyDocumentation(username: string, doc?: Documentation): boolean {
  // Documentation managers can modify any documentation
  if (DOC_MANAGERS.has(username)) return true;
  
  // Document creators can modify their own documentation
  if (doc && doc.created_by === username) return true;
  
  return false;
}

function canViewDocumentation(username: string): boolean {
  return DOC_VIEWERS.has(username) || DOC_MANAGERS.has(username);
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

export function registerDocumentationTools(server: McpServer, env: Env, props: Props) {
  
  // Tool 1: Create Documentation
  if (DOC_MANAGERS.has(props.login)) {
    server.tool(
      "createDocumentation",
      "Create project documentation including goals, specifications, target users, and notes (privileged users only)",
      {
        project_id: z.string().uuid(),
        type: z.enum(['goals', 'why', 'target_users', 'specifications', 'notes']),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
      },
      async ({ project_id, type, title, content }) => {
        try {
          console.log(`Documentation creation initiated by ${props.login}: ${type} - ${title}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Verify project exists
            const [project] = await db`
              SELECT id, name FROM projects WHERE id = ${project_id}
            `;
            
            if (!project) {
              return createErrorResponse("Project not found", { project_id });
            }
            
            // Create documentation
            const [doc] = await db`
              INSERT INTO documentation (project_id, type, title, content, created_by)
              VALUES (${project_id}, ${type}, ${title}, ${content}, ${props.login})
              RETURNING *
            `;
            
            const convertedDoc = convertDocumentationRow(doc);
            
            // Log audit entry
            await logAuditEntry(db, 'documentation', doc.id, 'insert', props.login, null, convertedDoc);
            
            return createSuccessResponse(
              `Documentation created successfully: ${convertedDoc.title}`,
              {
                documentation: convertedDoc,
                project_name: project.name,
                created_by: props.name,
                next_steps: [
                  "Use `getDocumentation` to view all project documentation",
                  "Use `updateDocumentation` to modify content",
                  "Use `getProjectOverview` to see this in project context"
                ]
              }
            );
          });
          
        } catch (error) {
          console.error('Documentation creation error:', error);
          return createErrorResponse(
            `Documentation creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, title }
          );
        }
      }
    );
  }

  // Tool 2: Get Documentation (available to all authenticated users)
  if (canViewDocumentation(props.login)) {
    server.tool(
      "getDocumentation",
      "Retrieve project documentation with filtering by type and search capabilities",
      {
        project_id: z.string().uuid(),
        type: z.enum(['goals', 'why', 'target_users', 'specifications', 'notes']).optional(),
        limit: z.number().int().positive().max(50).default(20),
        offset: z.number().int().min(0).default(0),
      },
      async ({ project_id, type, limit, offset }) => {
        try {
          console.log(`Documentation retrieval by ${props.login} for project ${project_id}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Verify project exists
            const [project] = await db`
              SELECT id, name FROM projects WHERE id = ${project_id}
            `;
            
            if (!project) {
              return createErrorResponse("Project not found", { project_id });
            }
            
            // Get documentation with filters
            const docs = await db`
              SELECT * FROM documentation
              WHERE project_id = ${project_id}
              AND (${type || null}::text IS NULL OR type = ${type || null})
              ORDER BY type, created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `;
            
            const convertedDocs = docs.map(convertDocumentationRow);
            
            // Get total count
            const [countResult] = await db`
              SELECT COUNT(*) as total FROM documentation
              WHERE project_id = ${project_id}
              AND (${type || null}::text IS NULL OR type = ${type || null})
            `;
            
            const totalDocs = parseInt(countResult.total);
            const hasMore = offset + limit < totalDocs;
            
            // Group by type for better organization
            const docsByType = convertedDocs.reduce((acc, doc) => {
              if (!acc[doc.type]) acc[doc.type] = [];
              acc[doc.type].push(doc);
              return acc;
            }, {} as Record<string, Documentation[]>);
            
            return createSuccessResponse(
              `Found ${convertedDocs.length} documentation items for ${project.name}`,
              {
                project: project,
                documentation_by_type: docsByType,
                total_documents: totalDocs,
                pagination: {
                  limit,
                  offset,
                  has_more: hasMore,
                  next_offset: hasMore ? offset + limit : null
                },
                type_counts: Object.keys(docsByType).reduce((acc, type) => {
                  acc[type] = docsByType[type].length;
                  return acc;
                }, {} as Record<string, number>)
              }
            );
          });
          
        } catch (error) {
          console.error('Documentation retrieval error:', error);
          return createErrorResponse(
            `Documentation retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, project_id }
          );
        }
      }
    );
  }

  // Tool 3: Update Documentation
  server.tool(
    "updateDocumentation",
    "Update existing documentation content and metadata",
    {
      id: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      content: z.string().min(1).optional(),
    },
    async ({ id, title, content }) => {
      try {
        console.log(`Documentation update initiated by ${props.login}: ${id}`);
        
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Get existing documentation for permission check
          const [existingDoc] = await db`
            SELECT * FROM documentation WHERE id = ${id}
          `;
          
          if (!existingDoc) {
            return createErrorResponse("Documentation not found", { documentation_id: id });
          }
          
          const convertedExistingDoc = convertDocumentationRow(existingDoc);
          
          // Check permissions
          if (!canModifyDocumentation(props.login, convertedExistingDoc)) {
            return createErrorResponse(
              "Insufficient permissions to modify this documentation",
              { 
                documentation_id: id,
                required_permissions: "documentation manager or document creator"
              }
            );
          }
          
          // Build update fields
          const updateFields: any = {};
          if (title !== undefined) updateFields.title = title;
          if (content !== undefined) updateFields.content = content;
          
          if (Object.keys(updateFields).length === 0) {
            return createErrorResponse("No fields to update provided");
          }
          
          // Update with version increment
          updateFields.version = existingDoc.version + 1;
          updateFields.updated_at = new Date();
          
          const [updatedDoc] = await db`
            UPDATE documentation SET ${db(updateFields)} WHERE id = ${id}
            RETURNING *
          `;
          
          const convertedDoc = convertDocumentationRow(updatedDoc);
          
          // Log audit entry
          await logAuditEntry(db, 'documentation', id, 'update', props.login, convertedExistingDoc, convertedDoc);
          
          return createSuccessResponse(
            `Documentation updated successfully: ${convertedDoc.title}`,
            {
              documentation: convertedDoc,
              version_incremented: true,
              updated_by: props.name,
              changes_made: Object.keys(updateFields).filter(key => key !== 'version' && key !== 'updated_at')
            }
          );
        });
        
      } catch (error) {
        console.error('Documentation update error:', error);
        return createErrorResponse(
          `Documentation update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { user: props.login, documentation_id: id }
        );
      }
    }
  );

  // Tool 4: Search Documentation
  if (canViewDocumentation(props.login)) {
    server.tool(
      "searchDocumentation",
      "Search documentation content across projects with full-text search capabilities",
      {
        query: z.string().min(1).max(255),
        project_id: z.string().uuid().optional(),
        type: z.enum(['goals', 'why', 'target_users', 'specifications', 'notes']).optional(),
        limit: z.number().int().positive().max(50).default(20),
      },
      async ({ query, project_id, type, limit }) => {
        try {
          console.log(`Documentation search by ${props.login}: "${query}"`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Search documentation using ILIKE for basic text search
            const searchResults = await db`
              SELECT d.*, p.name as project_name
              FROM documentation d
              JOIN projects p ON d.project_id = p.id
              WHERE (d.title ILIKE ${'%' + query + '%'} OR d.content ILIKE ${'%' + query + '%'})
              AND (${project_id || null}::uuid IS NULL OR d.project_id = ${project_id || null})
              AND (${type || null}::text IS NULL OR d.type = ${type || null})
              ORDER BY 
                CASE 
                  WHEN d.title ILIKE ${'%' + query + '%'} THEN 1 
                  ELSE 2 
                END,
                d.updated_at DESC
              LIMIT ${limit}
            `;
            
            const results = searchResults.map(row => {
              const doc = convertDocumentationRow(row);
              return {
                ...doc,
                project_name: row.project_name,
                relevance_score: calculateRelevanceScore(query, doc.title, doc.content)
              };
            });
            
            // Get total count for the search
            const [countResult] = await db`
              SELECT COUNT(*) as total
              FROM documentation d
              WHERE (d.title ILIKE ${'%' + query + '%'} OR d.content ILIKE ${'%' + query + '%'})
              AND (${project_id || null}::uuid IS NULL OR d.project_id = ${project_id || null})
              AND (${type || null}::text IS NULL OR d.type = ${type || null})
            `;
            
            const totalResults = parseInt(countResult.total);
            
            return createSuccessResponse(
              `Found ${results.length} documentation items matching "${query}"`,
              {
                search_query: query,
                results: results,
                total_matches: totalResults,
                search_filters: {
                  project_id,
                  type
                },
                search_tips: totalResults === 0 ? [
                  "Try broader search terms",
                  "Check spelling",
                  "Search without filters to see all matches"
                ] : []
              }
            );
          });
          
        } catch (error) {
          console.error('Documentation search error:', error);
          return createErrorResponse(
            `Documentation search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, query }
          );
        }
      }
    );
  }

  // Tool 5: Delete Documentation (privileged users only)
  if (DOC_MANAGERS.has(props.login)) {
    server.tool(
      "deleteDocumentation",
      "Delete documentation and all its history (privileged users only)",
      {
        id: z.string().uuid(),
      },
      async ({ id }) => {
        try {
          console.log(`Documentation deletion initiated by ${props.login}: ${id}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get documentation before deletion for audit log
            const [existingDoc] = await db`
              SELECT * FROM documentation WHERE id = ${id}
            `;
            
            if (!existingDoc) {
              return createErrorResponse("Documentation not found", { documentation_id: id });
            }
            
            const convertedDoc = convertDocumentationRow(existingDoc);
            
            // Delete in transaction
            await db.begin(async (tx: any) => {
              // Log audit entry before deletion
              await logAuditEntry(tx, 'documentation', id, 'delete', props.login, convertedDoc, null);
              
              // Delete documentation
              await tx`DELETE FROM documentation WHERE id = ${id}`;
            });
            
            return createSuccessResponse(
              `Documentation deleted successfully: ${convertedDoc.title}`,
              {
                deleted_documentation: {
                  id: convertedDoc.id,
                  title: convertedDoc.title,
                  type: convertedDoc.type,
                  project_id: convertedDoc.project_id
                },
                deleted_by: props.name
              }
            );
          });
          
        } catch (error) {
          console.error('Documentation deletion error:', error);
          return createErrorResponse(
            `Documentation deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, documentation_id: id }
          );
        }
      }
    );
  }

  // Tool 6: List Projects (available to all authenticated users)
  if (canViewDocumentation(props.login)) {
    server.tool(
      "listProjects",
      "List all projects with basic information and documentation counts",
      {
        limit: z.number().int().positive().max(50).default(20),
        offset: z.number().int().min(0).default(0),
      },
      async ({ limit, offset }) => {
        try {
          console.log(`Project listing requested by ${props.login}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get projects with task and documentation counts
            const projects = await db`
              SELECT 
                p.*,
                COUNT(DISTINCT t.id) as task_count,
                COUNT(DISTINCT d.id) as documentation_count,
                COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks
              FROM projects p
              LEFT JOIN tasks t ON p.id = t.project_id
              LEFT JOIN documentation d ON p.id = d.project_id
              GROUP BY p.id
              ORDER BY p.created_at DESC
              LIMIT ${limit} OFFSET ${offset}
            `;
            
            const projectsWithStats = projects.map(row => {
              const project = convertProjectRow(row);
              return {
                ...project,
                stats: {
                  task_count: parseInt(row.task_count),
                  documentation_count: parseInt(row.documentation_count),
                  completed_tasks: parseInt(row.completed_tasks),
                  completion_percentage: row.task_count > 0 
                    ? Math.round((parseInt(row.completed_tasks) / parseInt(row.task_count)) * 100)
                    : 0
                }
              };
            });
            
            // Get total count
            const [countResult] = await db`SELECT COUNT(*) as total FROM projects`;
            const totalProjects = parseInt(countResult.total);
            const hasMore = offset + limit < totalProjects;
            
            return createSuccessResponse(
              `Found ${projectsWithStats.length} projects`,
              {
                projects: projectsWithStats,
                pagination: {
                  total: totalProjects,
                  limit,
                  offset,
                  has_more: hasMore,
                  next_offset: hasMore ? offset + limit : null
                }
              }
            );
          });
          
        } catch (error) {
          console.error('Project listing error:', error);
          return createErrorResponse(
            `Project listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login }
          );
        }
      }
    );
  }
}

// Helper function to calculate search relevance
function calculateRelevanceScore(query: string, title: string, content: string): number {
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  
  let score = 0;
  
  // Title matches are weighted higher
  if (titleLower.includes(queryLower)) {
    score += 10;
  }
  
  // Content matches
  const contentMatches = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
  score += contentMatches;
  
  // Exact title match gets bonus
  if (titleLower === queryLower) {
    score += 20;
  }
  
  return score;
}