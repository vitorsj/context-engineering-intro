---
name: "Taskmaster PRP Parser MCP Server"
description: Production-ready MCP server that parses PRPs using Anthropic LLM to extract tasks and perform CRUD operations on project management data
created: 2025-07-12
---

## Purpose

Build a production-ready MCP (Model Context Protocol) server that revolutionizes project management by parsing Product Requirement Prompts (PRPs) using Anthropic's LLM to automatically extract actionable tasks, goals, and documentation, then storing and managing them in a PostgreSQL database with full CRUD operations.

## Core Principles

1. **Context is King**: Include ALL necessary MCP patterns, authentication flows, Anthropic API integration, and database schemas
2. **Validation Loops**: Provide executable tests from TypeScript compilation to production deployment
3. **Security First**: Build-in authentication, authorization, SQL injection protection, and API key management
4. **Production Ready**: Include monitoring, error handling, and deployment automation
5. **LLM-Powered Intelligence**: Use Anthropic's Claude for intelligent PRP parsing instead of complex regex patterns

---

## Goal

Build a production-ready Taskmaster MCP server with:

- **LLM-Powered PRP Parsing**: Use Anthropic's Claude to intelligently extract tasks, goals, documentation, and metadata from PRPs
- **Comprehensive Task Management**: Full CRUD operations on tasks, documentation, tags, and project metadata
- **GitHub OAuth Authentication**: Role-based access control with GitHub user integration
- **Cloudflare Workers Deployment**: Global edge deployment with monitoring and state management
- **PostgreSQL Database**: Robust schema for tasks, documentation, tags, and relationships
- **Intelligent Context Extraction**: Capture goals, whys, target users, and contextual information from PRPs

## Why

- **Developer Productivity**: Automate the tedious process of manually extracting tasks from lengthy PRPs
- **Enterprise Security**: GitHub OAuth with granular permission system for team collaboration
- **Scalability**: Cloudflare Workers global edge deployment for fast worldwide access
- **AI-Enhanced Project Management**: Leverage LLM intelligence for better task extraction and categorization
- **Seamless Integration**: Works with existing PRP workflow and can integrate with development tools via MCP

## What

### MCP Server Features

**Core LLM-Powered Tools:**

- **`parsePRP`** - Primary tool that takes a PRP content and uses Anthropic Claude to extract tasks, goals, documentation, and metadata
- **`createTask`** - Create individual tasks with metadata (priority, status, tags, assignments)
- **`listTasks`** - List all tasks with filtering options (by status, priority, tags, assigned user)
- **`updateTask`** - Update task details, status, priority, assignments, and add additional information
- **`deleteTask`** - Remove tasks from the system (with proper authorization)
- **`getTask`** - Fetch detailed information about a specific task including related documentation
- **`createDocumentation`** - Add project documentation, goals, target users, and contextual information
- **`getDocumentation`** - Retrieve documentation by type (goals, whys, target users, specifications)
- **`updateDocumentation`** - Modify existing documentation and project context
- **`manageTags`** - Create, update, and organize tags for better task categorization
- **`getProjectOverview`** - Generate comprehensive project overview from stored tasks and documentation

**LLM Integration Features:**

- **Intelligent Task Extraction**: Claude analyzes PRP structure to identify actionable tasks
- **Context Preservation**: Extract and store goals, whys, target users, and project context
- **Smart Categorization**: Automatically suggest tags and priorities based on PRP content
- **Relationship Detection**: Identify task dependencies and groupings from PRP structure
- **Metadata Enrichment**: Extract implementation details, validation criteria, and success metrics

**Authentication & Authorization:**

- GitHub OAuth 2.0 integration with signed cookie approval system
- Role-based access control (read-only vs privileged users for task management)
- User context propagation to all MCP tools for audit trails
- Secure session management with HMAC-signed cookies

**Database Integration:**

- PostgreSQL with comprehensive schema for tasks, documentation, tags, and relationships
- SQL injection protection and query validation
- Read/write operation separation based on user permissions
- Error sanitization to prevent information leakage
- Audit trails for all task and documentation changes

