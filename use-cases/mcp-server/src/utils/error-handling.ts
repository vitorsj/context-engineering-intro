import type { TaskmasterError } from "../types/taskmaster.js";

/**
 * Centralized error handling utilities for Taskmaster MCP Server
 */

// Error type classification
export enum ErrorCategory {
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  DATABASE = 'database',
  LLM = 'llm',
  NOT_FOUND = 'not_found',
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  INTERNAL = 'internal'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Enhanced error interface
export interface EnhancedError extends TaskmasterError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  user_message: string;
  technical_message: string;
  recovery_suggestions: string[];
  error_code?: string;
  correlation_id?: string;
}

/**
 * Safely execute LLM operations with comprehensive error handling
 */
export async function safeLLMOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'LLM Operation',
  correlationId?: string
): Promise<T> {
  const startTime = Date.now();
  
  try {
    console.log(`${operationName} started`, { correlation_id: correlationId });
    
    const result = await operation();
    
    const duration = Date.now() - startTime;
    console.log(`${operationName} completed successfully in ${duration}ms`, { 
      correlation_id: correlationId 
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const enhancedError = enhanceError(error, operationName, correlationId);
    
    console.error(`${operationName} failed after ${duration}ms`, {
      error: enhancedError,
      correlation_id: correlationId
    });
    
    throw createUserFriendlyError(enhancedError);
  }
}

/**
 * Safely execute database operations with error handling and recovery
 */
export async function safeDatabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'Database Operation',
  correlationId?: string
): Promise<T> {
  const startTime = Date.now();
  
  try {
    console.log(`${operationName} started`, { correlation_id: correlationId });
    
    const result = await operation();
    
    const duration = Date.now() - startTime;
    console.log(`${operationName} completed successfully in ${duration}ms`, { 
      correlation_id: correlationId 
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const enhancedError = enhanceError(error, operationName, correlationId);
    
    console.error(`${operationName} failed after ${duration}ms`, {
      error: enhancedError,
      correlation_id: correlationId
    });
    
    throw createUserFriendlyError(enhancedError);
  }
}

/**
 * Enhanced error analysis and classification
 */
function enhanceError(
  error: unknown, 
  operationName: string, 
  correlationId?: string
): EnhancedError {
  const baseError = error instanceof Error ? error : new Error(String(error));
  const message = baseError.message.toLowerCase();
  
  // Categorize error based on message content
  let category: ErrorCategory;
  let severity: ErrorSeverity;
  let userMessage: string;
  let recoverySuggestions: string[];
  let errorCode: string | undefined;
  
  // LLM-specific errors
  if (message.includes('rate_limit') || message.includes('rate limit')) {
    category = ErrorCategory.RATE_LIMIT;
    severity = ErrorSeverity.MEDIUM;
    userMessage = 'API rate limit exceeded. Please wait a moment before trying again.';
    recoverySuggestions = [
      'Wait 60 seconds before retrying',
      'Try with shorter content if parsing a large PRP',
      'Consider breaking large operations into smaller chunks'
    ];
    errorCode = 'LLM_RATE_LIMIT';
  } else if (message.includes('authentication') || message.includes('api key') || message.includes('invalid_api_key')) {
    category = ErrorCategory.AUTHENTICATION;
    severity = ErrorSeverity.HIGH;
    userMessage = 'API authentication failed. Please check the configuration.';
    recoverySuggestions = [
      'Contact administrator to verify API key configuration',
      'Check if API key has expired or been revoked'
    ];
    errorCode = 'LLM_AUTH_FAILED';
  } else if (message.includes('timeout') || message.includes('timed out')) {
    category = ErrorCategory.NETWORK;
    severity = ErrorSeverity.MEDIUM;
    userMessage = 'Request timed out. Please try again with shorter content.';
    recoverySuggestions = [
      'Retry the operation',
      'Try with shorter or simpler content',
      'Check network connectivity'
    ];
    errorCode = 'OPERATION_TIMEOUT';
  } else if (message.includes('json') || message.includes('parse')) {
    category = ErrorCategory.LLM;
    severity = ErrorSeverity.MEDIUM;
    userMessage = 'Failed to parse AI response. The content may be too complex.';
    recoverySuggestions = [
      'Try simplifying the input content',
      'Retry the operation as this may be a temporary issue',
      'Break complex content into smaller sections'
    ];
    errorCode = 'LLM_PARSE_ERROR';
  }
  
  // Database-specific errors
  else if (message.includes('database') || message.includes('postgres') || message.includes('sql')) {
    category = ErrorCategory.DATABASE;
    severity = ErrorSeverity.HIGH;
    userMessage = 'Database operation failed. Please try again.';
    recoverySuggestions = [
      'Retry the operation',
      'Check if all required fields are provided',
      'Contact administrator if problem persists'
    ];
    errorCode = 'DATABASE_ERROR';
  } else if (message.includes('not found') || message.includes('does not exist')) {
    category = ErrorCategory.NOT_FOUND;
    severity = ErrorSeverity.LOW;
    userMessage = 'The requested resource was not found.';
    recoverySuggestions = [
      'Verify the ID or name is correct',
      'Check if the resource was recently deleted',
      'Use list operations to find the correct resource'
    ];
    errorCode = 'RESOURCE_NOT_FOUND';
  } else if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
    category = ErrorCategory.PERMISSION;
    severity = ErrorSeverity.MEDIUM;
    userMessage = 'You do not have permission to perform this operation.';
    recoverySuggestions = [
      'Contact administrator for additional permissions',
      'Try a read-only operation instead',
      'Check if you are assigned to this project or task'
    ];
    errorCode = 'INSUFFICIENT_PERMISSIONS';
  } else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    category = ErrorCategory.VALIDATION;
    severity = ErrorSeverity.LOW;
    userMessage = 'Input validation failed. Please check your data and try again.';
    recoverySuggestions = [
      'Review the input parameters and format',
      'Check that all required fields are provided',
      'Verify data types and constraints'
    ];
    errorCode = 'VALIDATION_ERROR';
  }
  
  // Generic/unknown errors
  else {
    category = ErrorCategory.INTERNAL;
    severity = ErrorSeverity.HIGH;
    userMessage = 'An unexpected error occurred. Please try again.';
    recoverySuggestions = [
      'Retry the operation',
      'Contact administrator if problem persists',
      'Check the system status'
    ];
    errorCode = 'INTERNAL_ERROR';
  }
  
  return {
    type: category,
    message: userMessage,
    details: {
      operation: operationName,
      original_error: baseError.message,
      correlation_id: correlationId,
      error_code: errorCode,
      timestamp: new Date().toISOString()
    },
    category,
    severity,
    user_message: userMessage,
    technical_message: baseError.message,
    recovery_suggestions: recoverySuggestions,
    error_code: errorCode,
    correlation_id: correlationId
  };
}

/**
 * Create user-friendly error for MCP response
 */
function createUserFriendlyError(enhancedError: EnhancedError): Error {
  const errorMessage = `${enhancedError.user_message}

**What happened:** ${enhancedError.technical_message}

**What you can do:**
${enhancedError.recovery_suggestions.map(suggestion => `• ${suggestion}`).join('\n')}

**Error Code:** ${enhancedError.error_code || 'UNKNOWN'}
**Correlation ID:** ${enhancedError.correlation_id || 'N/A'}`;

  const error = new Error(errorMessage);
  error.name = `${enhancedError.category.toUpperCase()}_ERROR`;
  
  return error;
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unknown error occurred';
  }
  
  const message = error.message.toLowerCase();
  
  // Remove sensitive information patterns
  const sensitivePatterns = [
    /password[=:\s]+[^\s]+/gi,
    /api[_\s]?key[=:\s]+[^\s]+/gi,
    /secret[=:\s]+[^\s]+/gi,
    /token[=:\s]+[^\s]+/gi,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, // Email addresses
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP addresses
    /postgresql:\/\/[^\s]+/gi, // Database URLs
  ];
  
  let sanitized = error.message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
}

