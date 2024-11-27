// Default settings for the application
const defaultSettings = {
  voice: "amy",
  model: "voice-en-us-amy-low",
  darkMode: false,
  lastSync: 0,
  syncEnabled: true,
  pwaUrl: ""
};

// For ES modules
export { defaultSettings };

// For service workers
if (typeof self !== 'undefined') {
  self.Settings = { defaultSettings };
}
