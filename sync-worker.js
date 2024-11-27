// Import required modules
import { Storage } from './storage.js';
import { RetryError } from './utils/retry.js';
import { ValidationError } from './utils/validation.js';

// Sync status tracking
let syncStatus = {
  lastAttempt: 0,
  lastSuccess: 0,
  consecutiveFailures: 0,
  isRetrying: false,
  error: null,
  validationError: null
};

// Constants
const MAX_CONSECUTIVE_FAILURES = 5;
const RETRY_DELAY = 60000; // 1 minute
const MAX_RETRY_DELAY = 3600000; // 1 hour

// Update sync status
function updateSyncStatus(update) {
  const now = Date.now();
  syncStatus.lastAttempt = now;
  
  if (update.success) {
    syncStatus.lastSuccess = now;
    syncStatus.consecutiveFailures = 0;
    syncStatus.error = null;
    syncStatus.validationError = null;
    syncStatus.isRetrying = false;
  } else if (update.error) {
    syncStatus.consecutiveFailures++;
    if (update.error instanceof ValidationError) {
      syncStatus.validationError = update.error.message;
    } else if (update.error instanceof RetryError) {
      syncStatus.error = 'Network error, will retry automatically';
    } else {
      syncStatus.error = update.error.message;
    }
  }

  if (typeof update.isRetrying !== 'undefined') {
    syncStatus.isRetrying = update.isRetrying;
  }

  // Notify status change
  chrome.runtime.sendMessage({
    action: 'syncStatusChanged',
    status: syncStatus
  }).catch(error => console.warn('Error sending sync status:', error));
}

// Handle manual sync requests
async function handleManualSync(sendResponse) {
  if (syncStatus.isRetrying) {
    sendResponse({
      success: false,
      error: 'Sync already in progress'
    });
    return;
  }

  try {
    updateSyncStatus({ isRetrying: true });
    const response = await Storage.syncWithPWA();
    updateSyncStatus({ success: true });
    sendResponse({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Manual sync failed:', error);
    updateSyncStatus({ error });
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handle network status changes
async function handleNetworkChange() {
  if (!navigator.onLine || syncStatus.isRetrying) {
    return;
  }

  const settings = await Storage.getSettings();
  if (!settings.syncEnabled || !settings.pwaUrl) {
    return;
  }

  // Check if we should retry based on consecutive failures
  if (syncStatus.consecutiveFailures > 0) {
    const delay = Math.min(
      RETRY_DELAY * Math.pow(2, syncStatus.consecutiveFailures - 1),
      MAX_RETRY_DELAY
    );
    const timeSinceLastAttempt = Date.now() - syncStatus.lastAttempt;
    
    if (timeSinceLastAttempt < delay) {
      return;
    }
  }

  // Attempt sync
  try {
    updateSyncStatus({ isRetrying: true });
    await Storage.syncWithPWA();
    updateSyncStatus({ success: true });
  } catch (error) {
    console.error('Network change sync failed:', error);
    updateSyncStatus({ error });
  }
}

// Initialize sync worker
function initializeSyncWorker() {
  // Listen for manual sync requests
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'manualSync') {
      handleManualSync(sendResponse);
      return true; // Will respond asynchronously
    }
  });

  // Listen for network changes
  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', () => {
    updateSyncStatus({
      error: new Error('Network offline')
    });
  });

  // Initial network check
  if (navigator.onLine) {
    handleNetworkChange();
  }
}

// Initialize the sync worker
initializeSyncWorker();
