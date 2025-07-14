import { z } from "zod";
import type {
  Project,
  Task,
  Documentation,
  Tag,
  TaskTag,
  TaskDependency,
  AuditLog,
  TaskWithRelations,
  ProjectOverview,
} from "../types/taskmaster.js";

// Database row type converters
export function convertProjectRow(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    goals: row.goals || undefined,
    target_users: row.target_users || undefined,
    why_statement: row.why_statement || undefined,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export function convertTaskRow(row: any): Task {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    priority: row.priority,
    assigned_to: row.assigned_to || undefined,
    parent_task_id: row.parent_task_id || undefined,
    estimated_hours: row.estimated_hours || undefined,
    actual_hours: row.actual_hours || undefined,
    due_date: row.due_date ? new Date(row.due_date) : undefined,
    acceptance_criteria: row.acceptance_criteria || undefined,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export function convertDocumentationRow(row: any): Documentation {
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type,
    title: row.title,
    content: row.content,
    version: row.version,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export function convertTagRow(row: any): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color || undefined,
    description: row.description || undefined,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
  };
}

export function convertTaskDependencyRow(row: any): TaskDependency {
  return {
    task_id: row.task_id,
    depends_on_task_id: row.depends_on_task_id,
    dependency_type: row.dependency_type,
  };
}

export function convertAuditLogRow(row: any): AuditLog {
  return {
    id: row.id,
    table_name: row.table_name,
    record_id: row.record_id,
    action: row.action,
    old_values: row.old_values || undefined,
    new_values: row.new_values || undefined,
    changed_by: row.changed_by,
    changed_at: new Date(row.changed_at),
  };
}

// Database operation helpers
export interface TaskListFilters {
  project_id?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  assigned_to?: string;
  tag?: string;
  parent_task_id?: string;
  has_dependencies?: boolean;
  due_before?: Date;
  due_after?: Date;
  created_by?: string;
  limit?: number;
  offset?: number;
}

export interface DocumentationListFilters {
  project_id?: string;
  type?: Documentation['type'];
  created_by?: string;
  limit?: number;
  offset?: number;
}

export interface ProjectListFilters {
  created_by?: string;
  search_term?: string;
  limit?: number;
  offset?: number;
}

// Validation schemas for database operations
export const DatabaseTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.string().optional(),
  parent_task_id: z.string().uuid().optional(),
  estimated_hours: z.number().int().positive().optional(),
  actual_hours: z.number().int().min(0).optional(),
  due_date: z.date().optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  created_by: z.string().min(1),
});

export const DatabaseProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  goals: z.string().optional(),
  target_users: z.string().optional(),
  why_statement: z.string().optional(),
  created_by: z.string().min(1),
});

export const DatabaseDocumentationSchema = z.object({
  project_id: z.string().uuid(),
  type: z.enum(['goals', 'why', 'target_users', 'specifications', 'notes']),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  version: z.number().int().positive().default(1),
  created_by: z.string().min(1),
});

export const DatabaseTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().optional(),
  created_by: z.string().min(1),
});

// Query builders for complex operations
export interface TaskQueryBuilder {
  withTags?: boolean;
  withDependencies?: boolean;
  withProject?: boolean;
  withParentTask?: boolean;
  withSubtasks?: boolean;
}

export interface ProjectStatsQuery {
  include_task_counts?: boolean;
  include_recent_activity?: boolean;
  include_upcoming_deadlines?: boolean;
  recent_activity_limit?: number;
  upcoming_deadline_days?: number;
}

// Audit logging helpers
export interface AuditLogEntry {
  table_name: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changed_by: string;
}

export function createAuditLogEntry(
  tableName: string,
  recordId: string,
  action: AuditLogEntry['action'],
  changedBy: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>
): AuditLogEntry {
  return {
    table_name: tableName,
    record_id: recordId,
    action,
    old_values: oldValues,
    new_values: newValues,
    changed_by: changedBy,
  };
}

