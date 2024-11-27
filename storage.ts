// Types for our storage
export interface Settings {
  voice: string;
  model: string;
  darkMode: boolean;
  lastSync: number;
  syncEnabled: boolean;  // New: Enable/disable sync with PWA
  pwaUrl: string;       // New: PWA URL for sync
}

export interface QueueItem {
  id: string;
  text: string;
  voice: string;
  status: 'pending' | 'ready' | 'playing' | 'error';
  timestamp: number;
}

export interface StorageState {
  settings: Settings;
  queue: QueueItem[];
}

// Default settings
export const defaultSettings: Settings = {
  voice: "voice-en-us-amy-low",
  model: "voice-en-us",
  darkMode: false,
  lastSync: 0,
  syncEnabled: false,
  pwaUrl: "https://voice.cloud.atemkeng.de"
};

// Storage keys
const STORAGE_KEYS = {
  SETTINGS: 'readme-settings',
  QUEUE: 'readme-queue',
  LAST_SYNC: 'last-sync',
  SYNC_TOKEN: 'sync-token'  // New: Store PWA auth token
} as const;

// PWA Sync Protocol
interface SyncResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

import { withRetry, RetryError, RetryConfig } from './utils/retry';
import {
  validateSettings,
  validateQueue,
  validateQueueItem,
  validatePWAData,
  ValidationError
} from './utils/validation';

// Storage wrapper class
export class Storage {
  // Custom retry config for storage operations
  private static readonly SYNC_RETRY_CONFIG: Partial<RetryConfig> = {
    maxAttempts: 5,
    initialDelay: 2000,  // 2 seconds
    maxDelay: 60000,     // 1 minute
    retryableErrors: [
      ...DEFAULT_RETRY_CONFIG.retryableErrors!,
      'QuotaExceededError',
      'QUOTA_BYTES_PER_ITEM quota exceeded'
    ]
  };

  static async getSettings(): Promise<Settings> {
    return withRetry(async () => {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      const settings = { ...defaultSettings, ...result[STORAGE_KEYS.SETTINGS] };
      return validateSettings(settings);
    }, this.SYNC_RETRY_CONFIG);
  }

