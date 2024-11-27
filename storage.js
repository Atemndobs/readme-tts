import { defaultSettings } from './utils/settings.js';
import { validateSettings, validateQueueItem } from './utils/validation.js';
import { retry } from './utils/retry.js';

class StorageManager {
  constructor() {
    this.syncStatus = 'synced';
    this.syncError = null;
    this.syncInterval = null;
    this.SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
    this.settingsChangeListeners = new Set();
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) {
        this.notifySettingsChanged(changes.settings.newValue);
      }
    });
  }

  onSettingsChanged(callback) {
    this.settingsChangeListeners.add(callback);
    // Return cleanup function
    return () => this.settingsChangeListeners.delete(callback);
  }

  notifySettingsChanged(settings) {
    this.settingsChangeListeners.forEach(listener => {
      try {
        listener(settings);
      } catch (error) {
        console.error('Error in settings change listener:', error);
      }
    });
  }

  async getSettings() {
    try {
      const result = await chrome.storage.sync.get('settings');
      return result.settings || defaultSettings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return defaultSettings;
    }
  }

  async saveSettings(settings) {
    try {
      const validatedSettings = validateSettings(settings);
      await chrome.storage.sync.set({ settings: validatedSettings });
      this.notifySettingsChanged(validatedSettings);
      this.notifySyncStatusChange('syncing');
      await this.sync();
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      this.notifySyncStatusChange('error', error.message);
      return false;
    }
  }

  async getQueue() {
    try {
      const result = await chrome.storage.sync.get('queue');
      return result.queue || [];
    } catch (error) {
      console.error('Error getting queue:', error);
      return [];
    }
  }

  async addToQueue(item) {
    try {
      const validatedItem = validateQueueItem(item);
      const queue = await this.getQueue();
      queue.push(validatedItem);
      await chrome.storage.sync.set({ queue });
      this.notifySyncStatusChange('syncing');
      await this.sync();
      return true;
    } catch (error) {
      console.error('Error adding to queue:', error);
      this.notifySyncStatusChange('error', error.message);
      return false;
    }
  }

  async removeFromQueue(id) {
    try {
      const queue = await this.getQueue();
      const newQueue = queue.filter(item => item.id !== id);
      await chrome.storage.sync.set({ queue: newQueue });
      this.notifySyncStatusChange('syncing');
      await this.sync();
      return true;
    } catch (error) {
      console.error('Error removing from queue:', error);
      this.notifySyncStatusChange('error', error.message);
      return false;
    }
  }

  async sync() {
    try {
      const settings = await this.getSettings();
      if (!settings.syncEnabled || !settings.pwaUrl) {
        return;
      }

      this.notifySyncStatusChange('syncing');
      
      // Perform sync operation with retry
      await retry(async () => {
        const queue = await this.getQueue();
        const response = await fetch(settings.pwaUrl + '/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            settings,
            queue,
            timestamp: Date.now(),
          }),
        });

        if (!response.ok) {
          throw new Error('Sync failed: ' + response.statusText);
        }

        const result = await response.json();
        await this.handleSyncResponse(result);
      });

      this.notifySyncStatusChange('synced');
    } catch (error) {
      console.error('Sync error:', error);
      this.notifySyncStatusChange('error', error.message);
      throw error;
    }
  }

  async handleSyncResponse(response) {
    try {
      if (response.settings) {
        await this.saveSettings(response.settings);
      }
      if (response.queue) {
        await chrome.storage.sync.set({ queue: response.queue });
      }
    } catch (error) {
      console.error('Error handling sync response:', error);
      throw error;
    }
  }

  notifySyncStatusChange(status, error = null) {
    this.syncStatus = status;
    this.syncError = error;
    chrome.runtime.sendMessage({
      type: 'syncStatusUpdate',
      status,
      error,
    });
  }

  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = setInterval(() => this.sync(), this.SYNC_INTERVAL);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const Storage = new StorageManager();