// SQL query templates
export const SQL_QUERIES = {
  // Project queries
  SELECT_PROJECT_BY_ID: `
    SELECT * FROM projects WHERE id = $1
  `,
  
  SELECT_PROJECT_BY_NAME: `
    SELECT * FROM projects WHERE name = $1
  `,
  
  LIST_PROJECTS: `
    SELECT * FROM projects 
    WHERE ($1::text IS NULL OR created_by = $1)
    AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR description ILIKE '%' || $2 || '%')
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4
  `,
  
  // Task queries
  SELECT_TASK_BY_ID: `
    SELECT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = $1
  `,
  
  LIST_TASKS_WITH_FILTERS: `
    SELECT DISTINCT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN task_tags tt ON t.id = tt.task_id
    LEFT JOIN tags tag ON tt.tag_id = tag.id
    WHERE ($1::uuid IS NULL OR t.project_id = $1)
    AND ($2::text IS NULL OR t.status = $2)
    AND ($3::text IS NULL OR t.priority = $3)
    AND ($4::text IS NULL OR t.assigned_to = $4)
    AND ($5::text IS NULL OR tag.name = $5)
    AND ($6::uuid IS NULL OR t.parent_task_id = $6)
    AND ($7::text IS NULL OR t.created_by = $7)
    ORDER BY t.created_at DESC
    LIMIT $8 OFFSET $9
  `,
  
  SELECT_TASK_TAGS: `
    SELECT tag.* FROM tags tag
    JOIN task_tags tt ON tag.id = tt.tag_id
    WHERE tt.task_id = $1
  `,
  
  SELECT_TASK_DEPENDENCIES: `
    SELECT td.*, t.title as depends_on_title
    FROM task_dependencies td
    JOIN tasks t ON td.depends_on_task_id = t.id
    WHERE td.task_id = $1
  `,
  
  // Documentation queries
  LIST_DOCUMENTATION: `
    SELECT * FROM documentation
    WHERE ($1::uuid IS NULL OR project_id = $1)
    AND ($2::text IS NULL OR type = $2)
    AND ($3::text IS NULL OR created_by = $3)
    ORDER BY created_at DESC
    LIMIT $4 OFFSET $5
  `,
  
  // Tag queries
  SELECT_TAG_BY_NAME: `
    SELECT * FROM tags WHERE name = $1
  `,
  
  LIST_TAGS: `
    SELECT * FROM tags ORDER BY name
  `,
  
  // Project overview queries
  PROJECT_TASK_STATISTICS: `
    SELECT 
      COUNT(*) as total_tasks,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
      COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_tasks,
      CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 2)
        ELSE 0 
      END as completion_percentage
    FROM tasks 
    WHERE project_id = $1
  `,
  
  RECENT_TASKS: `
    SELECT * FROM tasks 
    WHERE project_id = $1 
    ORDER BY updated_at DESC 
    LIMIT $2
  `,
  
  UPCOMING_DEADLINES: `
    SELECT * FROM tasks 
    WHERE project_id = $1 
    AND due_date IS NOT NULL 
    AND due_date >= CURRENT_DATE 
    AND due_date <= CURRENT_DATE + INTERVAL '$2 days'
    AND status != 'completed'
    ORDER BY due_date ASC
  `,
} as const;

// Type-safe query parameter helpers
export type QueryParams<T extends keyof typeof SQL_QUERIES> = 
  T extends 'LIST_PROJECTS' ? [string | null, string | null, number, number] :
  T extends 'LIST_TASKS_WITH_FILTERS' ? [string | null, string | null, string | null, string | null, string | null, string | null, string | null, number, number] :
  T extends 'PROJECT_TASK_STATISTICS' ? [string] :
  T extends 'RECENT_TASKS' ? [string, number] :
  T extends 'UPCOMING_DEADLINES' ? [string, number] :
  any[];