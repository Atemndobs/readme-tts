class RetryError extends Error {
  constructor(message, attempts) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
  }
}

const retry = async (operation, maxAttempts = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw new RetryError(`Operation failed after ${maxAttempts} attempts: ${lastError.message}`, maxAttempts);
};

// For ES modules
export { RetryError, retry };

// For service workers
if (typeof self !== 'undefined') {
  self.Retry = {
    RetryError,
    retry
  };
}