**Deployment & Monitoring:**

- Cloudflare Workers with Durable Objects for state management
- Optional Sentry integration for error tracking and performance monitoring
- Environment-based configuration (development vs production)
- Real-time logging and alerting for LLM API usage and errors

### Success Criteria

- [ ] GitHub OAuth flow works end-to-end (authorization → callback → MCP access)
- [ ] Anthropic API integration successfully parses PRPs and extracts tasks
- [ ] TypeScript compilation succeeds with no errors
- [ ] Local development server starts and responds correctly
- [ ] Database schema successfully stores tasks, documentation, and relationships
- [ ] All CRUD operations work correctly with proper authorization
- [ ] Production deployment to Cloudflare Workers succeeds
- [ ] Authentication prevents unauthorized access to sensitive operations
- [ ] Error handling provides user-friendly messages without leaking system details
- [ ] LLM parsing handles various PRP formats and extracts meaningful task data
- [ ] Performance is acceptable for typical PRP sizes (up to 10,000 words)

## All Needed Context

### Documentation & References (MUST READ)

```yaml
# CRITICAL MCP PATTERNS - Read these first
- docfile: PRPs/ai_docs/mcp_patterns.md
  why: Core MCP development patterns, security practices, and error handling

# CRITICAL API INTEGRATION - Anthropic Claude usage
- docfile: PRPs/ai_docs/claude_api_usage.md
  why: How to use the Anthropic API to get a response from an LLM for PRP parsing

# TOOL REGISTRATION SYSTEM - Understand the modular approach
- file: src/tools/register-tools.ts
  why: Central registry showing how all tools are imported and registered - STUDY this pattern

# EXAMPLE MCP TOOLS - Look here how to create and register new tools
- file: examples/database-tools.ts
  why: Example tools for a Postgres MCP server showing best practices for tool creation and registration

- file: examples/database-tools-sentry.ts
  why: Example tools for the Postgres MCP server but with the Sentry integration for production monitoring

# EXISTING CODEBASE PATTERNS - Study these implementations
- file: src/index.ts
  why: Complete MCP server with authentication, database, and tools - MIRROR this pattern

- file: src/github-handler.ts
  why: OAuth flow implementation - USE this exact pattern for authentication

- file: src/database.ts
  why: Database security, connection pooling, SQL validation - FOLLOW these patterns

- file: wrangler.jsonc
  why: Cloudflare Workers configuration - COPY this pattern for deployment

# OFFICIAL MCP DOCUMENTATION
- url: https://modelcontextprotocol.io/docs/concepts/tools
  why: MCP tool registration and schema definition patterns

- url: https://modelcontextprotocol.io/docs/concepts/resources
  why: MCP resource implementation if needed

# TASKMASTER REFERENCE
- url: https://github.com/eyaltoledano/claude-task-master
  why: Reference implementation for task management patterns and data structures

# ANTHROPIC API DOCUMENTATION
- url: https://docs.anthropic.com/en/api/messages
  why: Official Anthropic Messages API documentation for LLM integration
```

### Current Codebase Tree

