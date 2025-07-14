import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withDatabase } from "../database";
import { z } from "zod";
import type { ProjectOverview, Project, Task, Documentation } from "../types/taskmaster.js";
import { convertProjectRow, convertTaskRow, convertDocumentationRow } from "../database/models.js";

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
const OVERVIEW_VIEWERS = new Set<string>(['coleam00']); // All authenticated users can view

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

function canViewOverview(username: string): boolean {
  return OVERVIEW_VIEWERS.has(username);
}

async function calculateProjectHealth(db: any, projectId: string): Promise<{
  health_score: number;
  health_status: 'excellent' | 'good' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
}> {
  // Get project statistics
  const [stats] = await db`
    SELECT 
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
      COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_tasks,
      COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue_tasks,
      COUNT(CASE WHEN assigned_to IS NULL AND status != 'completed' THEN 1 END) as unassigned_tasks
    FROM tasks 
    WHERE project_id = ${projectId}
  `;
  
  const totalTasks = parseInt(stats.total_tasks);
  const completedTasks = parseInt(stats.completed_tasks);
  const blockedTasks = parseInt(stats.blocked_tasks);
  const overdueTasks = parseInt(stats.overdue_tasks);
  const unassignedTasks = parseInt(stats.unassigned_tasks);
  
  let healthScore = 100;
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (totalTasks === 0) {
    healthScore = 50;
    issues.push("No tasks defined for the project");
    recommendations.push("Create initial project tasks to begin tracking progress");
  } else {
    // Completion rate impact
    const completionRate = completedTasks / totalTasks;
    if (completionRate < 0.3) {
      healthScore -= 20;
      issues.push(`Low completion rate: ${Math.round(completionRate * 100)}%`);
      recommendations.push("Focus on completing existing tasks before adding new ones");
    }
    
    // Blocked tasks impact
    const blockedRate = blockedTasks / totalTasks;
    if (blockedRate > 0.2) {
      healthScore -= 25;
      issues.push(`High blocked task rate: ${Math.round(blockedRate * 100)}%`);
      recommendations.push("Address blockers to unblock task progress");
    }
    
    // Overdue tasks impact
    const overdueRate = overdueTasks / totalTasks;
    if (overdueRate > 0.1) {
      healthScore -= 30;
      issues.push(`Overdue tasks: ${overdueTasks} (${Math.round(overdueRate * 100)}%)`);
      recommendations.push("Review and update task deadlines, consider resource reallocation");
    }
    
    // Unassigned tasks impact
    const unassignedRate = unassignedTasks / totalTasks;
    if (unassignedRate > 0.3) {
      healthScore -= 15;
      issues.push(`Many unassigned tasks: ${unassignedTasks} (${Math.round(unassignedRate * 100)}%)`);
      recommendations.push("Assign tasks to team members to clarify ownership");
    }
  }
  
  // Determine health status
  let healthStatus: 'excellent' | 'good' | 'warning' | 'critical';
  if (healthScore >= 90) healthStatus = 'excellent';
  else if (healthScore >= 70) healthStatus = 'good';
  else if (healthScore >= 50) healthStatus = 'warning';
  else healthStatus = 'critical';
  
  return {
    health_score: Math.max(0, healthScore),
    health_status: healthStatus,
    issues,
    recommendations,
  };
}

async function getProjectTimeline(db: any, projectId: string, limit: number): Promise<any[]> {
  // Get recent activity from audit logs
  const auditEntries = await db`
    SELECT 
      al.*,
      CASE 
        WHEN al.table_name = 'tasks' THEN (
          SELECT title FROM tasks WHERE id = al.record_id::uuid
        )
        WHEN al.table_name = 'documentation' THEN (
          SELECT title FROM documentation WHERE id = al.record_id::uuid
        )
        ELSE NULL
      END as record_title
    FROM audit_logs al
    WHERE al.table_name IN ('tasks', 'documentation', 'projects')
    AND (
      al.table_name = 'projects' AND al.record_id = ${projectId}
      OR al.table_name IN ('tasks', 'documentation') AND EXISTS (
        SELECT 1 FROM tasks t WHERE t.id = al.record_id::uuid AND t.project_id = ${projectId}
        UNION
        SELECT 1 FROM documentation d WHERE d.id = al.record_id::uuid AND d.project_id = ${projectId}
      )
    )
    ORDER BY al.changed_at DESC
    LIMIT ${limit}
  `;
  
  return auditEntries.map((entry: any) => ({
    timestamp: entry.changed_at,
    action: entry.action,
    table: entry.table_name,
    record_id: entry.record_id,
    record_title: entry.record_title,
    changed_by: entry.changed_by,
    summary: generateActivitySummary(entry.action, entry.table_name, entry.record_title, entry.changed_by)
  }));
}

