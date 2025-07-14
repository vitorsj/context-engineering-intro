import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Props } from "../types";
import { registerDatabaseTools } from "../../examples/database-tools";
import { registerPRPParsingTools } from "./prp-parsing-tools";
import { registerTaskManagementTools } from "./task-management-tools";
import { registerDocumentationTools } from "./documentation-tools";
import { registerProjectOverviewTools } from "./project-overview-tools";

/**
 * Register all MCP tools based on user permissions
 */
export function registerAllTools(server: McpServer, env: Env, props: Props) {
	// Register database tools
	registerDatabaseTools(server, env, props);
	
	// Future tools can be registered here
	// registerOtherTools(server, env, props);
}

// Extended environment for Taskmaster
interface TaskmasterEnv extends Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
}

/**
 * Register all Taskmaster-specific MCP tools based on user permissions
 * This is a separate registration function for the Taskmaster MCP server
 */
export function registerAllTaskmasterTools(server: McpServer, env: TaskmasterEnv, props: Props) {
	console.log(`Registering Taskmaster tools for user: ${props.login}`);
	
	// Register PRP parsing tools (AI-powered task extraction)
	registerPRPParsingTools(server, env, props);
	
	// Register task management tools (CRUD operations)
	registerTaskManagementTools(server, env, props);
	
	// Register documentation management tools
	registerDocumentationTools(server, env, props);
	
	// Register project overview and analytics tools
	registerProjectOverviewTools(server, env, props);
	
	console.log('All Taskmaster tools registered successfully');
}