```bash
/
├── src/
│   ├── index.ts                 # Main authenticated MCP server ← STUDY THIS
│   ├── index_sentry.ts         # Sentry monitoring version
│   ├── simple-math.ts          # Basic MCP example ← GOOD STARTING POINT
│   ├── github-handler.ts       # OAuth implementation ← USE THIS PATTERN
│   ├── database.ts             # Database utilities ← SECURITY PATTERNS
│   ├── utils.ts                # OAuth helpers
│   ├── workers-oauth-utils.ts  # Cookie security system
│   └── tools/                  # Tool registration system
│       └── register-tools.ts   # Central tool registry ← UNDERSTAND THIS
├── PRPs/
│   ├── templates/prp_mcp_base.md  # Base template used for this PRP
│   └── ai_docs/                   # Implementation guides ← READ ALL
│       ├── claude_api_usage.md    # Anthropic API integration patterns
│       └── mcp_patterns.md        # MCP development best practices
├── examples/                   # Example tool implementations
│   ├── database-tools.ts       # Database tools example ← FOLLOW PATTERN
│   └── database-tools-sentry.ts # With Sentry monitoring
├── wrangler.jsonc              # Cloudflare config ← COPY PATTERNS
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

### Desired Codebase Tree (Files to add/modify)

```bash
src/
├── taskmaster.ts               # NEW: Main taskmaster MCP server
├── database/
│   ├── connection.ts           # COPY: From existing patterns
│   ├── security.ts             # COPY: From existing patterns
│   ├── migrations/             # NEW: Database migrations
│   │   └── 001_taskmaster_schema.sql
│   └── models.ts               # NEW: TypeScript interfaces for data models
├── llm/
│   ├── anthropic-client.ts     # NEW: Anthropic API client wrapper
│   ├── prp-parser.ts           # NEW: PRP parsing logic with prompts
│   └── prompts.ts              # NEW: System prompts for task extraction
├── tools/
│   ├── register-tools.ts       # MODIFY: Add taskmaster tool registration
│   ├── prp-parsing-tools.ts    # NEW: PRP parsing tools
│   ├── task-management-tools.ts # NEW: Task CRUD operations
│   ├── documentation-tools.ts   # NEW: Documentation management
│   └── project-overview-tools.ts # NEW: Project overview and reporting
├── types/
│   ├── taskmaster.ts           # NEW: TypeScript types and Zod schemas
│   └── anthropic.ts            # NEW: Anthropic API types
└── utils/
    ├── error-handling.ts       # NEW: Centralized error handling
    └── validation.ts           # NEW: Input validation helpers

wrangler-taskmaster.jsonc       # NEW: Taskmaster-specific configuration
```

### Database Schema Design

```sql
-- PostgreSQL schema for taskmaster
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    goals TEXT,
    target_users TEXT,
    why_statement TEXT,
    created_by VARCHAR(255) NOT NULL, -- GitHub username
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, blocked
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    assigned_to VARCHAR(255), -- GitHub username
    parent_task_id UUID REFERENCES tasks(id), -- For task hierarchies
    estimated_hours INTEGER,
    actual_hours INTEGER,
    due_date TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- goals, why, target_users, specifications, notes
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7), -- Hex color code
    description TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_tags (
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE task_dependencies (
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'blocks', -- blocks, related, subtask
    PRIMARY KEY (task_id, depends_on_task_id)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- insert, update, delete
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_documentation_project_id ON documentation(project_id);
CREATE INDEX idx_documentation_type ON documentation(type);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
```

### Known Gotchas & Critical Patterns

```typescript
// CRITICAL: Anthropic API integration pattern
export class AnthropicClient {
  constructor(private apiKey: string, private model: string) {}
  
  async parsePRP(prpContent: string, projectContext?: string): Promise<ParsedPRPData> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: this.buildPRPParsingPrompt(prpContent, projectContext)
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.content[0].text;
    
    // Parse JSON response with error handling
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }
}

// CRITICAL: Task management patterns with proper database operations
export async function createTasksFromPRP(
  db: postgres.Sql,
  projectId: string,
  parsedData: ParsedPRPData,
  createdBy: string
): Promise<Task[]> {
  // Use transaction for consistency
  return await db.begin(async (tx) => {
    const tasks: Task[] = [];
    
    for (const taskData of parsedData.tasks) {
      const [task] = await tx`
        INSERT INTO tasks (project_id, title, description, priority, status, created_by)
        VALUES (${projectId}, ${taskData.title}, ${taskData.description}, 
                ${taskData.priority}, 'pending', ${createdBy})
        RETURNING *
      `;
      tasks.push(task);
      
      // Add tags if specified
      if (taskData.tags) {
        for (const tagName of taskData.tags) {
          await upsertTagAndLink(tx, task.id, tagName, createdBy);
        }
      }
    }
    
    return tasks;
  });
}

// CRITICAL: Permission checking for task operations
const TASK_MANAGERS = new Set(["admin1", "project-lead1"]);
const TASK_VIEWERS = new Set(["developer1", "developer2", ...TASK_MANAGERS]);

function canModifyTask(username: string, task: Task): boolean {
  // Task managers can modify any task
  if (TASK_MANAGERS.has(username)) return true;
  
  // Users can modify their own assigned tasks
  if (task.assigned_to === username) return true;
  
  // Task creators can modify their own tasks
  if (task.created_by === username) return true;
  
  return false;
}

// CRITICAL: Error handling for LLM operations
async function safeLLMOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error.message.includes('rate_limit')) {
      throw new Error('LLM rate limit exceeded. Please try again in a few moments.');
    }
    if (error.message.includes('invalid_api_key')) {
      throw new Error('LLM authentication failed. Please check API configuration.');
    }
    if (error.message.includes('timeout')) {
      throw new Error('LLM request timed out. Please try with a shorter PRP or try again.');
    }
    
    console.error('LLM operation error:', error);
    throw new Error(`LLM processing failed: ${error.message}`);
  }
}
```

## Implementation Blueprint

### Data Models & Types

Define TypeScript interfaces and Zod schemas for comprehensive type safety:

```typescript
// Core data models
interface Project {
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

interface Task {
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
  created_by: string;
  created_at: Date;
  updated_at: Date;
  tags?: Tag[];
  dependencies?: TaskDependency[];
}

interface Documentation {
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

// LLM parsing response structure
interface ParsedPRPData {
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
    type: string;
    title: string;
    content: string;
  }[];
  suggested_tags: string[];
}

// Zod schemas for validation
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.string().optional(),
  parent_task_id: z.string().uuid().optional(),
  estimated_hours: z.number().int().positive().optional(),
  due_date: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

const ParsePRPSchema = z.object({
  prp_content: z.string().min(10).max(50000),
  project_name: z.string().min(1).max(255).optional(),
  project_context: z.string().optional(),
});

// Environment interface
interface Env {
  DATABASE_URL: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string; // e.g., "claude-3-sonnet-20240229"
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_KV: KVNamespace;
}
```

### List of Tasks (Complete in order)

```yaml
Task 1 - Project Setup & Environment:
  COPY wrangler.jsonc to wrangler-taskmaster.jsonc:
    - MODIFY name field to "taskmaster-mcp-server"
    - ADD ANTHROPIC_API_KEY and ANTHROPIC_MODEL to vars section
    - KEEP existing OAuth and database configuration
    - UPDATE main field to "src/taskmaster.ts"