function generateActivitySummary(action: string, table: string, title: string, changedBy: string): string {
  const actionMap: Record<string, string> = {
    insert: 'created',
    update: 'updated',
    delete: 'deleted'
  };
  
  const tableMap: Record<string, string> = {
    tasks: 'task',
    documentation: 'documentation',
    projects: 'project'
  };
  
  return `${changedBy} ${actionMap[action] || action} ${tableMap[table] || table}${title ? `: ${title}` : ''}`;
}

export function registerProjectOverviewTools(server: McpServer, env: Env, props: Props) {
  
  // Tool 1: Get Project Overview
  if (canViewOverview(props.login)) {
    server.tool(
      "getProjectOverview",
      "Get comprehensive project overview including statistics, recent activity, and health metrics",
      {
        project_id: z.string().uuid(),
      },
      async ({ project_id }) => {
        try {
          console.log(`Project overview requested by ${props.login} for project ${project_id}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Get project information
            const [projectRow] = await db`
              SELECT * FROM projects WHERE id = ${project_id}
            `;
            
            if (!projectRow) {
              return createErrorResponse("Project not found", { project_id });
            }
            
            const project = convertProjectRow(projectRow);
            
            // Get task statistics
            const [taskStats] = await db`
              SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
                COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_tasks,
                COALESCE(SUM(estimated_hours), 0) as total_estimated_hours,
                COALESCE(SUM(actual_hours), 0) as total_actual_hours,
                CASE 
                  WHEN COUNT(*) > 0 THEN 
                    ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 2)
                  ELSE 0 
                END as completion_percentage
              FROM tasks 
              WHERE project_id = ${project_id}
            `;
            
            // Get recent tasks
            const recentTasks = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${project_id} 
              ORDER BY updated_at DESC 
              LIMIT 10
            `;
            
            // Get recent documentation
            const recentDocs = await db`
              SELECT * FROM documentation 
              WHERE project_id = ${project_id} 
              ORDER BY updated_at DESC 
              LIMIT 5
            `;
            
            // Get upcoming deadlines
            const upcomingDeadlines = await db`
              SELECT * FROM tasks 
              WHERE project_id = ${project_id} 
              AND due_date IS NOT NULL 
              AND due_date >= CURRENT_DATE 
              AND due_date <= CURRENT_DATE + INTERVAL '30 days'
              AND status != 'completed'
              ORDER BY due_date ASC
              LIMIT 10
            `;
            
            // Get project tags
            const projectTags = await db`
              SELECT DISTINCT t.id, t.name, t.color, t.created_by, t.created_at, COUNT(tt.task_id) as usage_count
              FROM tags t
              JOIN task_tags tt ON t.id = tt.tag_id
              JOIN tasks task ON tt.task_id = task.id
              WHERE task.project_id = ${project_id}
              GROUP BY t.id, t.name, t.color, t.created_by, t.created_at
              ORDER BY usage_count DESC, t.name
            `;
            
            // Calculate project health
            const healthMetrics = await calculateProjectHealth(db, project_id);
            
            const projectOverview: ProjectOverview = {
              project,
              task_statistics: {
                total_tasks: parseInt(taskStats.total_tasks),
                completed_tasks: parseInt(taskStats.completed_tasks),
                in_progress_tasks: parseInt(taskStats.in_progress_tasks),
                pending_tasks: parseInt(taskStats.pending_tasks),
                blocked_tasks: parseInt(taskStats.blocked_tasks),
                completion_percentage: parseFloat(taskStats.completion_percentage),
              },
              recent_activity: {
                recent_tasks: recentTasks.map(convertTaskRow),
                recent_documentation: recentDocs.map(convertDocumentationRow),
              },
              tags: projectTags.map(tag => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                created_by: tag.created_by,
                created_at: tag.created_at,
                usage_count: parseInt(tag.usage_count)
              })),
              upcoming_deadlines: upcomingDeadlines.map(convertTaskRow),
            };
            
            return createSuccessResponse(
              `Project overview generated for: ${project.name}`,
              {
                overview: projectOverview,
                health_metrics: healthMetrics,
                effort_metrics: {
                  total_estimated_hours: parseFloat(taskStats.total_estimated_hours),
                  total_actual_hours: parseFloat(taskStats.total_actual_hours),
                  efficiency_ratio: taskStats.total_estimated_hours > 0 
                    ? parseFloat((parseFloat(taskStats.total_actual_hours) / parseFloat(taskStats.total_estimated_hours)).toFixed(2))
                    : null
                },
                insights: generateProjectInsights(projectOverview, healthMetrics)
              }
            );
          });
          
        } catch (error) {
          console.error('Project overview error:', error);
          return createErrorResponse(
            `Project overview failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, project_id }
          );
        }
      }
    );
  }

  // Tool 2: Get Project Analytics
  if (canViewOverview(props.login)) {
    server.tool(
      "getProjectAnalytics",
      "Get detailed project analytics including trend analysis and performance metrics",
      {
        project_id: z.string().uuid(),
        date_range_days: z.number().int().positive().max(365).default(30),
      },
      async ({ project_id, date_range_days }) => {
        try {
          console.log(`Project analytics requested by ${props.login} for project ${project_id}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - date_range_days);
            
            // Get task completion trend
            const completionTrend = await db`
              SELECT 
                DATE(updated_at) as date,
                COUNT(*) as tasks_completed
              FROM tasks
              WHERE project_id = ${project_id}
              AND status = 'completed'
              AND updated_at >= ${startDate}
              GROUP BY DATE(updated_at)
              ORDER BY date
            `;
            
            // Get task creation trend
            const creationTrend = await db`
              SELECT 
                DATE(created_at) as date,
                COUNT(*) as tasks_created
              FROM tasks
              WHERE project_id = ${project_id}
              AND created_at >= ${startDate}
              GROUP BY DATE(created_at)
              ORDER BY date
            `;
            
            // Get effort analysis
            const effortAnalysis = await db`
              SELECT 
                priority,
                COUNT(*) as task_count,
                AVG(COALESCE(estimated_hours, 0)) as avg_estimated_hours,
                AVG(COALESCE(actual_hours, 0)) as avg_actual_hours,
                AVG(CASE 
                  WHEN estimated_hours > 0 AND actual_hours > 0 
                  THEN actual_hours::float / estimated_hours::float 
                  ELSE NULL 
                END) as avg_effort_ratio
              FROM tasks
              WHERE project_id = ${project_id}
              GROUP BY priority
              ORDER BY 
                CASE priority 
                  WHEN 'urgent' THEN 1 
                  WHEN 'high' THEN 2 
                  WHEN 'medium' THEN 3 
                  WHEN 'low' THEN 4 
                END
            `;
            
            // Get team performance
            const teamPerformance = await db`
              SELECT 
                COALESCE(assigned_to, 'Unassigned') as assignee,
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                AVG(CASE 
                  WHEN status = 'completed' AND estimated_hours > 0 AND actual_hours > 0
                  THEN actual_hours::float / estimated_hours::float 
                  ELSE NULL 
                END) as avg_efficiency
              FROM tasks
              WHERE project_id = ${project_id}
              GROUP BY assigned_to
              ORDER BY completed_tasks DESC, total_tasks DESC
            `;
            
            return createSuccessResponse(
              `Analytics generated for project (${date_range_days} days)`,
              {
                date_range: {
                  start_date: startDate.toISOString().split('T')[0],
                  end_date: new Date().toISOString().split('T')[0],
                  days: date_range_days
                },
                completion_trend: completionTrend,
                creation_trend: creationTrend,
                effort_analysis: effortAnalysis.map(row => ({
                  priority: row.priority,
                  task_count: parseInt(row.task_count),
                  avg_estimated_hours: parseFloat(row.avg_estimated_hours || 0),
                  avg_actual_hours: parseFloat(row.avg_actual_hours || 0),
                  avg_effort_ratio: row.avg_effort_ratio ? parseFloat(row.avg_effort_ratio) : null
                })),
                team_performance: teamPerformance.map(row => ({
                  assignee: row.assignee,
                  total_tasks: parseInt(row.total_tasks),
                  completed_tasks: parseInt(row.completed_tasks),
                  completion_rate: parseInt(row.total_tasks) > 0 
                    ? Math.round((parseInt(row.completed_tasks) / parseInt(row.total_tasks)) * 100)
                    : 0,
                  avg_efficiency: row.avg_efficiency ? parseFloat(row.avg_efficiency) : null
                }))
              }
            );
          });
          
        } catch (error) {
          console.error('Project analytics error:', error);
          return createErrorResponse(
            `Project analytics failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, project_id }
          );
        }
      }
    );
  }

  // Tool 3: Get Project Timeline
  if (canViewOverview(props.login)) {
    server.tool(
      "getProjectTimeline",
      "Get chronological timeline of all project activities and changes",
      {
        project_id: z.string().uuid(),
        limit: z.number().int().positive().max(100).default(50),
      },
      async ({ project_id, limit }) => {
        try {
          console.log(`Project timeline requested by ${props.login} for project ${project_id}`);
          
          return await withDatabase(env.DATABASE_URL, async (db) => {
            // Verify project exists
            const [project] = await db`
              SELECT id, name FROM projects WHERE id = ${project_id}
            `;
            
            if (!project) {
              return createErrorResponse("Project not found", { project_id });
            }
            
            const timeline = await getProjectTimeline(db, project_id, limit);
            
            // Group activities by date for better presentation
            const timelineByDate = timeline.reduce((acc, activity) => {
              const date = activity.timestamp.toISOString().split('T')[0];
              if (!acc[date]) acc[date] = [];
              acc[date].push(activity);
              return acc;
            }, {} as Record<string, any[]>);
            
            return createSuccessResponse(
              `Timeline generated for project: ${project.name}`,
              {
                project: project,
                timeline: timeline,
                timeline_by_date: timelineByDate,
                total_activities: timeline.length,
                date_range: timeline.length > 0 ? {
                  earliest: timeline[timeline.length - 1].timestamp,
                  latest: timeline[0].timestamp
                } : null
              }
            );
          });
          
        } catch (error) {
          console.error('Project timeline error:', error);
          return createErrorResponse(
            `Project timeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { user: props.login, project_id }
          );
        }
      }
    );
  }
}

