import { Settings, QueueItem } from '../storage';

// Validation error class
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Type guards
export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean';
}

export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

// Sanitization functions
export function sanitizeString(value: any, maxLength: number = 1000): string {
  if (!isString(value)) {
    throw new ValidationError('Value must be a string', 'string', value);
  }
  return value.slice(0, maxLength).trim();
}

export function sanitizeBoolean(value: any): boolean {
  if (isBoolean(value)) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ValidationError('Value must be a boolean', 'boolean', value);
}

export function sanitizeNumber(value: any, min?: number, max?: number): number {
  let num: number;
  if (isString(value)) {
    num = Number(value);
  } else if (isNumber(value)) {
    num = value;
  } else {
    throw new ValidationError('Value must be a number', 'number', value);
  }

  if (isNaN(num)) {
    throw new ValidationError('Value must be a valid number', 'number', value);
  }

  if (min !== undefined && num < min) {
    throw new ValidationError(`Value must be at least ${min}`, 'number', value);
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(`Value must be at most ${max}`, 'number', value);
  }

  return num;
}

// Settings validation
export function validateSettings(settings: Partial<Settings>): Settings {
  const validatedSettings: Partial<Settings> = {};

  if (settings.voice !== undefined) {
    validatedSettings.voice = sanitizeString(settings.voice, 100);
  }

  if (settings.model !== undefined) {
    validatedSettings.model = sanitizeString(settings.model, 100);
  }

  if (settings.darkMode !== undefined) {
    validatedSettings.darkMode = sanitizeBoolean(settings.darkMode);
  }

  if (settings.lastSync !== undefined) {
    validatedSettings.lastSync = sanitizeNumber(settings.lastSync, 0);
  }

  if (settings.syncEnabled !== undefined) {
    validatedSettings.syncEnabled = sanitizeBoolean(settings.syncEnabled);
  }

  if (settings.pwaUrl !== undefined) {
    const url = sanitizeString(settings.pwaUrl, 500);
    try {
      new URL(url); // Validate URL format
      validatedSettings.pwaUrl = url;
    } catch {
      throw new ValidationError('Invalid URL format', 'pwaUrl', settings.pwaUrl);
    }
  }

  return validatedSettings as Settings;
}

// Queue item validation
export function validateQueueItem(item: Partial<QueueItem>): QueueItem {
  const validatedItem: Partial<QueueItem> = {};

  if (item.id !== undefined) {
    validatedItem.id = sanitizeString(item.id, 50);
  }

  if (item.text !== undefined) {
    validatedItem.text = sanitizeString(item.text, 10000); // 10K chars max
  }

  if (item.voice !== undefined) {
    validatedItem.voice = sanitizeString(item.voice, 100);
  }

  if (item.status !== undefined) {
    const status = sanitizeString(item.status, 20);
    if (!['pending', 'ready', 'playing', 'error'].includes(status)) {
      throw new ValidationError(
        'Invalid status value',
        'status',
        item.status
      );
    }
    validatedItem.status = status as QueueItem['status'];
  }

  if (item.timestamp !== undefined) {
    validatedItem.timestamp = sanitizeNumber(item.timestamp, 0);
  }

  return validatedItem as QueueItem;
}

// Queue validation
export function validateQueue(queue: QueueItem[]): QueueItem[] {
  if (!Array.isArray(queue)) {
    throw new ValidationError('Queue must be an array', 'queue', queue);
  }

  // Validate each item and remove duplicates
  const seen = new Set<string>();
  return queue
    .map(item => validateQueueItem(item))
    .filter(item => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

// PWA data validation
export function validatePWAData(data: any): any {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invalid PWA data format', 'pwaData', data);
  }

  const validated: any = {};

  // Validate settings if present
  if (data.settings) {
    validated.settings = validateSettings(data.settings);
  }

  // Validate queue if present
  if (data.queue) {
    validated.queue = validateQueue(data.queue);
  }

  // Validate timestamp if present
  if (data.timestamp !== undefined) {
    validated.timestamp = sanitizeNumber(data.timestamp, 0);
  }

  return validated;
}