  ENSURE .dev.vars.example file has all the necessary environment variables:
    - Confirm ANTHROPIC_API_KEY=your_anthropic_api_key
    - Confirm ANTHROPIC_MODEL=claude-3-sonnet-20240229
    - KEEP existing GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, DATABASE_URL, COOKIE_ENCRYPTION_KEY

  INSTALL additional dependencies:
    - Ensure all MCP and database dependencies are available
    - No additional dependencies needed (using fetch API for Anthropic)

Task 2 - Database Schema Setup:
  CREATE src/database/migrations/001_taskmaster_schema.sql:
    - COPY the complete schema from the provided SQL above
    - INCLUDE all tables: projects, tasks, documentation, tags, task_tags, task_dependencies, audit_logs
    - INCLUDE all indexes for performance optimization

  CREATE src/database/models.ts:
    - DEFINE TypeScript interfaces for all database models
    - INCLUDE Zod schemas for validation
    - EXPORT types for use across the application

  RUN database migration:
    - EXECUTE the schema creation script on your PostgreSQL database
    - VERIFY all tables and indexes are created correctly

Task 3 - LLM Integration Layer:
  CREATE src/llm/anthropic-client.ts:
    - IMPLEMENT AnthropicClient class with error handling
    - USE the pattern from PRPs/ai_docs/claude_api_usage.md
    - INCLUDE proper timeout and retry logic
    - IMPLEMENT response parsing with error recovery

  CREATE src/llm/prompts.ts:
    - DEFINE system prompts for PRP parsing
    - INCLUDE task extraction, goal identification, and documentation parsing
    - ENSURE prompts return valid JSON with the ParsedPRPData structure
    - ADD examples and formatting instructions for consistent LLM responses

