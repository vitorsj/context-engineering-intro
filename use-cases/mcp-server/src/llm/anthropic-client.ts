import type {
  AnthropicRequest,
  AnthropicResponse,
  AnthropicError,
  AnthropicClientConfig,
  PRPParsingConfig,
  RateLimitInfo,
  AnthropicAPIMetrics,
  RetryConfig,
} from "../types/anthropic.js";
import {
  DEFAULT_CLIENT_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from "../types/anthropic.js";
import {
  isAnthropicError,
  isAnthropicResponse,
  isRateLimitError,
  isAuthenticationError,
  isServerError,
} from "../types/anthropic.js";

export class AnthropicClient {
  private config: AnthropicClientConfig;
  private retryConfig: RetryConfig;
  private metrics: AnthropicAPIMetrics;

  constructor(apiKey: string, config: Partial<AnthropicClientConfig> = {}) {
    this.config = {
      apiKey,
      ...DEFAULT_CLIENT_CONFIG,
      ...config,
    } as AnthropicClientConfig;

    this.retryConfig = DEFAULT_RETRY_CONFIG;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): AnthropicAPIMetrics {
    return {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      average_response_time: 0,
      rate_limit_hits: 0,
    };
  }

  async makeRequest(request: AnthropicRequest): Promise<AnthropicResponse> {
    const startTime = Date.now();
    this.metrics.total_requests++;

    try {
      const response = await this.makeRequestWithRetry(request);
      
      // Update metrics on success
      this.metrics.successful_requests++;
      this.updateResponseTimeMetrics(Date.now() - startTime);
      
      if (response.usage) {
        this.metrics.total_input_tokens += response.usage.input_tokens;
        this.metrics.total_output_tokens += response.usage.output_tokens;
      }

      return response;
    } catch (error) {
      this.metrics.failed_requests++;
      this.updateResponseTimeMetrics(Date.now() - startTime);
      throw error;
    }
  }

  private async makeRequestWithRetry(request: AnthropicRequest): Promise<AnthropicResponse> {
    let lastError: Error = new Error('No attempts made');
    
    for (let attempt = 1; attempt <= this.retryConfig.max_attempts; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        const data = await response.json();

        if (!response.ok) {
          if (isAnthropicError(data)) {
            if (isRateLimitError(data)) {
              this.metrics.rate_limit_hits++;
              if (this.retryConfig.retry_on_rate_limit && attempt < this.retryConfig.max_attempts) {
                await this.delay(this.calculateRetryDelay(attempt));
                continue;
              }
            }
            
            if (isAuthenticationError(data)) {
              throw new Error(`Anthropic authentication failed: ${data.error.message}`);
            }
            
            if (isServerError(data) && this.retryConfig.retry_on_server_error && attempt < this.retryConfig.max_attempts) {
              await this.delay(this.calculateRetryDelay(attempt));
              continue;
            }
            
            throw new Error(`Anthropic API error (${data.error.type}): ${data.error.message}`);
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!isAnthropicResponse(data)) {
          throw new Error('Invalid response format from Anthropic API');
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.retryConfig.max_attempts) {
          // Check if this is a retryable error
          if (this.isRetryableError(lastError)) {
            await this.delay(this.calculateRetryDelay(attempt));
            continue;
          }
        }
        
        break; // Non-retryable error or max attempts reached
      }
    }
    
    throw lastError;
  }

  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Retry on network errors, timeouts, and certain server errors
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('rate_limit_error') ||
      (this.retryConfig.retry_on_server_error && (
        message.includes('api_error') ||
        message.includes('overloaded_error') ||
        message.includes('internal server error')
      ))
    );
  }

  private calculateRetryDelay(attempt: number): number {
    if (!this.retryConfig.exponential_backoff) {
      return this.retryConfig.base_delay;
    }
    
    const delay = this.retryConfig.base_delay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.retryConfig.max_delay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateResponseTimeMetrics(responseTime: number): void {
    const totalRequests = this.metrics.successful_requests + this.metrics.failed_requests;
    
    if (totalRequests === 1) {
      this.metrics.average_response_time = responseTime;
    } else {
      // Calculate running average
      this.metrics.average_response_time = 
        (this.metrics.average_response_time * (totalRequests - 1) + responseTime) / totalRequests;
    }
  }

  async parsePRP(
    prpContent: string, 
    projectContext: string | undefined = undefined, 
    config: Partial<PRPParsingConfig> = {}
  ): Promise<any> {
    const parsingConfig: PRPParsingConfig = {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      temperature: 0.1,
      include_context: true,
      extract_acceptance_criteria: true,
      suggest_tags: true,
      estimate_hours: true,
      ...config,
    };

    const prompt = this.buildPRPParsingPrompt(prpContent, parsingConfig, projectContext);
    
    const request: AnthropicRequest = {
      model: parsingConfig.model,
      max_tokens: parsingConfig.max_tokens,
      temperature: parsingConfig.temperature,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    };

    try {
      const response = await this.makeRequest(request);
      const content = response.content[0]?.text;
      
      if (!content) {
        throw new Error('Empty response from Anthropic API');
      }

      // Parse JSON response with error handling
      let parsedData: any;
      try {
        parsedData = JSON.parse(content);
      } catch (parseError) {
        // Try to extract JSON from potentially malformed response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedData = JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error(`Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          }
        } else {
          throw new Error(`LLM response does not contain valid JSON: ${content.substring(0, 200)}...`);
        }
      }

      return this.validateParsedData(parsedData);
    } catch (error) {
      throw new Error(`PRP parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildPRPParsingPrompt(
    prpContent: string, 
    config: PRPParsingConfig,
    projectContext?: string
  ): string {
    const contextSection = config.include_context && projectContext 
      ? `\n\n**Project Context:**\n${projectContext}\n` 
      : '';

    const acceptanceCriteriaInstruction = config.extract_acceptance_criteria
      ? '\n- Extract acceptance criteria for each task where available'
      : '';

    const hoursEstimationInstruction = config.estimate_hours
      ? '\n- Provide estimated hours for each task based on complexity'
      : '';

    const tagsInstruction = config.suggest_tags
      ? '\n- Suggest relevant tags for organization and categorization'
      : '';

    return `You are a expert project management assistant that extracts actionable tasks and project information from Product Requirement Prompts (PRPs).

${contextSection}

**Instructions:**
Please analyze the following PRP and extract:
1. Project information (name, description, goals, why statement, target users)
2. Actionable tasks with priorities, descriptions, and dependencies${acceptanceCriteriaInstruction}${hoursEstimationInstruction}
3. Supporting documentation organized by type
4. Suggested tags for organization${tagsInstruction}

**Important Requirements:**
- Extract ONLY actionable, specific tasks (not high-level goals)
- Prioritize tasks based on dependencies and importance
- Include detailed descriptions for complex tasks
- Identify task dependencies based on logical workflow
- Categorize documentation appropriately

**Response Format:**
Return ONLY valid JSON in this exact structure (no additional text or formatting):

{
  "project_info": {
    "name": "Clear, concise project name",
    "description": "Brief project description",
    "goals": "Main project goals and objectives",
    "why_statement": "Why this project matters and its value proposition",
    "target_users": "Who will use or benefit from this project"
  },
  "tasks": [
    {
      "title": "Specific, actionable task title",
      "description": "Detailed task description with implementation guidance",
      "priority": "low|medium|high|urgent",
      "estimated_hours": 8,
      "tags": ["relevant", "tags"],
      "dependencies": ["Other task titles this depends on"],
      "acceptance_criteria": ["Specific criteria for task completion"]
    }
  ],
  "documentation": [
    {
      "type": "goals|why|target_users|specifications|notes",
      "title": "Document title",
      "content": "Detailed content for this documentation section"
    }
  ],
  "suggested_tags": ["project", "feature", "backend", "frontend", "database"]
}

**PRP Content to Parse:**
${prpContent}

Remember: Return ONLY the JSON response with no additional formatting, explanations, or markdown.`;
  }

  private validateParsedData(data: any): any {
    // Basic structure validation
    if (!data || typeof data !== 'object') {
      throw new Error('Response is not a valid object');
    }

    const requiredFields = ['project_info', 'tasks', 'documentation', 'suggested_tags'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate project_info
    if (!data.project_info || typeof data.project_info !== 'object') {
      throw new Error('project_info must be an object');
    }

    const requiredProjectFields = ['name', 'description', 'goals', 'why_statement', 'target_users'];
    for (const field of requiredProjectFields) {
      if (typeof data.project_info[field] !== 'string') {
        throw new Error(`project_info.${field} must be a string`);
      }
    }

    // Validate tasks array
    if (!Array.isArray(data.tasks)) {
      throw new Error('tasks must be an array');
    }

    for (let i = 0; i < data.tasks.length; i++) {
      const task = data.tasks[i];
      if (!task.title || typeof task.title !== 'string') {
        throw new Error(`Task ${i}: title is required and must be a string`);
      }
      if (!task.description || typeof task.description !== 'string') {
        throw new Error(`Task ${i}: description is required and must be a string`);
      }
      if (!['low', 'medium', 'high', 'urgent'].includes(task.priority)) {
        throw new Error(`Task ${i}: priority must be one of: low, medium, high, urgent`);
      }
    }

    // Validate documentation array
    if (!Array.isArray(data.documentation)) {
      throw new Error('documentation must be an array');
    }

    // Validate suggested_tags array
    if (!Array.isArray(data.suggested_tags)) {
      throw new Error('suggested_tags must be an array');
    }

    return data;
  }

  getMetrics(): AnthropicAPIMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }
}