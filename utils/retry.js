const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 1000;
const DEFAULT_MAX_DELAY = 10000;

export async function retry(operation, maxRetries = DEFAULT_MAX_RETRIES) {
  let lastError;
  let delay = DEFAULT_INITIAL_DELAY;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        delay = Math.min(delay * 2, DEFAULT_MAX_DELAY);
        const jitter = Math.random() * 200;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError;
}