  CREATE src/llm/prp-parser.ts:
    - IMPLEMENT high-level PRP parsing logic
    - COMBINE AnthropicClient with prompt templates
    - INCLUDE validation of LLM responses
    - ADD error handling for malformed LLM outputs

Task 4 - Tool Implementation:
  CREATE src/tools/prp-parsing-tools.ts:
    - IMPLEMENT parsePRP tool with proper input validation
    - USE ParsePRPSchema for input validation
    - INTEGRATE with LLM parsing logic
    - RETURN structured task and documentation data
    - INCLUDE proper error handling for LLM failures

  CREATE src/tools/task-management-tools.ts:
    - IMPLEMENT createTask, listTasks, updateTask, deleteTask, getTask tools
    - USE database patterns from examples/database-tools.ts
    - INCLUDE permission checking for each operation
    - ADD proper SQL validation and injection protection
    - IMPLEMENT filtering and search capabilities for listTasks

  CREATE src/tools/documentation-tools.ts:
    - IMPLEMENT createDocumentation, getDocumentation, updateDocumentation tools
    - SUPPORT different documentation types (goals, why, target_users, specifications, notes)
    - INCLUDE version control for documentation changes
    - ADD search and filtering capabilities

  CREATE src/tools/project-overview-tools.ts:
    - IMPLEMENT getProjectOverview tool for comprehensive project reporting
    - AGGREGATE data from tasks, documentation, and project metadata
    - INCLUDE progress calculations and status summaries
    - ADD trend analysis and reporting features

Task 5 - Main MCP Server:
  CREATE src/taskmaster.ts:
    - COPY structure from src/index.ts as the base
    - MODIFY server name to "Taskmaster PRP Parser MCP Server"
    - IMPORT all tool registration functions
    - IMPLEMENT proper cleanup() and alarm() methods
    - INCLUDE user context propagation to all tools

  UPDATE src/tools/register-tools.ts:
    - IMPORT all new tool registration functions
    - ADD calls to register all taskmaster tools in registerAllTools()
    - ENSURE proper ordering and dependency management

Task 6 - Error Handling & Validation:
  CREATE src/utils/error-handling.ts:
    - IMPLEMENT centralized error handling for LLM operations
    - INCLUDE specific error types for different failure modes
    - ADD user-friendly error messages without exposing internal details
    - IMPLEMENT error recovery strategies

  CREATE src/utils/validation.ts:
    - IMPLEMENT input validation helpers beyond basic Zod schemas
    - ADD business logic validation (e.g., task dependency cycles)
    - INCLUDE data consistency checks
    - ADD validation for LLM response format and completeness

Task 7 - Local Testing Setup:
  UPDATE wrangler-taskmaster.jsonc with KV namespace:
    - CREATE KV namespace: wrangler kv namespace create "TASKMASTER_OAUTH_KV"
    - UPDATE configuration with returned namespace ID
    - VERIFY all environment variables are properly configured

  TEST basic functionality:
    - RUN: wrangler dev --config wrangler-taskmaster.jsonc
    - VERIFY server starts without errors and serves at http://localhost:8792
    - TEST OAuth flow: http://localhost:8792/authorize
    - VERIFY MCP endpoint: http://localhost:8792/mcp

Task 8 - Integration Testing:
  TEST LLM integration:
    - CREATE test PRP content for parsing
    - VERIFY Anthropic API connection and response format
    - TEST error handling for API failures and malformed responses
    - VALIDATE task extraction accuracy and completeness

  TEST database operations:
    - VERIFY all CRUD operations work correctly
    - TEST permission enforcement for different user roles
    - VALIDATE data relationships and constraints
    - ENSURE audit logging captures all changes

