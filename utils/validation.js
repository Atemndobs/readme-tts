import { defaultSettings } from './settings.js';

export function validateSettings(settings) {
  const validatedSettings = { ...defaultSettings };

  if (typeof settings !== 'object' || !settings) {
    throw new Error('Invalid settings object');
  }

  // Validate voice
  if (typeof settings.voice === 'string') {
    validatedSettings.voice = settings.voice;
  }

  // Validate model
  if (typeof settings.model === 'string') {
    validatedSettings.model = settings.model;
  }

  // Validate darkMode
  if (typeof settings.darkMode === 'boolean') {
    validatedSettings.darkMode = settings.darkMode;
  }

  // Validate lastSync
  if (typeof settings.lastSync === 'number' && !isNaN(settings.lastSync)) {
    validatedSettings.lastSync = settings.lastSync;
  }

  // Validate syncEnabled
  if (typeof settings.syncEnabled === 'boolean') {
    validatedSettings.syncEnabled = settings.syncEnabled;
  }

  // Validate pwaUrl
  if (typeof settings.pwaUrl === 'string') {
    try {
      new URL(settings.pwaUrl);
      validatedSettings.pwaUrl = settings.pwaUrl;
    } catch (error) {
      if (settings.pwaUrl !== '') {
        throw new Error('Invalid PWA URL');
      }
    }
  }

  return validatedSettings;
}

export function validateQueueItem(item) {
  if (typeof item !== 'object' || !item) {
    throw new Error('Invalid queue item');
  }

  if (typeof item.id !== 'string' || !item.id) {
    throw new Error('Queue item must have a valid ID');
  }

  if (typeof item.text !== 'string' || !item.text) {
    throw new Error('Queue item must have valid text');
  }

  if (typeof item.voice !== 'string' || !item.voice) {
    throw new Error('Queue item must have a valid voice');
  }

  if (!['pending', 'ready', 'playing', 'error'].includes(item.status)) {
    throw new Error('Queue item must have a valid status');
  }

  if (typeof item.timestamp !== 'number' || isNaN(item.timestamp)) {
    throw new Error('Queue item must have a valid timestamp');
  }

  return {
    id: item.id,
    text: item.text,
    voice: item.voice,
    status: item.status,
    timestamp: item.timestamp
  };
}
