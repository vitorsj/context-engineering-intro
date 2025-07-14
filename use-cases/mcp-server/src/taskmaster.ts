import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { Props } from "./types";
import { GitHubHandler } from "./auth/github-handler";
import { closeDb } from "./database";
import { registerAllTaskmasterTools } from "./tools/register-taskmaster-tools";

// Extended environment for Taskmaster with Anthropic integration
interface TaskmasterEnv extends Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
}

export class TaskmasterMCP extends McpAgent<TaskmasterEnv, Record<string, never>, Props> {
  server = new McpServer({
    name: "Taskmaster PRP Parser MCP Server",
    version: "1.0.0",
  });

  /**
   * Cleanup database connections and resources when Durable Object is shutting down
   */
  async cleanup(): Promise<void> {
    try {
      // Close database connections
      await closeDb();
      
      console.log('Taskmaster MCP cleanup completed successfully');
    } catch (error) {
      console.error('Error during Taskmaster MCP cleanup:', error);
    }
  }

  /**
   * Durable Objects alarm handler - used for cleanup and maintenance
   */
  async alarm(): Promise<void> {
    console.log('Taskmaster MCP alarm triggered - performing cleanup');
    await this.cleanup();
  }

  /**
   * Initialize the Taskmaster MCP server with user context and register tools
   */
  async init() {
    console.log(`Taskmaster MCP server initialized for user: ${this.props.login} (${this.props.name})`);
    
    // Validate required environment variables
    this.validateEnvironment();
    
    // Register all Taskmaster tools based on user permissions
    registerAllTaskmasterTools(this.server, this.env, this.props);
    
    console.log('All Taskmaster tools registered successfully');
  }

  /**
   * Validate that all required environment variables are present
   */
  private validateEnvironment(): void {
    const requiredVars = [
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_MODEL'
    ];

    const missingVars = requiredVars.filter(varName => !this.env[varName as keyof TaskmasterEnv]);
    
    if (missingVars.length > 0) {
      const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Log successful validation (without exposing sensitive values)
    console.log('Environment validation successful - all required variables present');
    
    // Log configuration info (safe values only)
    console.log(`Anthropic Model: ${this.env.ANTHROPIC_MODEL}`);
    console.log(`Environment: ${this.env.NODE_ENV || 'development'}`);
    console.log(`Database configured: ${this.env.DATABASE_URL ? 'Yes' : 'No'}`);
    console.log(`Sentry monitoring: ${this.env.SENTRY_DSN ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Get server information and capabilities
   */
  getServerInfo() {
    return {
      name: "Taskmaster PRP Parser MCP Server",
      version: "1.0.0",
      capabilities: [
        'PRP Parsing with Anthropic Claude',
        'Task Management (CRUD operations)',
        'Documentation Management',
        'Project Overview and Analytics',
        'GitHub OAuth Authentication',
        'Role-based Access Control',
        'Audit Logging',
        'Real-time Health Monitoring'
      ],
      user_context: {
        username: this.props.login,
        display_name: this.props.name,
        email: this.props.email
      },
      environment: {
        anthropic_model: this.env.ANTHROPIC_MODEL,
        monitoring_enabled: !!this.env.SENTRY_DSN,
        environment: this.env.NODE_ENV || 'development'
      }
    };
  }
}

// OAuth provider configuration for Taskmaster
export default new OAuthProvider({
  apiHandlers: {
    '/sse': TaskmasterMCP.serveSSE('/sse') as any,
    '/mcp': TaskmasterMCP.serve('/mcp') as any,
  },
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: GitHubHandler as any,
  tokenEndpoint: "/token",
});