function generateProjectInsights(overview: ProjectOverview, health: any): string[] {
  const insights: string[] = [];
  
  const { task_statistics } = overview;
  
  // Completion insights
  if (task_statistics.completion_percentage >= 80) {
    insights.push("🎯 Project is nearing completion with excellent progress");
  } else if (task_statistics.completion_percentage >= 50) {
    insights.push("📈 Project is making good progress, keep up the momentum");
  } else if (task_statistics.completion_percentage < 25 && task_statistics.total_tasks > 5) {
    insights.push("🚨 Project completion rate is low, consider reviewing task priorities");
  }
  
  // Blocked tasks insights
  if (task_statistics.blocked_tasks > 0) {
    const blockedPercentage = (task_statistics.blocked_tasks / task_statistics.total_tasks) * 100;
    if (blockedPercentage > 20) {
      insights.push("🔒 High number of blocked tasks may be impacting project velocity");
    }
  }
  
  // Deadline insights
  if (overview.upcoming_deadlines.length > 5) {
    insights.push("⏰ Multiple upcoming deadlines require attention and planning");
  }
  
  // Health insights
  if (health.health_status === 'critical') {
    insights.push("⚠️ Project health is critical, immediate action recommended");
  } else if (health.health_status === 'excellent') {
    insights.push("✅ Project health is excellent, maintain current practices");
  }
  
  // Activity insights
  if (overview.recent_activity.recent_tasks.length === 0) {
    insights.push("💭 No recent task activity, consider checking project status");
  }
  
  return insights;
}