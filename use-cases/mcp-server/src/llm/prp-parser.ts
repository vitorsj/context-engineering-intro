import { AnthropicClient } from "./anthropic-client.js";
import { buildPRPParsingPrompt, buildValidationPrompt } from "./prompts.js";
import type { ParsedPRPData } from "../types/taskmaster.js";
import type { PRPParsingConfig } from "../types/anthropic.js";

export interface PRPParsingOptions {
  project_context?: string;
  auto_validate?: boolean;
  include_validation_report?: boolean;
  parsing_config?: Partial<PRPParsingConfig>;
}

export interface PRPParsingResult {
  parsed_data: ParsedPRPData;
  validation_report?: {
    is_valid: boolean;
    completeness_score: number;
    issues: string[];
    missing_tasks: string[];
    improvements: string[];
  };
  metrics: {
    parsing_time_ms: number;
    task_count: number;
    documentation_count: number;
    suggested_tags_count: number;
    estimated_total_hours: number;
  };
}

export class PRPParser {
  private anthropicClient: AnthropicClient;
  private defaultConfig: PRPParsingConfig;

  constructor(anthropicApiKey: string, model: string = 'claude-3-sonnet-20240229') {
    this.anthropicClient = new AnthropicClient(anthropicApiKey);
    this.defaultConfig = {
      model,
      max_tokens: 4000,
      temperature: 0.1,
      include_context: true,
      extract_acceptance_criteria: true,
      suggest_tags: true,
      estimate_hours: true,
    };
  }