/**
 * Generate correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log error with appropriate level based on severity
 */
export function logError(error: EnhancedError | Error, context?: Record<string, any>): void {
  const logContext = {
    timestamp: new Date().toISOString(),
    ...context
  };
  
  if ('severity' in error) {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('[CRITICAL]', error, logContext);
        break;
      case ErrorSeverity.HIGH:
        console.error('[HIGH]', error, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('[MEDIUM]', error, logContext);
        break;
      case ErrorSeverity.LOW:
        console.info('[LOW]', error, logContext);
        break;
    }
  } else {
    console.error('[ERROR]', error, logContext);
  }
}

/**
 * Check if error is retryable based on category
 */
export function isRetryableError(error: EnhancedError | Error): boolean {
  if (!('category' in error)) return false;
  
  const retryableCategories = [
    ErrorCategory.NETWORK,
    ErrorCategory.RATE_LIMIT,
    ErrorCategory.LLM // Some LLM errors are retryable
  ];
  
  return retryableCategories.includes(error.category);
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(attempt: number, baseDelay: number = 1000): number {
  const maxDelay = 30000; // 30 seconds max
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Create standardized MCP error response
 */
export function createMCPErrorResponse(error: unknown, operationName?: string): any {
  const enhancedError = error instanceof Error 
    ? enhanceError(error, operationName || 'Operation') 
    : enhanceError(new Error(String(error)), operationName || 'Operation');
  
  return {
    content: [{
      type: "text",
      text: `**Error**\n\n${enhancedError.user_message}\n\n**Recovery Options:**\n${enhancedError.recovery_suggestions.map(s => `• ${s}`).join('\n')}\n\n**Error Code:** ${enhancedError.error_code || 'UNKNOWN'}`,
      isError: true
    }]
  };
}