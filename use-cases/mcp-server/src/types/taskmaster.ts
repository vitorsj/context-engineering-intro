import { z } from "zod";

// Core database model interfaces
export interface Project {
  id: string;
  name: string;
  description?: string;
  goals?: string;
  target_users?: string;
  why_statement?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  parent_task_id?: string;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: Date;
  acceptance_criteria?: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  tags?: Tag[];
  dependencies?: TaskDependency[];
}

export interface Documentation {
  id: string;
  project_id: string;
  type: 'goals' | 'why' | 'target_users' | 'specifications' | 'notes';
  title: string;
  content: string;
  version: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  created_by: string;
  created_at: Date;
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
}

export interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
  dependency_type: 'blocks' | 'related' | 'subtask';
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changed_by: string;
  changed_at: Date;
}

// LLM parsing response structure
export interface ParsedPRPData {
  project_info: {
    name: string;
    description: string;
    goals: string;
    why_statement: string;
    target_users: string;
  };
  tasks: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    estimated_hours?: number;
    tags?: string[];
    dependencies?: string[]; // Task titles that this depends on
    acceptance_criteria?: string[];
  }[];
  documentation: {
    type: 'goals' | 'why' | 'target_users' | 'specifications' | 'notes';
    title: string;
    content: string;
  }[];
  suggested_tags: string[];
}

// Extended task with relations for responses
export interface TaskWithRelations extends Task {
  tags: Tag[];
  dependencies: TaskDependency[];
  project?: Project;
}

// Project overview aggregation
export interface ProjectOverview {
  project: Project;
  task_statistics: {
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    pending_tasks: number;
    blocked_tasks: number;
    completion_percentage: number;
  };
  recent_activity: {
    recent_tasks: Task[];
    recent_documentation: Documentation[];
  };
  tags: Tag[];
  upcoming_deadlines: Task[];
}

// Zod schemas for validation
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  goals: z.string().optional(),
  target_users: z.string().optional(),
  why_statement: z.string().optional(),
});

export const CreateTaskSchema = z.object({
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
});

export const UpdateTaskSchema = z.object({
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
});

export const CreateDocumentationSchema = z.object({
  project_id: z.string().uuid(),
  type: z.enum(['goals', 'why', 'target_users', 'specifications', 'notes']),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
});

export const UpdateDocumentationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
});

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().optional(),
});

export const ParsePRPSchema = z.object({
  prp_content: z.string().min(10).max(100000),
  project_name: z.string().min(1).max(255).optional(),
  project_context: z.string().optional(),
  auto_create_tasks: z.boolean().default(false),
});

export const ListTasksSchema = z.object({
  project_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigned_to: z.string().optional(),
  tag: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const GetTaskSchema = z.object({
  id: z.string().uuid(),
});

export const DeleteTaskSchema = z.object({
  id: z.string().uuid(),
});

export const GetProjectOverviewSchema = z.object({
  project_id: z.string().uuid(),
});

export const ListProjectsSchema = z.object({
  limit: z.number().int().positive().max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

// Task dependency validation schema
export const CreateTaskDependencySchema = z.object({
  task_id: z.string().uuid(),
  depends_on_task_id: z.string().uuid(),
  dependency_type: z.enum(['blocks', 'related', 'subtask']).default('blocks'),
}).refine(data => data.task_id !== data.depends_on_task_id, {
  message: "A task cannot depend on itself",
});

// Validation helpers
export function validateTaskStatus(status: string): status is Task['status'] {
  return ['pending', 'in_progress', 'completed', 'blocked'].includes(status);
}

export function validateTaskPriority(priority: string): priority is Task['priority'] {
  return ['low', 'medium', 'high', 'urgent'].includes(priority);
}

export function validateDocumentationType(type: string): type is Documentation['type'] {
  return ['goals', 'why', 'target_users', 'specifications', 'notes'].includes(type);
}

// Type guards
export function isTask(obj: any): obj is Task {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string';
}

export function isProject(obj: any): obj is Project {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
}

// Error response types
export interface TaskmasterError {
  type: 'validation' | 'permission' | 'database' | 'llm' | 'not_found';
  message: string;
  details?: Record<string, any>;
}

export function createTaskmasterError(
  type: TaskmasterError['type'],
  message: string,
  details?: Record<string, any>
): TaskmasterError {
  return { type, message, details };
}