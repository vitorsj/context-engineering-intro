// Anthropic API types and interfaces for PRP parsing

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  temperature?: number;
  messages: AnthropicMessage[];
}

export interface AnthropicResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  id: string;
  model: string;
  role: 'assistant';
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence?: string;
  type: 'message';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicError {
  type: 'error';
  error: {
    type: 'invalid_request_error' | 'authentication_error' | 'permission_error' | 'not_found_error' | 'rate_limit_error' | 'api_error' | 'overloaded_error';
    message: string;
  };
}

// PRP parsing configuration
export interface PRPParsingConfig {
  model: string;
  max_tokens: number;
  temperature: number;
  include_context: boolean;
  extract_acceptance_criteria: boolean;
  suggest_tags: boolean;
  estimate_hours: boolean;
}

export const DEFAULT_PRP_CONFIG: PRPParsingConfig = {
  model: 'claude-3-sonnet-20240229',
  max_tokens: 4000,
  temperature: 0.1, // Low temperature for consistent parsing
  include_context: true,
  extract_acceptance_criteria: true,
  suggest_tags: true,
  estimate_hours: true,
};

// API client configuration
export interface AnthropicClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export const DEFAULT_CLIENT_CONFIG: Partial<AnthropicClientConfig> = {
  baseUrl: 'https://api.anthropic.com/v1',
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

// Rate limiting and error handling types
export interface RateLimitInfo {
  requests_per_minute: number;
  tokens_per_minute: number;
  requests_remaining: number;
  tokens_remaining: number;
  reset_time: Date;
}

export interface AnthropicAPIMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  average_response_time: number;
  rate_limit_hits: number;
}

// Retry strategy configuration
export interface RetryConfig {
  max_attempts: number;
  base_delay: number;
  max_delay: number;
  exponential_backoff: boolean;
  retry_on_rate_limit: boolean;
  retry_on_server_error: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_attempts: 3,
  base_delay: 1000,
  max_delay: 10000,
  exponential_backoff: true,
  retry_on_rate_limit: true,
  retry_on_server_error: true,
};

// Helper type guards
export function isAnthropicError(response: any): response is AnthropicError {
  return response && response.type === 'error' && response.error;
}

export function isAnthropicResponse(response: any): response is AnthropicResponse {
  return response && response.type === 'message' && response.content && Array.isArray(response.content);
}

export function isRateLimitError(error: AnthropicError): boolean {
  return error.error.type === 'rate_limit_error';
}

export function isAuthenticationError(error: AnthropicError): boolean {
  return error.error.type === 'authentication_error';
}

export function isServerError(error: AnthropicError): boolean {
  return ['api_error', 'overloaded_error'].includes(error.error.type);
}