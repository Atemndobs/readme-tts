import { Storage } from './storage';
import { RetryError } from './utils/retry';
import { ValidationError } from './utils/validation';

// Sync status tracking
interface SyncStatus {
  lastAttempt: number;
  lastSuccess: number;
  consecutiveFailures: number;
  isRetrying: boolean;
  error?: string;
  validationError?: string;
}

let syncStatus: SyncStatus = {
  lastAttempt: 0,
  lastSuccess: 0,
  consecutiveFailures: 0,
  isRetrying: false
};

// Initialize sync worker
async function initializeSyncWorker() {
  try {
    // Start periodic sync (every 5 minutes)
    Storage.startPeriodicSync();

    // Listen for manual sync requests
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'sync') {
        handleManualSync(sendResponse);
        return true; // Will respond asynchronously
      } else if (request.action === 'getSyncStatus') {
        sendResponse(syncStatus);
        return false;
      }
    });

    // Listen for network status changes
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    console.log('Sync worker initialized');
  } catch (error) {
    console.error('Error initializing sync worker:', error);
    updateSyncStatus({ error });
  }
}

// Update sync status
function updateSyncStatus(update: {
  success?: boolean;
  error?: Error;
  isRetrying?: boolean;
  validationError?: ValidationError;
}) {
  const now = Date.now();
  
  syncStatus = {
    ...syncStatus,
    lastAttempt: now,
    isRetrying: update.isRetrying ?? syncStatus.isRetrying
  };

  if (update.success) {
    syncStatus.lastSuccess = now;
    syncStatus.consecutiveFailures = 0;
    syncStatus.isRetrying = false;
  } else if (update.error || update.validationError) {
    syncStatus.consecutiveFailures++;
    
    // Don't retry on validation errors
    if (update.validationError) {
      syncStatus.isRetrying = false;
    }
  }

  // Notify any listeners about the status change
  chrome.runtime.sendMessage({
    action: 'syncStatusChanged',
    status: {
      ...syncStatus,
      error: update.error?.message || update.validationError?.message
    }
  }).catch(() => {}); // Ignore errors if no listeners
}

// Handle manual sync requests
async function handleManualSync(sendResponse: (response: any) => void) {
  try {
    updateSyncStatus({ isRetrying: true });
    const result = await Storage.syncWithPWA();
    
    updateSyncStatus({ 
      success: result.success,
      error: result.success ? undefined : new Error(result.error)
    });
    
    sendResponse(result);
  } catch (error) {
    const isRetryError = error instanceof RetryError;
    const isValidationError = error instanceof ValidationError;
    
    updateSyncStatus({ 
      error: isValidationError ? undefined : error,
      validationError: isValidationError ? error : undefined,
      isRetrying: !isRetryError && !isValidationError
    });
    
    sendResponse({
      success: false,
      error: isValidationError ?
        `Data validation failed: ${error.message} (${error.field})` :
        isRetryError ?
          `Sync failed after ${error.attempts} attempts. Last error: ${error.originalError.message}` :
          error.message,
      timestamp: Date.now()
    });
  }
}

// Handle network status changes
async function handleNetworkChange() {
  const settings = await Storage.getSettings();
  if (!settings.syncEnabled) return;

  if (navigator.onLine) {
    console.log('Network connection restored, syncing...');
    try {
      updateSyncStatus({ isRetrying: true });
      const result = await Storage.syncWithPWA();
      updateSyncStatus({ 
        success: result.success,
        error: result.success ? undefined : new Error(result.error)
      });
    } catch (error) {
      const isValidationError = error instanceof ValidationError;
      updateSyncStatus({ 
        error: isValidationError ? undefined : error,
        validationError: isValidationError ? error : undefined
      });
      console.error('Error syncing after network restore:', error);
    }
  } else {
    console.log('Network connection lost, sync paused');
    updateSyncStatus({ 
      error: new Error('Network connection lost'),
      isRetrying: false 
    });
  }
}

// Initialize the sync worker
initializeSyncWorker();
