import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPRPParsingTools } from "./prp-parsing-tools";
import { registerTaskManagementTools } from "./task-management-tools";
import { registerDocumentationTools } from "./documentation-tools";
import { registerProjectOverviewTools } from "./project-overview-tools";

interface Props {
  login: string;
  name: string;
  email: string;
  accessToken: string;
}

interface TaskmasterEnv extends Env {
  DATABASE_URL: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
}

/**
 * Register all Taskmaster MCP tools with the server
 */
export function registerAllTaskmasterTools(
  server: McpServer, 
  env: TaskmasterEnv, 
  props: Props
) {
  console.log(`Registering Taskmaster tools for user: ${props.login}`);
  
  // Register PRP parsing tools (uses Anthropic API)
  registerPRPParsingTools(server, env, props);
  
  // Register task management tools (CRUD operations)
  registerTaskManagementTools(server, env, props);
  
  // Register documentation tools (project docs management)
  registerDocumentationTools(server, env, props);
  
  // Register project overview and analytics tools
  registerProjectOverviewTools(server, env, props);
  
  console.log(`All Taskmaster tools registered successfully for ${props.login}`);
}