  static async saveSettings(settings: Partial<Settings>): Promise<void> {
    return withRetry(async () => {
      // Validate new settings
      const validatedSettings = validateSettings(settings);
      
      // Merge with current settings
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...validatedSettings };
      
      await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
      this.notifySettingsChanged(newSettings);
    }, this.SYNC_RETRY_CONFIG);
  }

  static async getQueue(): Promise<QueueItem[]> {
    return withRetry(async () => {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.QUEUE);
      const queue = result[STORAGE_KEYS.QUEUE] || [];
      return validateQueue(queue);
    }, this.SYNC_RETRY_CONFIG);
  }

  static async saveQueue(queue: QueueItem[]): Promise<void> {
    return withRetry(async () => {
      const validatedQueue = validateQueue(queue);
      await chrome.storage.sync.set({ [STORAGE_KEYS.QUEUE]: validatedQueue });
      this.notifyQueueChanged(validatedQueue);
    }, this.SYNC_RETRY_CONFIG);
  }

  static async addToQueue(item: Omit<QueueItem, 'id' | 'timestamp'>): Promise<void> {
    const queue = await this.getQueue();
    const validatedItem = validateQueueItem({
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    });
    
    await this.saveQueue([validatedItem, ...queue]);
  }

  static async removeFromQueue(id: string): Promise<void> {
    const queue = await this.getQueue();
    const newQueue = queue.filter(item => item.id !== id);
    await this.saveQueue(newQueue);
  }

  static async clearQueue(): Promise<void> {
    await this.saveQueue([]);
  }

  // New methods for PWA synchronization
  static async initializeSync(pwaUrl: string): Promise<void> {
    await this.saveSettings({ 
      pwaUrl, 
      syncEnabled: true,
      lastSync: Date.now() 
    });
  }

  static async syncWithPWA(): Promise<SyncResponse> {
    try {
      const settings = await this.getSettings();
      if (!settings.syncEnabled || !settings.pwaUrl) {
        return { 
          success: false, 
          error: 'Sync not enabled or PWA URL not set',
          timestamp: Date.now()
        };
      }

      return await withRetry(async () => {
        // Get and validate local data
        const queue = await this.getQueue();
        const lastSync = settings.lastSync;

        // Prepare sync payload
        const syncData = {
          settings: {
            voice: settings.voice,
            model: settings.model,
            darkMode: settings.darkMode
          },
          queue,
          lastSync
        };

        // Send data to PWA with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const response = await fetch(`${settings.pwaUrl}/api/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Extension-Sync': 'true'
            },
            body: JSON.stringify(syncData),
            signal: controller.signal
          });

          if (!response.ok) {
            throw new Error(`PWA sync failed: ${response.statusText}`);
          }

          const pwaData = await response.json();
          
          // Validate PWA response data
          const validatedPWAData = validatePWAData(pwaData);

          // Merge PWA data with local data
          await this.mergeWithPWA(validatedPWAData);

          // Update last sync timestamp
          await this.saveSettings({ lastSync: Date.now() });

          return {
            success: true,
            data: validatedPWAData,
            timestamp: Date.now()
          };
        } finally {
          clearTimeout(timeoutId);
        }
      }, this.SYNC_RETRY_CONFIG);
    } catch (error) {
      console.error('Error syncing with PWA:', error);
      
      let errorMessage = error.message;
      if (error instanceof ValidationError) {
        errorMessage = `Data validation failed: ${error.message} (${error.field})`;
      } else if (error instanceof RetryError) {
        errorMessage = `Sync failed after ${error.attempts} attempts. Last error: ${error.originalError.message}`;
      }
      
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }

  private static async mergeWithPWA(pwaData: any): Promise<void> {
    return withRetry(async () => {
      // Validate PWA data before merging
      const validatedPWAData = validatePWAData(pwaData);
      
      const localSettings = await this.getSettings();
      const localQueue = await this.getQueue();

      // Merge settings (PWA settings take precedence for shared fields)
      const mergedSettings = validateSettings({
        ...localSettings,
        ...validatedPWAData.settings,
        lastSync: Date.now()
      });

      // Merge queues (combine both and remove duplicates by id)
      const mergedQueue = validateQueue([
        ...localQueue,
        ...validatedPWAData.queue
      ]);

      // Save merged data
      await Promise.all([
        this.saveSettings(mergedSettings),
        this.saveQueue(mergedQueue)
      ]);

      // Notify listeners of changes
      this.notifySettingsChanged(mergedSettings);
      this.notifyQueueChanged(mergedQueue);
    }, this.SYNC_RETRY_CONFIG);
  }

  // Add periodic sync
  static startPeriodicSync(intervalMs: number = 5 * 60 * 1000): void {
    setInterval(async () => {
      const settings = await this.getSettings();
      if (settings.syncEnabled) {
        await this.syncWithPWA();
      }
    }, intervalMs);
  }

  // Event handling for storage changes
  private static listeners: { [key: string]: Function[] } = {
    settings: [],
    queue: []
  };

  static onSettingsChanged(callback: (settings: Settings) => void): void {
    this.listeners.settings.push(callback);
  }

  static onQueueChanged(callback: (queue: QueueItem[]) => void): void {
    this.listeners.queue.push(callback);
  }

  private static notifySettingsChanged(settings: Settings): void {
    this.listeners.settings.forEach(callback => callback(settings));
  }

  private static notifyQueueChanged(queue: QueueItem[]): void {
    this.listeners.queue.forEach(callback => callback(queue));
  }

  // Listen for storage changes from other contexts (tabs/windows)
  static init(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;

      if (changes[STORAGE_KEYS.SETTINGS]) {
        this.notifySettingsChanged(changes[STORAGE_KEYS.SETTINGS].newValue);
      }
      if (changes[STORAGE_KEYS.QUEUE]) {
        this.notifyQueueChanged(changes[STORAGE_KEYS.QUEUE].newValue);
      }
    });
  }
}

// Initialize storage change listeners
Storage.init();
