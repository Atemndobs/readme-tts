class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const validateSettings = (settings) => {
  if (!settings) {
    throw new ValidationError('Settings object is required');
  }

  if (typeof settings.voice !== 'string' || settings.voice.trim() === '') {
    throw new ValidationError('Voice must be a non-empty string');
  }

  if (typeof settings.model !== 'string' || settings.model.trim() === '') {
    throw new ValidationError('Model must be a non-empty string');
  }

  if (typeof settings.darkMode !== 'boolean') {
    throw new ValidationError('Dark mode must be a boolean');
  }

  if (typeof settings.lastSync !== 'number' || isNaN(settings.lastSync)) {
    throw new ValidationError('Last sync must be a valid number');
  }

  if (typeof settings.syncEnabled !== 'boolean') {
    throw new ValidationError('Sync enabled must be a boolean');
  }

  if (typeof settings.pwaUrl !== 'string') {
    throw new ValidationError('PWA URL must be a string');
  }

  return true;
};

const validateQueueItem = (item) => {
  if (typeof item !== 'object' || !item) {
    throw new ValidationError('Invalid queue item');
  }

  if (typeof item.id !== 'string' || !item.id) {
    throw new ValidationError('Queue item must have a valid ID');
  }

  if (typeof item.text !== 'string' || !item.text) {
    throw new ValidationError('Queue item must have valid text');
  }

  if (typeof item.voice !== 'string' || !item.voice) {
    throw new ValidationError('Queue item must have a valid voice');
  }

  if (!['pending', 'ready', 'playing', 'error'].includes(item.status)) {
    throw new ValidationError('Queue item must have a valid status');
  }

  if (typeof item.timestamp !== 'number' || isNaN(item.timestamp)) {
    throw new ValidationError('Queue item must have a valid timestamp');
  }

  return {
    id: item.id,
    text: item.text,
    voice: item.voice,
    status: item.status,
    timestamp: item.timestamp
  };
};

// For ES modules
export { ValidationError, validateSettings, validateQueueItem };

// For service workers
if (typeof self !== 'undefined') {
  self.Validation = {
    ValidationError,
    validateSettings,
    validateQueueItem
  };
}
