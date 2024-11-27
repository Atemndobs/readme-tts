// Retry configuration interface
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors?: Array<string | RegExp>;
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000,   // 30 seconds
  backoffFactor: 2,
  retryableErrors: [
    'Network request failed',
    'Failed to fetch',
    'timeout',
    /^5\d{2}$/,      // 5XX server errors
    'ECONNRESET',
    'ETIMEDOUT'
  ]
};

// Error with retry information
export class RetryError extends Error {
  constructor(
    message: string,
    public originalError: Error,
    public attempts: number
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

// Check if an error is retryable
function isRetryableError(error: Error, config: RetryConfig): boolean {
  const errorString = error.message.toLowerCase();
  return config.retryableErrors?.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(errorString);
    }
    return errorString.includes(pattern.toLowerCase());
  }) ?? true;
}

// Calculate delay with exponential backoff
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelay * Math.pow(config.backoffFactor, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

// Sleep function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry function with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (
        attempt === fullConfig.maxAttempts || 
        !isRetryableError(error, fullConfig)
      ) {
        break;
      }
      
      // Calculate and apply delay
      const delay = calculateDelay(attempt, fullConfig);
      console.log(
        `Retry attempt ${attempt}/${fullConfig.maxAttempts} ` +
        `after ${delay}ms for error: ${error.message}`
      );
      
      await sleep(delay);
    }
  }
  
  throw new RetryError(
    `Operation failed after ${fullConfig.maxAttempts} attempts`,
    lastError!,
    fullConfig.maxAttempts
  );
}