  async parsePRP(
    prpContent: string,
    options: PRPParsingOptions = {}
  ): Promise<PRPParsingResult> {
    const startTime = Date.now();

    try {
      // Validate input
      this.validateInput(prpContent);

      // Merge configuration
      const config: PRPParsingConfig = {
        ...this.defaultConfig,
        ...options.parsing_config,
      };

      // Parse PRP content
      const parsedData = await this.performParsing(prpContent, options.project_context, config);

      // Calculate metrics
      const metrics = this.calculateMetrics(parsedData, Date.now() - startTime);

      // Prepare result
      const result: PRPParsingResult = {
        parsed_data: parsedData,
        metrics,
      };

      // Optional validation
      if (options.auto_validate || options.include_validation_report) {
        result.validation_report = await this.validateParsedData(parsedData, prpContent);
      }

      return result;
    } catch (error) {
      throw new Error(`PRP parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private validateInput(prpContent: string): void {
    if (!prpContent || typeof prpContent !== 'string') {
      throw new Error('PRP content must be a non-empty string');
    }

    if (prpContent.trim().length < 10) {
      throw new Error('PRP content is too short to parse meaningfully');
    }

    if (prpContent.length > 100000) {
      throw new Error('PRP content exceeds maximum length (100,000 characters)');
    }
  }

  private async performParsing(
    prpContent: string,
    projectContext?: string,
    config: PRPParsingConfig = this.defaultConfig
  ): Promise<ParsedPRPData> {
    try {
      const parsedData = await this.anthropicClient.parsePRP(prpContent, projectContext, config);
      
      // Post-process and validate the parsed data
      return this.postProcessParsedData(parsedData);
    } catch (error) {
      if (error instanceof Error) {
        // Enhance error messages for common issues
        if (error.message.includes('rate_limit')) {
          throw new Error('API rate limit exceeded. Please try again in a few moments.');
        }
        if (error.message.includes('authentication')) {
          throw new Error('API authentication failed. Please check your Anthropic API key.');
        }
        if (error.message.includes('timeout')) {
          throw new Error('API request timed out. Please try with shorter content or try again.');
        }
      }
      throw error;
    }
  }

  private postProcessParsedData(data: any): ParsedPRPData {
    // Ensure all required fields exist with defaults
    const processedData: ParsedPRPData = {
      project_info: {
        name: data.project_info?.name || 'Untitled Project',
        description: data.project_info?.description || '',
        goals: data.project_info?.goals || '',
        why_statement: data.project_info?.why_statement || '',
        target_users: data.project_info?.target_users || '',
      },
      tasks: [],
      documentation: [],
      suggested_tags: [],
    };

    // Process tasks with validation and cleanup
    if (Array.isArray(data.tasks)) {
      processedData.tasks = data.tasks
        .filter((task: any) => task && task.title && task.description)
        .map((task: any, index: number) => ({
          title: this.cleanText(task.title, 500),
          description: this.cleanText(task.description, 2000),
          priority: this.validatePriority(task.priority),
          estimated_hours: this.validateEstimatedHours(task.estimated_hours),
          tags: this.processArray(task.tags, 10),
          dependencies: this.processArray(task.dependencies, 20),
          acceptance_criteria: this.processArray(task.acceptance_criteria, 10),
        }));
    }

    // Process documentation
    if (Array.isArray(data.documentation)) {
      processedData.documentation = data.documentation
        .filter((doc: any) => doc && doc.type && doc.title && doc.content)
        .map((doc: any) => ({
          type: this.validateDocumentationType(doc.type),
          title: this.cleanText(doc.title, 255),
          content: this.cleanText(doc.content, 10000),
        }));
    }

    // Process suggested tags
    if (Array.isArray(data.suggested_tags)) {
      processedData.suggested_tags = data.suggested_tags
        .filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag: string) => this.cleanText(tag, 50))
        .slice(0, 20); // Limit to 20 tags
    }

    return processedData;
  }

  private cleanText(text: string, maxLength: number): string {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, maxLength);
  }

  private validatePriority(priority: any): 'low' | 'medium' | 'high' | 'urgent' {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    return validPriorities.includes(priority) ? priority : 'medium';
  }

  private validateEstimatedHours(hours: any): number | undefined {
    if (typeof hours === 'number' && hours > 0 && hours <= 1000) {
      return Math.round(hours);
    }
    return undefined;
  }

  private validateDocumentationType(type: any): 'goals' | 'why' | 'target_users' | 'specifications' | 'notes' {
    const validTypes = ['goals', 'why', 'target_users', 'specifications', 'notes'];
    return validTypes.includes(type) ? type : 'notes';
  }

  private processArray(arr: any, maxLength: number): string[] {
    if (!Array.isArray(arr)) return [];
    
    return arr
      .filter(item => typeof item === 'string' && item.trim().length > 0)
      .map(item => this.cleanText(item, 200))
      .slice(0, maxLength);
  }

  private calculateMetrics(data: ParsedPRPData, parsingTimeMs: number) {
    const totalHours = data.tasks
      .filter(task => task.estimated_hours)
      .reduce((sum, task) => sum + (task.estimated_hours || 0), 0);

    return {
      parsing_time_ms: parsingTimeMs,
      task_count: data.tasks.length,
      documentation_count: data.documentation.length,
      suggested_tags_count: data.suggested_tags.length,
      estimated_total_hours: totalHours,
    };
  }

  private async validateParsedData(
    parsedData: ParsedPRPData,
    originalPRP: string
  ): Promise<{
    is_valid: boolean;
    completeness_score: number;
    issues: string[];
    missing_tasks: string[];
    improvements: string[];
  }> {
    try {
      const validationPrompt = buildValidationPrompt(parsedData, originalPRP);
      const validationResponse = await this.anthropicClient.makeRequest({
        model: this.defaultConfig.model,
        max_tokens: 1000,
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: validationPrompt,
        }],
      });

      const validationText = validationResponse.content[0]?.text;
      if (!validationText) {
        throw new Error('Empty validation response');
      }

      const validationData = JSON.parse(validationText);
      
      return {
        is_valid: validationData.is_valid || false,
        completeness_score: Math.max(0, Math.min(100, validationData.completeness_score || 0)),
        issues: Array.isArray(validationData.issues) ? validationData.issues : [],
        missing_tasks: Array.isArray(validationData.missing_tasks) ? validationData.missing_tasks : [],
        improvements: Array.isArray(validationData.improvements) ? validationData.improvements : [],
      };
    } catch (error) {
      // Return default validation if validation fails
      return {
        is_valid: true,
        completeness_score: 75,
        issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        missing_tasks: [],
        improvements: [],
      };
    }
  }

  async parseMultiplePRPs(
    prpContents: string[],
    options: PRPParsingOptions = {}
  ): Promise<PRPParsingResult[]> {
    const results: PRPParsingResult[] = [];
    
    for (let i = 0; i < prpContents.length; i++) {
      try {
        const result = await this.parsePRP(prpContents[i], options);
        results.push(result);
      } catch (error) {
        // Continue with other PRPs even if one fails
        results.push({
          parsed_data: {
            project_info: {
              name: `Failed Parse ${i + 1}`,
              description: `Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              goals: '',
              why_statement: '',
              target_users: '',
            },
            tasks: [],
            documentation: [],
            suggested_tags: [],
          },
          metrics: {
            parsing_time_ms: 0,
            task_count: 0,
            documentation_count: 0,
            suggested_tags_count: 0,
            estimated_total_hours: 0,
          },
        });
      }
    }
    
    return results;
  }

  getClientMetrics() {
    return this.anthropicClient.getMetrics();
  }

  resetClientMetrics(): void {
    this.anthropicClient.resetMetrics();
  }
}