  TEST MCP tool functionality:
    - CONNECT to local server: http://localhost:8792/mcp
    - TEST each tool with various input scenarios
    - VERIFY error handling and response formats

Task 9 - Production Deployment:
  SET production secrets:
    - RUN: wrangler secret put ANTHROPIC_API_KEY
    - RUN: wrangler secret put ANTHROPIC_MODEL
    - RUN: wrangler secret put GITHUB_CLIENT_ID
    - RUN: wrangler secret put GITHUB_CLIENT_SECRET
    - RUN: wrangler secret put DATABASE_URL
    - RUN: wrangler secret put COOKIE_ENCRYPTION_KEY

  DEPLOY to Cloudflare Workers:
    - RUN: wrangler deploy --config wrangler-taskmaster.jsonc
    - VERIFY deployment success and functionality
    - TEST production OAuth flow and MCP endpoint
    - VALIDATE LLM integration works in production environment

Task 10 - Documentation & Claude Desktop Integration:
  CREATE integration instructions:
    - DOCUMENT how to add the server to Claude Desktop configuration
    - PROVIDE example configurations for local development and production
    - INCLUDE usage examples for each MCP tool
    - ADD troubleshooting guide for common issues

  TEST Claude Desktop integration:
    - ADD server configuration to Claude Desktop
    - VERIFY all tools are accessible and functional
    - TEST end-to-end workflow: PRP upload → parsing → task management
    - VALIDATE user experience and performance
```

### Per Task Implementation Details

```typescript
// Task 3 - LLM Integration Layer Example
export class AnthropicClient {
  constructor(private apiKey: string, private model: string) {}

  async parsePRP(prpContent: string, projectContext?: string): Promise<ParsedPRPData> {
    const prompt = this.buildPRPParsingPrompt(prpContent, projectContext);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for consistent parsing
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.content[0].text;
    
    try {
      const parsed = JSON.parse(content);
      return this.validateParsedData(parsed);
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  private buildPRPParsingPrompt(prpContent: string, projectContext?: string): string {
    return `
You are a project management assistant that extracts actionable tasks and project information from Product Requirement Prompts (PRPs).

${projectContext ? `Context: ${projectContext}` : ''}

Please analyze the following PRP and extract:
1. Project information (name, description, goals, why statement, target users)
2. Actionable tasks with priorities and descriptions
3. Supporting documentation
4. Suggested tags for organization

Return ONLY valid JSON in this exact format:
{
  "project_info": {
    "name": "string",
    "description": "string", 
    "goals": "string",
    "why_statement": "string",
    "target_users": "string"
  },
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "priority": "low|medium|high|urgent",
      "estimated_hours": number,
      "tags": ["string"],
      "dependencies": ["task_title"],
      "acceptance_criteria": ["string"]
    }
  ],
  "documentation": [
    {
      "type": "goals|why|target_users|specifications|notes",
      "title": "string",
      "content": "string"
    }
  ],
  "suggested_tags": ["string"]
}

PRP Content:
${prpContent}
`;
  }
}

// Task 4 - Tool Implementation Example
export function registerPRPParsingTools(server: McpServer, env: Env, props: Props) {
  const anthropicClient = new AnthropicClient(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);

  server.tool(
    "parsePRP",
    "Parse a Product Requirement Prompt (PRP) to extract tasks, goals, and documentation",
    ParsePRPSchema,
    async ({ prp_content, project_name, project_context }) => {
      try {
        console.log(`PRP parsing initiated by ${props.login}`);
        
        // Parse PRP using LLM
        const parsedData = await safeLLMOperation(async () => {
          return await anthropicClient.parsePRP(prp_content, project_context);
        });

        // Store in database
        return await withDatabase(env.DATABASE_URL, async (db) => {
          // Create or update project
          const [project] = await db`
            INSERT INTO projects (name, description, goals, why_statement, target_users, created_by)
            VALUES (
              ${project_name || parsedData.project_info.name},
              ${parsedData.project_info.description},
              ${parsedData.project_info.goals},
              ${parsedData.project_info.why_statement},
              ${parsedData.project_info.target_users},
              ${props.login}
            )
            ON CONFLICT (name) DO UPDATE SET
              description = EXCLUDED.description,
              goals = EXCLUDED.goals,
              why_statement = EXCLUDED.why_statement,
              target_users = EXCLUDED.target_users,
              updated_at = CURRENT_TIMESTAMP
            RETURNING *
          `;

          // Create tasks
          const tasks = await createTasksFromPRP(db, project.id, parsedData, props.login);
          
          // Create documentation
          await createDocumentationFromPRP(db, project.id, parsedData, props.login);

          return {
            content: [
              {
                type: "text",
                text: `**PRP Parsed Successfully!**\n\n**Project:** ${project.name}\n**Tasks Created:** ${tasks.length}\n**Documentation Sections:** ${parsedData.documentation.length}\n\n**Tasks:**\n${tasks.map(t => `- ${t.title} (${t.priority})`).join('\n')}\n\n**Next Steps:**\n- Use \`listTasks\` to view all tasks\n- Use \`updateTask\` to modify task details\n- Use \`getProjectOverview\` for comprehensive project status`
              }
            ]
          };
        });
      } catch (error) {
        console.error('PRP parsing error:', error);
        return createErrorResponse(`PRP parsing failed: ${error.message}`);
      }
    }
  );
}

// Task 5 - Main MCP Server Implementation
export class TaskmasterMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "Taskmaster PRP Parser MCP Server",
    version: "1.0.0",
  });

