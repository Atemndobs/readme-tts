// Import required modules
import { validateSettings, validateQueueItem } from './utils/validation.js';
import { defaultSettings } from './utils/settings.js';
import { retry } from './utils/retry.js';

// Storage manager class
class StorageManager {
  constructor() {
    this.listeners = new Set();
  }

  async getSettings() {
    try {
      const data = await chrome.storage.sync.get('settings');
      return data.settings || defaultSettings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return defaultSettings;
    }
  }

  async saveSettings(settings) {
    try {
      // Validate settings
      validateSettings(settings);
      
      // Save settings
      console.log("Saving settings:", settings);
      await chrome.storage.sync.set({ settings });
      console.log("Settings saved successfully");
      
      // Notify listeners
      this.notifyListeners('settings', settings);
      
      return settings;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  async getQueue() {
    try {
      const data = await chrome.storage.local.get('queue');
      return data.queue || [];
    } catch (error) {
      console.error('Error getting queue:', error);
      return [];
    }
  }

  async addToQueue(item) {
    try {
      // Validate queue item
      const validatedItem = validateQueueItem(item);
      
      // Get current queue
      const queue = await this.getQueue();
      
      // Add item to queue
      queue.push(validatedItem);
      
      // Save updated queue
      await chrome.storage.local.set({ queue });
      
      // Notify listeners
      this.notifyListeners('queue', queue);
      
      return validatedItem;
    } catch (error) {
      console.error('Error adding to queue:', error);
      throw error;
    }
  }

  async removeFromQueue(itemId) {
    try {
      // Get current queue
      const queue = await this.getQueue();
      
      // Remove item from queue
      const newQueue = queue.filter(item => item.id !== itemId);
      
      // Save updated queue
      await chrome.storage.local.set({ queue: newQueue });
      
      // Notify listeners
      this.notifyListeners('queue', newQueue);
      
      return newQueue;
    } catch (error) {
      console.error('Error removing from queue:', error);
      throw error;
    }
  }

  async updateQueueItem(itemId, updates) {
    try {
      // Get current queue
      const queue = await this.getQueue();
      
      // Find and update item
      const newQueue = queue.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates };
          return validateQueueItem(updatedItem);
        }
        return item;
      });
      
      // Save updated queue
      await chrome.storage.local.set({ queue: newQueue });
      
      // Notify listeners
      this.notifyListeners('queue', newQueue);
      
      return newQueue;
    } catch (error) {
      console.error('Error updating queue item:', error);
      throw error;
    }
  }

  async clearQueue() {
    try {
      // Clear queue
      await chrome.storage.local.set({ queue: [] });
      
      // Notify listeners
      this.notifyListeners('queue', []);
      
      return [];
    } catch (error) {
      console.error('Error clearing queue:', error);
      throw error;
    }
  }

  async syncWithPWA() {
    const settings = await this.getSettings();
    if (!settings.syncEnabled || !settings.pwaUrl) {
      throw new Error('Sync is not enabled or PWA URL is not set');
    }

    try {
      const response = await retry(async () => {
        const result = await fetch(settings.pwaUrl + '/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            queue: await this.getQueue(),
            settings: settings
          })
        });

        if (!result.ok) {
          throw new Error(`Sync failed: ${result.statusText}`);
        }

        return await result.json();
      });

      // Update local data with server response
      await this.saveSettings(response.settings);
      await chrome.storage.local.set({ queue: response.queue });

      return response;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyListeners(type, data) {
    this.listeners.forEach(callback => {
      try {
        callback(type, data);
      } catch (error) {
        console.error('Error in storage listener:', error);
      }
    });
  }
}

// Create singleton instance
const storageInstance = new StorageManager();

// For ES modules
export const Storage = storageInstance;

// For service workers
if (typeof self !== 'undefined') {
  self.Storage = storageInstance;
}