  async cleanup(): Promise<void> {
    try {
      await closeDb();
      console.log('Taskmaster MCP cleanup completed successfully');
    } catch (error) {
      console.error('Taskmaster MCP cleanup error:', error);
    }
  }

  async alarm(): Promise<void> {
    await this.cleanup();
  }

  async init() {
    console.log(`Taskmaster MCP server initialized for user: ${this.props.login}`);
    
    // Register all taskmaster tools
    registerAllTools(this.server, this.env, this.props);
  }
}
```

### Integration Points

```yaml
CLOUDFLARE_WORKERS:
  - wrangler-taskmaster.jsonc: Taskmaster-specific configuration with Anthropic environment variables
  - Environment secrets: GitHub OAuth, database URL, Anthropic API key and model
  - Durable Objects: MCP agent binding for state persistence and cleanup

GITHUB_OAUTH:
  - GitHub App: Create with callback URL matching your Workers domain
  - Client credentials: Store as Cloudflare Workers secrets
  - Callback URL: https://your-taskmaster-worker.workers.dev/callback

ANTHROPIC_API:
  - API Key: Store as Cloudflare Workers secret (ANTHROPIC_API_KEY)
  - Model Selection: Environment variable (ANTHROPIC_MODEL) for easy model switching
  - Rate Limiting: Implement exponential backoff and retry logic
  - Error Handling: Specific handling for rate limits, authentication, and parsing errors

DATABASE:
  - PostgreSQL Schema: Comprehensive schema with projects, tasks, documentation, tags
  - Audit Logging: Track all changes for accountability and debugging
  - Environment variable: DATABASE_URL with full connection string
  - Security: Use validateSqlQuery and proper permission checking

ENVIRONMENT_VARIABLES:
  - Development: .dev.vars file for local testing with Anthropic credentials
  - Production: Cloudflare Workers secrets for deployment
  - Required: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, DATABASE_URL, COOKIE_ENCRYPTION_KEY, ANTHROPIC_API_KEY, ANTHROPIC_MODEL

KV_STORAGE:
  - OAuth state: Used by OAuth provider for state management
  - Namespace: Create with `wrangler kv namespace create "TASKMASTER_OAUTH_KV"`
  - Configuration: Add namespace ID to wrangler-taskmaster.jsonc bindings
```

## Validation Gate

### Level 1: TypeScript & Configuration

```bash
# CRITICAL: Run these FIRST - fix any errors before proceeding
npm run type-check                 # TypeScript compilation
wrangler types                     # Generate Cloudflare Workers types

# Expected: No TypeScript errors
# If errors: Fix type issues, missing interfaces, import problems
```

### Level 2: Local Development Testing

```bash
# Start local development server with taskmaster config
wrangler dev --config wrangler-taskmaster.jsonc

# Test OAuth flow (should redirect to GitHub)
curl -v http://localhost:8792/authorize

# Test MCP endpoint (should return server info)
curl -v http://localhost:8792/mcp

# Expected: Server starts, OAuth redirects to GitHub, MCP responds with server info
# If errors: Check console output, verify environment variables, fix configuration
```

### Level 3: Unit Testing

```bash
# Run unit tests for all components
npm run test

# Test database connectivity
npm run test:db

# Test LLM integration
npm run test:llm

# Expected: All tests pass, database connects, LLM responds correctly
# If errors: Fix failing tests, check environment setup, validate API keys
```

### Level 4: LLM Functionality Testing

```bash
# Test PRP parsing with various inputs
curl -X POST http://localhost:8792/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "parsePRP",
      "arguments": {
        "prp_content": "SAMPLE PRP CONTENT HERE",
        "project_name": "Test Project"
      }
    }
  }'

# Test edge cases:
# - Very large PRPs (>10,000 words)
# - Malformed PRPs
# - Empty or minimal PRPs
# - PRPs with complex task dependencies

# Expected: Successful parsing, task extraction, error handling for edge cases
# If errors: Check LLM prompts, error handling, response validation
```

## Final Validation Checklist

### Core Functionality

- [ ] TypeScript compilation: `npm run type-check` passes
- [ ] Unit tests pass: `npm run test` passes
- [ ] Local server starts: `wrangler dev --config wrangler-taskmaster.jsonc` runs without errors (add a timeout of 10 seconds because this command will hang)
- [ ] MCP endpoint responds: `curl http://localhost:8792/mcp` returns server info

### LLM Integration

- [ ] Anthropic API connection: API key valid and requests successful
- [ ] PRP parsing: LLM correctly extracts tasks, goals, and documentation
- [ ] Error handling: Graceful handling of LLM failures and malformed responses
- [ ] Rate limiting: Proper handling of API rate limits and timeouts
- [ ] Response validation: LLM responses parsed and validated correctly

### Database Operations

- [ ] Schema migration: All tables and indexes created successfully
- [ ] CRUD operations: All task and documentation operations work correctly
- [ ] Permission enforcement: Users can only access/modify authorized data
- [ ] Data integrity: Relationships and constraints properly enforced
- [ ] Audit logging: All changes tracked with proper attribution

### MCP Tool Functionality

- [ ] parsePRP tool: Successfully parses PRP content and creates tasks
- [ ] Task management tools: All CRUD operations work with proper validation
- [ ] Documentation tools: Version control and content management work correctly
- [ ] Project overview: Comprehensive reporting and analytics functional
- [ ] Error responses: User-friendly errors without sensitive information leakage

### Production Readiness

- [ ] Production deployment: Successfully deployed to Cloudflare Workers
- [ ] Claude Desktop integration: Server accessible and functional in Claude Desktop
- [ ] Performance: Acceptable response times for typical operations
- [ ] Monitoring: Logging and error tracking operational
- [ ] Security: All authentication and authorization working correctly

---

## Anti-Patterns to Avoid

### LLM Integration

- ❌ Don't ignore rate limiting - implement proper backoff and retry strategies
- ❌ Don't trust LLM responses blindly - always validate and sanitize outputs
- ❌ Don't expose API keys - use environment variables and secure secret management

### Database Design

- ❌ Don't skip audit logging - track all changes for debugging and accountability
- ❌ Don't ignore data relationships - properly implement foreign keys and constraints
- ❌ Don't allow circular dependencies - validate task dependency graphs
- ❌ Don't forget indexes - ensure query performance for large datasets

### Task Management

- ❌ Don't skip permission checking - validate user access for every operation
- ❌ Don't allow unconstrained queries - implement proper filtering and pagination
- ❌ Don't ignore data validation - use Zod schemas for all inputs
- ❌ Don't forget error handling - provide user-friendly error messages

### Development Process

- ❌ Don't skip the validation loops - each level catches different issues
- ❌ Don't guess about LLM behavior - test with various PRP formats and edge cases
- ❌ Don't deploy without monitoring - implement comprehensive logging and alerting
- ❌ Don't ignore TypeScript errors - fix all type issues before deployment