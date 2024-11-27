// Global variables
let currentAudio = null;
let audioElements = [];
let audioQueue = [];
let isProcessingQueue = false;
let savedInputText = null;

// Maximum number of retries for operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Import storage module
import { Storage } from './storage.js';

// Import settings
import { defaultSettings } from './utils/settings.js';

// Initialize UI elements
let modelSelect;
let voiceSelect;
let darkModeToggle;
let textInput;
let convertButton;
let closeButton;
let openInFloatingWindow;
let openInApp;
let settingsButton;
let settingsPanel;
let languageDisplay;
let syncStatus;
let toggleButton;
let textInputContainer;
let refreshButton;

// Function to initialize UI elements
function initializeUIElements() {
  try {
    // Get all UI elements
    modelSelect = document.getElementById("modelSelect");
    voiceSelect = document.getElementById("voiceSelect");
    darkModeToggle = document.getElementById("darkModeToggle");
    textInput = document.getElementById("textInput");
    convertButton = document.getElementById("convertButton");
    closeButton = document.getElementById("closeButton");
    openInFloatingWindow = document.getElementById("openInFloatingWindow");
    openInApp = document.getElementById("openInApp");
    settingsButton = document.getElementById("settingsButton");
    settingsPanel = document.getElementById("settingsPanel");
    languageDisplay = document.getElementById("currentLanguage");
    syncStatus = document.querySelector('sync-status');
    toggleButton = document.getElementById("toggleTextInput");
    textInputContainer = document.getElementById("textInputContainer");
    refreshButton = document.getElementById("refreshButton");

    // Initialize close button
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }
        audioQueue = [];
        isProcessingQueue = false;
        window.close();
      });
    }

    // Initialize floating window button
    if (openInFloatingWindow) {
      openInFloatingWindow.addEventListener("click", () => {
        chrome.windows.create({
          url: chrome.runtime.getURL("popup.html") + "?floating=true",
          type: "popup",
          width: 480,
          height: 420,
          left: 20,
          top: 20,
          focused: true
        }, (window) => {
          if (chrome.runtime.lastError) {
            console.error('Error creating window:', chrome.runtime.lastError);
            return;
          }
          // Close the current popup
          window.close();
        });
      });
    }

    // Initialize app button
    if (openInApp) {
      openInApp.addEventListener("click", () => {
        chrome.tabs.create({ url: "https://tts.cloud.atemkeng.de/" }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error opening app:', chrome.runtime.lastError);
            return;
          }
          window.close();
        });
      });
    }

    // Initialize refresh button
    if (refreshButton) {
      refreshButton.addEventListener("click", () => {
        refreshButton.querySelector("i").classList.add("fa-spin");
        setTimeout(() => {
          window.location.reload();
        }, 300);
      });
    }

    // Initialize text input toggle
    if (toggleButton && textInputContainer) {
      const initializeTextInputState = async () => {
        try {
          const settings = await Storage.getSettings();
          if (settings.textInputHidden) {
            textInputContainer.classList.add('hidden');
          }
        } catch (error) {
          console.error('Error initializing text input state:', error);
        }
      };

      toggleButton.addEventListener('click', async () => {
        try {
          textInputContainer.classList.toggle('hidden');
          const settings = await Storage.getSettings();
          settings.textInputHidden = textInputContainer.classList.contains('hidden');
          await Storage.saveSettings(settings);
        } catch (error) {
          console.error('Error toggling text input:', error);
        }
      });

      // Initialize text input state
      initializeTextInputState();
    }

    // Initialize sync status
    if (syncStatus) {
      // Listen for sync status changes
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'syncStatusUpdate') {
          syncStatus.setAttribute('status', message.status);
          if (message.error) {
            syncStatus.setAttribute('error', message.error);
          } else {
            syncStatus.removeAttribute('error');
          }
        }
      });

      // Request initial sync status
      chrome.runtime.sendMessage({ type: 'getSyncStatus' }, (response) => {
        if (response) {
          syncStatus.setAttribute('status', response.status);
          if (response.error) {
            syncStatus.setAttribute('error', response.error);
          }
        }
      });
    }

  } catch (error) {
    console.error("Error initializing UI elements:", error);
  }
}

// Function to open floating window
async function openFloatingWindow(text = '') {
  try {
    // Get current settings
    const settings = await Storage.getSettings();
    
    // Create floating window data
    const windowData = {
      action: "createFloatingWindow",
      selectedText: text,
      settings: settings
    };

    // Send message to background script
    const response = await chrome.runtime.sendMessage(windowData);
    
    if (!response || response.error) {
      throw new Error(response?.error || 'Failed to create floating window');
    }

    // Close current popup
    window.close();
  } catch (error) {
    console.error('Error creating floating window:', error);
  }
}

// Model to voices mapping
const modelToVoices = {
  "voice-en-us": [
    "voice-en-us-amy-low",
    "voice-en-us-danny-low",
    "voice-en-us-ryan-low",
    "voice-en-us-kathleen-low",
  ],
  "voice-en-gb": ["voice-en-gb-alan-low"],
  "voice-de": ["voice-de-thorsten-low", "voice-de-kerstin-low"],
  "voice-es": ["voice-es-carlfm-x-low"],
  "voice-fr": [
    "voice-fr-gilles-low",
    "voice-fr-mls_1840-low",
    "voice-fr-siwis-low",
    "voice-fr-siwis-medium",
  ],
  "voice-it": ["voice-it-paola-medium"],
};

// Function to populate voices based on selected model
async function populateVoices() {
  const voiceSelect = document.getElementById("voiceSelect");
  if (!voiceSelect) return;

  // Clear existing options
  voiceSelect.innerHTML = "";

  // Get the selected model
  const modelSelect = document.getElementById("modelSelect");
  const selectedModel = modelSelect?.value || "voice-en-us";

  // Define voices for each model
  const voices = {
    "voice-en-us": [
      { id: "voice-en-us-amy-low", name: "Amy" },
      { id: "voice-en-us-danny-low", name: "Danny" },
      { id: "voice-en-us-ryan-low", name: "Ryan" },
      { id: "voice-en-us-kathleen-low", name: "Kathleen" },
    ],
    "voice-de": [
      { id: "voice-de-thorsten-low", name: "Thorsten" },
      { id: "voice-de-kerstin-low", name: "Kerstin" },
    ],
    "voice-fr": [
      { id: "voice-fr-jean-low", name: "Jean" },
      { id: "voice-fr-marie-low", name: "Marie" },
    ],
    "voice-es": [
      { id: "voice-es-pedro-low", name: "Pedro" },
      { id: "voice-es-lucia-low", name: "Lucia" },
    ],
    "voice-it": [
      { id: "voice-it-marco-low", name: "Marco" },
      { id: "voice-it-sofia-low", name: "Sofia" },
    ],
  };

  // Add voices for selected model
  const modelVoices = voices[selectedModel] || [];
  modelVoices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.id;
    option.textContent = voice.name;
    voiceSelect.appendChild(option);
  });

  // Load persisted settings
  const settings = await Storage.getSettings();

  // If we have a persisted voice for this model, select it
  if (settings.voice && modelVoices.some((v) => v.id === settings.voice)) {
    voiceSelect.value = settings.voice;
  } else {
    // Otherwise use the first voice as default and save it
    const firstVoice = modelVoices[0]?.id;
    if (firstVoice) {
      voiceSelect.value = firstVoice;
      settings.voice = firstVoice;
      await Storage.saveSettings(settings);
    }
  }
}

// Update the language select options
function updateLanguageOptions() {
  const modelSelect = document.getElementById("modelSelect");
  if (!modelSelect) return;

  // Clear existing options
  modelSelect.innerHTML = "";

  // Define languages with their display names
  const languages = [
    { id: "voice-en-us", name: "English (EN)" },
    { id: "voice-de", name: "German (DE)" },
    { id: "voice-fr", name: "French (FR)" },
    { id: "voice-es", name: "Spanish (ES)" },
    { id: "voice-it", name: "Italian (IT)" },
  ];

  // Add language options
  languages.forEach((lang) => {
    const option = document.createElement("option");
    option.value = lang.id;
    option.textContent = lang.name;
    modelSelect.appendChild(option);
  });
}

// Function to update voice options based on selected model
async function updateVoiceOptions(model, skipSave = false) {
  if (!voiceSelect || !model) return;

  console.log("Updating voice options for model:", model);

  // Clear existing options
  voiceSelect.innerHTML = "";

  // Get voices for selected model
  const voices = {
    "voice-en-us": [
      { id: "voice-en-us-amy-low", name: "Amy" },
      { id: "voice-en-us-danny-low", name: "Danny" },
      { id: "voice-en-us-ryan-low", name: "Ryan" },
      { id: "voice-en-us-kathleen-low", name: "Kathleen" },
    ],
    "voice-de": [
      { id: "voice-de-thorsten-low", name: "Thorsten" },
      { id: "voice-de-kerstin-low", name: "Kerstin" },
    ],
    "voice-fr": [
      { id: "voice-fr-jean-low", name: "Jean" },
      { id: "voice-fr-marie-low", name: "Marie" },
    ],
    "voice-es": [
      { id: "voice-es-pedro-low", name: "Pedro" },
      { id: "voice-es-lucia-low", name: "Lucia" },
    ],
    "voice-it": [
      { id: "voice-it-marco-low", name: "Marco" },
      { id: "voice-it-sofia-low", name: "Sofia" },
    ],
  };

  // Add options for each voice
  const modelVoices = voices[model] || voices["voice-en-us"];
  modelVoices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.id;
    option.textContent = voice.name;
    voiceSelect.appendChild(option);
  });

  // Load current settings
  const settings = await Storage.getSettings();

  // If we have a voice for this model, use it
  const voiceForModel = modelVoices.find((v) => v.id === settings.voice);
  if (voiceForModel) {
    voiceSelect.value = voiceForModel.id;
  } else {
    // Otherwise use first voice
    voiceSelect.value = modelVoices[0].id;
  }

  // Update settings without saving immediately
  settings.model = model;
  settings.voice = voiceSelect.value;
  
  // Update display
  await updateLanguageDisplay(model);
  
  // Only save if not skipping save (to prevent infinite loops)
  if (!skipSave) {
    await Storage.saveSettings(settings);
  }
}

// Function to update language display
async function updateLanguageDisplay(model) {
  if (!languageDisplay || !model) return;

  // Extract language code from model name
  const languageMap = {
    en: "EN",
    de: "DE",
    es: "ES",
    fr: "FR",
    it: "IT",
  };

  const langCode = model.split("-")[1]?.toLowerCase() || "en";
  const settings = await Storage.getSettings();
  
  // Get the voice name from the voice ID
  const voiceName = settings.voice?.split("-").pop() || "";
  // Capitalize first letter if we have a voice name
  const displayVoice = voiceName ? voiceName.charAt(0).toUpperCase() + voiceName.slice(1) : "";
  
  // Display language and voice
  languageDisplay.textContent = `${languageMap[langCode]}${displayVoice ? `: ${displayVoice}` : ""}`;
}

// Function to initialize dark mode
  async function initializeDarkMode() {
    if (!darkModeToggle) return;

    try {
      // Load initial dark mode state
      const currentSettings = await Storage.getSettings();
      if (currentSettings.darkMode) {
        document.body.classList.toggle("dark-mode", currentSettings.darkMode);

      }

      // Add click handler for dark mode toggle
      darkModeToggle.addEventListener("click", async () => {
        try {
          console.log("Dark mode toggle clicked");
          // Toggle dark mode class
          const isDarkMode = document.body.classList.toggle("dark-mode");
          console.log("Dark mode class toggled", isDarkMode);
          
          // Update settings with new dark mode state
          const settings = await Storage.getSettings();
          settings.darkMode = isDarkMode;
          console.log("Before saving, darkMode state:", settings.darkMode);
          await Storage.saveSettings(settings);
          console.log("Dark mode setting saved", settings.darkMode);

          document.body.classList.toggle("dark-mode", settings.darkMode);
          console.log("Dark mode toggle successfully");
          
        } catch (error) {
          console.error("Error toggling dark mode:", error);
        }
      });
    } catch (error) {
      console.error("Error initializing dark mode:", error);
    }
  }


// Function to initialize text input toggle
async function initializeTextInputToggle() {
  if (!toggleButton || !textInputContainer) return;

  const settings = await Storage.getSettings();
  const isCollapsed = settings.textInputCollapsed !== false; // Default to true if not set
  
  if (isCollapsed) {
    toggleButton.classList.add("collapsed");
    textInputContainer.classList.add("collapsed");
  }

  toggleButton.addEventListener("click", async () => {
    toggleButton.classList.toggle("collapsed");
    textInputContainer.classList.toggle("collapsed");

    const settings = await Storage.getSettings();
    settings.textInputCollapsed = textInputContainer.classList.contains("collapsed");
    await Storage.saveSettings(settings);
  });
}

// Function to check if extension context is valid
function isExtensionContextValid() {
  return typeof chrome !== "undefined" && !!chrome.runtime?.id;
}

// Function to wait
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to retry an operation
async function retryOperation(operation, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (!isExtensionContextValid()) {
        throw new Error("Extension context invalidated");
      }
      return await operation();
    } catch (error) {
      lastError = error;
      if (error.message.includes("Extension context invalidated")) {
        console.log(
          `Attempt ${
            i + 1
          }/${maxRetries} failed due to invalid context, retrying...`
        );
        await wait(RETRY_DELAY);
      } else {
        throw error; // If it's not a context error, throw immediately
      }
    }
  }
  throw lastError;
}

// Function to check text selection
async function checkTextSelection() {
  try {
    return await retryOperation(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return false;

      // Check for restricted URLs
      const restrictedUrls = [
        "chrome://",
        "chrome-extension://",
        "about:",
        "file://",
        "edge://",
        "about:blank",
      ];
      if (tab.url && restrictedUrls.some((url) => tab.url.startsWith(url))) {
        console.log("Cannot access restricted URL:", tab.url);
        return false;
      }

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString().trim(),
      });

      return result.length > 0;
    });
  } catch (error) {
    console.error("Error checking text selection:", error);
    if (error.message.includes("Extension context invalidated")) {
      if (selectionStatus) {
        selectionStatus.textContent =
          "Extension reloaded. Please refresh the page.";
        selectionStatus.classList.add("text-red-500");
      }
    }
    return false;
  }
}

// Function to get selected text
async function getSelectedText() {
  try {
    return await retryOperation(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return "";

      // Check for restricted URLs
      const restrictedUrls = [
        "chrome://",
        "chrome-extension://",
        "about:",
        "file://",
        "edge://",
        "about:blank",
      ];
      if (tab.url && restrictedUrls.some((url) => tab.url.startsWith(url))) {
        console.log("Cannot access restricted URL:", tab.url);
        return "";
      }

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString().trim(),
      });

      return result;
    });
  } catch (error) {
    console.error("Error getting selected text:", error);
    if (error.message.includes("Extension context invalidated")) {
      if (messageDiv) {
        messageDiv.textContent = "Extension reloaded. Please refresh the page.";
        messageDiv.classList.add("text-red-500");
      }
    }
    return "";
  }
}

// Function to convert text to speech
async function convertTextToSpeech(text) {
  if (!text.trim()) return;

  const settings = await Storage.getSettings();

  try {
    if (!chrome.runtime?.id) {
      throw new Error("Extension context invalid");
    }

    // if (messageDiv) {
    //   messageDiv.textContent = 'Converting text to speech...';
    // }

    console.log("Making API request with:", {
      input: text,
      model: settings.voice,
      voice: settings.voice,
    });

    const response = await fetch(
      "https://voice.cloud.atemkeng.de/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          model: settings.voice,
          voice: settings.voice,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("API Error:", errorData);
      throw new Error(`Server error: ${response.status} - ${errorData}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("Received empty audio data");
    }

    console.log("Received audio blob:", blob);

    const audioUrl = URL.createObjectURL(blob);
    console.log("Created audio URL:", audioUrl);

    // Create audio entry and add to queue
    const audioEntry = createAudioEntry(text, audioUrl);
    addToAudioQueue(audioEntry);

    // if (messageDiv) {
    //   messageDiv.textContent = 'Audio ready to play';
    //   setTimeout(() => {
    //     messageDiv.textContent = '';
    //   }, 2000);
    // }
  } catch (error) {
    console.error("Error converting text to speech:", error);
    showMessage(`Error: ${error.message}`);
    throw error;
  }
}

// Function to create audio entry
function createAudioEntry(text, audioUrl) {
  const audio = new Audio(audioUrl);

  // Set up audio event listeners
  audio.addEventListener("loadedmetadata", () => {
    console.log("Audio metadata loaded:", {
      duration: audio.duration,
      readyState: audio.readyState,
    });

    // Validate duration before updating UI
    if (!isNaN(audio.duration) && isFinite(audio.duration)) {
      updatePlayerUI({ audio, text });
    } else {
      console.warn("Invalid duration after metadata load:", audio.duration);
    }
  });

  // Handle play/pause events
  audio.addEventListener("play", () => {
    console.log("Audio playing");
    updatePlayerUI({ audio, text });
  });

  audio.addEventListener("pause", () => {
    console.log("Audio paused");
    updatePlayerUI({ audio, text });
  });

  // Handle errors
  audio.addEventListener("error", (e) => {
    console.error("Audio error:", e.target.error);
    showMessage("Error playing audio. Please try again.");
  });

  // Handle audio loading
  audio.addEventListener("canplay", () => {
    console.log("Audio can play");
    updatePlayerUI({ audio, text });
  });

  // Handle audio ended
  audio.addEventListener("ended", () => {
    console.log("Audio ended, checking for next audio");
    const currentIndex = audioQueue.findIndex((entry) => entry.audio === audio);
    if (currentIndex < audioQueue.length - 1) {
      // Play next audio
      const nextEntry = audioQueue[currentIndex + 1];
      currentAudio = nextEntry.audio;
      currentAudio.play().catch((error) => {
        console.error("Error playing next audio:", error);
        showMessage("Error playing next audio. Please try again.");
      });
      updatePlayerUI(nextEntry);
    } else {
      console.log("No more audio in queue");
      // Reset play button when playlist ends
      const playIcon = document.querySelector("#playPauseButton i");
      if (playIcon) {
        playIcon.className = "fa-solid fa-play";
      }
      currentAudio = null;
    }
  });

  return { audio, text };
}

// Function to process audio queue
async function processAudioQueue() {
  if (isProcessingQueue || audioQueue.length === 0) return;

  isProcessingQueue = true;
  const currentEntry = audioQueue[0];

  try {
    console.log("Processing audio queue:", {
      queueLength: audioQueue.length,
      currentAudio: currentEntry?.audio?.src,
    });

    // Stop any currently playing audio
    if (currentAudio && currentAudio !== currentEntry.audio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }

    currentAudio = currentEntry.audio;

    // Set up the ended event handler
    const onEnded = () => {
      console.log("Audio ended, processing next in queue");
      audioQueue.shift(); // Remove the finished audio
      isProcessingQueue = false;
      currentEntry.audio.removeEventListener("ended", onEnded);
      processAudioQueue(); // Process next in queue
    };

    currentEntry.audio.addEventListener("ended", onEnded);

    console.log("Playing audio:", currentEntry.audio.src);
    await currentEntry.audio.play().catch((error) => {
      console.error("Error playing audio:", error);
      throw error;
    });

    // Update UI
    updatePlayerUI(currentEntry);
  } catch (error) {
    console.error("Error playing audio:", error);
    showMessage("Error playing audio. Please try again.");
    isProcessingQueue = false;
    audioQueue.shift();
    processAudioQueue();
  }
}

// Function to add to audio queue
function addToAudioQueue(audioEntry) {
  audioQueue.push(audioEntry);
  if (audioQueue.length === 1) {
    // If this is the first entry, start processing
    processAudioQueue();
  }
}

// Function to update player UI
function updatePlayerUI(audioEntry) {
  const playButton = document.querySelector(".play-button");
  const progressRing = document.querySelector(".progress-ring-circle");
  const currentTimeDisplay = document.getElementById("currentTime");
  const durationDisplay = document.getElementById("duration");
  const currentChunkDisplay = document.getElementById("currentChunk");
  const totalChunksDisplay = document.getElementById("totalChunks");
  const currentAudioTextDisplay = document.getElementById("currentAudioText");

  // Update total chunks immediately
  if (totalChunksDisplay) {
    totalChunksDisplay.textContent = audioQueue.length.toString();
  }

  if (!audioEntry || !audioEntry.audio) {
    // Reset UI when no audio is playing
    if (playButton) {
      playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
      playButton.classList.remove("playing");
    }
    if (progressRing) {
      progressRing.style.strokeDashoffset = 163.36; // Full circle
    }
    if (currentTimeDisplay) currentTimeDisplay.textContent = "0:00";
    if (durationDisplay) durationDisplay.textContent = "0:00";
    if (currentChunkDisplay) currentChunkDisplay.textContent = "0";
    if (currentAudioTextDisplay) currentAudioTextDisplay.textContent = "";
    if (textInput) textInput.value = "";
    return;
  }

  const { audio, text } = audioEntry;

  // Update play/pause button
  if (playButton) {
    playButton.innerHTML = audio.paused
      ? '<i class="fa-solid fa-play"></i>'
      : '<i class="fa-solid fa-pause"></i>';
    playButton.classList.toggle("playing", !audio.paused);
  }

  // Update progress ring and time displays
  const updateProgress = () => {
    // Skip if audio isn't ready
    if (!audio.readyState) {
      console.log("Audio not ready yet");
      return;
    }

    // Ensure we have valid duration
    if (isNaN(audio.duration) || !isFinite(audio.duration)) {
      console.warn("Invalid audio duration:", audio.duration);
      return;
    }

    // Update progress ring
    if (progressRing) {
      const progress = audio.currentTime / audio.duration || 0;
      const circumference = 163.36;
      const offset = circumference - progress * circumference;
      progressRing.style.strokeDashoffset = offset;
    }

    // Update time displays with validation
    if (currentTimeDisplay && !isNaN(audio.currentTime)) {
      currentTimeDisplay.textContent = formatTime(
        Math.max(0, audio.currentTime)
      );
    }
    if (durationDisplay && !isNaN(audio.duration)) {
      durationDisplay.textContent = formatTime(Math.max(0, audio.duration));
    }
  };

  // Add timeupdate listener for continuous progress updates
  audio.removeEventListener("timeupdate", updateProgress); // Remove any existing listener
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("durationchange", updateProgress); // Add listener for when duration becomes available

  // Initial progress update if audio is ready
  if (audio.readyState) {
    updateProgress();
  }

  // Update chunk information
  let currentIndex = 0;
  if (audioQueue.length > 0) {
    // Find the index of the currently playing audio
    const playingIndex = audioQueue.findIndex((entry) => {
      return entry.audio === currentAudio && !entry.audio.paused;
    });
    currentIndex = playingIndex >= 0 ? playingIndex + 1 : 1;
  }

  if (currentChunkDisplay) {
    currentChunkDisplay.textContent = currentIndex.toString();
  }

  // Update text preview
  if (currentAudioTextDisplay) {
    currentAudioTextDisplay.textContent =
      text.length > 100 ? text.substring(0, 100) + "..." : text;
  }

  // Update input field with current chunk text
  if (textInput && !audio.paused) {
    textInput.value = text;
  }

  // Clean up timeupdate listener when audio ends
  audio.addEventListener("ended", () => {
    audio.removeEventListener("timeupdate", updateProgress);
  });
}

// Function to format time
function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Function to validate URL for content script injection
function isValidUrl(url) {
  const restrictedPatterns = [
    "chrome://",
    "chrome-extension://",
    "chrome-search://",
    "chrome-devtools://",
    "about:",
    "edge://",
    "data:",
    "view-source:",
  ];
  return url && !restrictedPatterns.some((pattern) => url.startsWith(pattern));
}

// Function to handle webpage text conversion
async function handleWebPageConversion(chunks, totalChunks) {
  if (!chunks || chunks.length === 0) return;

  if (!messageDiv) {
    messageDiv = document.getElementById("message");
  }

  // if (messageDiv) {
  //   messageDiv.textContent = `Converting page: 0/${totalChunks} chunks`;
  // }

  for (let i = 0; i < chunks.length; i++) {
    try {
      await convertTextToSpeech(chunks[i]);
      if (i === 0) { // After first chunk converts successfully
        hideUrlInputGroup();
      }
    } catch (error) {
      console.error(`Error converting chunk ${i}:`, error);
      showMessage(`Error converting chunk ${
        i + 1
      }/${totalChunks}, ${error.message || "Unknown error"}`);
      continue;
    }
  }

  showMessage("Page conversion completed!", "success");
  setTimeout(() => {
    if (messageDiv) {
      messageDiv.textContent = '';
      messageDiv.className = "";
    }
  }, 3000);

  // Hide convert button after successful conversion
  if (convertButton) {
    convertButton.hidden = true;
  }
}

// Function to update chunk display
function updateChunkDisplay(current, total) {
  const currentChunkDisplay = document.getElementById("currentChunk");
  const totalChunksDisplay = document.getElementById("totalChunks");

  if (currentChunkDisplay) {
    currentChunkDisplay.textContent = current.toString();
  }
  if (totalChunksDisplay) {
    totalChunksDisplay.textContent = total.toString();
  }
}

// Function to chunk text while preserving formatting
function chunkText(text, maxChunkSize = 1000) {
  // Normalize line endings and remove extra spaces before newlines
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/[\t ]+\n/g, "\n");

  // Split into initial segments (paragraphs)
  const segments = normalizedText.split(/\n\s*\n+/);

  // Process each segment and detect headings
  const chunks = [];
  for (const segment of segments) {
    const lines = segment.split("\n");
    let currentParagraph = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check if line is a heading/title
      const isHeading =
        /^#{1,6}\s+/.test(trimmedLine) || // Markdown headings
        /^(?:[0-9A-Z][.)]\s+|[0-9]+[.)][0-9.]*[.)]\s+)/i.test(
          trimmedLine
        ) || // Numbered headings
        (trimmedLine.length < 100 &&
          !/[.!?:,;]$/.test(trimmedLine) &&
          /^[A-Z]/.test(trimmedLine)) || // Short title-like lines
        (trimmedLine.toUpperCase() === trimmedLine && trimmedLine.length < 100); // ALL CAPS lines

      if (isHeading) {
        // If we have accumulated paragraph text, add it as a chunk
        if (currentParagraph.length > 0) {
          chunks.push(currentParagraph.join(" ").replace(/\s+/g, " ").trim());
          currentParagraph = [];
        }
        // Add heading as its own chunk
        chunks.push(trimmedLine);
      } else {
        currentParagraph.push(trimmedLine);
      }
    }

    // Add any remaining paragraph text as a chunk
    if (currentParagraph.length > 0) {
      chunks.push(currentParagraph.join(" ").replace(/\s+/g, " ").trim());
    }
  }

  // Filter out empty chunks and ensure minimum length
  return chunks.filter((chunk) => chunk.length > 0);
}

// Settings management
// Load settings from storage
async function loadSettings() {
  return await Storage.getSettings();
}

// Save settings to storage
async function saveSettings(settings) {
  await Storage.saveSettings(settings);
}

// Function to initialize settings
async function initializeSettings() {
  console.log("Initializing settings with dark mode:");
  const settings = await Storage.getSettings();
  console.log(settings);
  const modelSelect = document.getElementById("modelSelect");

  if (modelSelect) {
    // If we have a persisted model, use it
    if (settings.model) {
      modelSelect.value = settings.model;
    } else {
      // Otherwise use the first model as default and save it
      const firstModel = modelSelect.options[0]?.value;
      if (firstModel) {
        settings.model = firstModel;
        await Storage.saveSettings(settings);
      }
    }
  }

  // Update voice options for the selected model
  await updateVoiceOptions(
    settings.model || modelSelect?.value || "voice-en-us"
  );

  // Set voice if we have a persisted value
  const voiceSelect = document.getElementById("voiceSelect");
  if (voiceSelect && settings.voice) {
    // Check if the persisted voice is available for current model
    const voiceExists = Array.from(voiceSelect.options).some(
      (opt) => opt.value === settings.voice
    );
    if (voiceExists) {
      voiceSelect.value = settings.voice;
    } else {
      // If persisted voice isn't available, use first voice for current model
      const firstVoice = voiceSelect.options[0]?.value;
      if (firstVoice) {
        settings.voice = firstVoice;
        voiceSelect.value = firstVoice;
        await Storage.saveSettings(settings);
      }
    }
  }

  console.log("Settings initialized with dark mode:", settings.darkMode);
}

// Apply settings to UI
async function applySettings() {
  console.log("Applying settings with dark mode:");
  const settings = await Storage.getSettings();
  console.log(settings);
  document.getElementById("modelSelect").value = settings.model;
  updateVoiceOptions(settings.model);

  // Wait for voice options to be updated before setting the voice
  setTimeout(() => {
    const voiceSelect = document.getElementById("voiceSelect");
    if (voiceSelect) {
      voiceSelect.value = settings.voice;
    }
  }, 100);
}

// Add settings change listener
Storage.addListener(async (settings) => {
  try {
    // Update voice options without saving to prevent infinite loop
    await updateVoiceOptions(settings.model, true);
    
    // Update dark mode
    if (settings.darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  } catch (error) {
    console.error("Error in settings change listener:", error);
  }
});

// Function to initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Check if this is a floating window
    const urlParams = new URLSearchParams(window.location.search);
    const isFloatingWindow = urlParams.get("floating") === "true";

    // Initialize UI elements first
    initializeUIElements();

    // Initialize settings
    await initializeSettings();
    const currentSettings = await Storage.getSettings();

    // Initialize features
    await initializeDarkMode();
    await updateLanguageDisplay(currentSettings.model);
    await initializeTextInputToggle();

    let saveTimeout;
    
    if (modelSelect) {
      modelSelect.addEventListener("change", async (e) => {
        const model = e.target.value;
        await updateVoiceOptions(model);
      });
    }

    if (voiceSelect) {
      voiceSelect.addEventListener("change", async () => {
        const settings = await Storage.getSettings();
        settings.voice = voiceSelect.value;
        
        // Update display immediately
        await updateLanguageDisplay(settings.model);
        
        // Debounce settings save
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await Storage.saveSettings(settings);
        }, 500);
      });
    }

    // Add event listener for settings button
    const settingsButton = document.getElementById("settingsButton");
    if (settingsButton) {
      settingsButton.addEventListener("click", () => {
        // Show settings modal
        const settingsModal = document.getElementById("settingsModal");
        if (settingsModal) {
          settingsModal.style.display = "block";
        }
      });
    }

    // Add event listener for closing settings modal
    const closeSettingsButton = document.getElementById("closeSettings");
    if (closeSettingsButton) {
      closeSettingsButton.addEventListener("click", () => {
        const settingsModal = document.getElementById("settingsModal");
        if (settingsModal) {
          settingsModal.style.display = "none";
        }
      });
    }

    // Close modal when clicking outside
    window.addEventListener("click", (event) => {
      const settingsModal = document.getElementById("settingsModal");
      if (event.target === settingsModal) {
        settingsModal.style.display = "none";
      }
    });

    // Initialize other event listeners and UI components
    // ... rest of the initialization code ...
  } catch (error) {
    console.error("Error during initialization:", error);
  }
});

// Function to hide URL input group
function hideUrlInputGroup() {
  const urlInput = document.getElementById("pageUrlInput");
  const urlInputGroup = document.querySelector(".url-input-group");

  if (urlInput) {
    urlInput.hidden = true;
  }
  if (urlInputGroup) {
    urlInputGroup.style.display = "none";
  }
}

// Function to show message with auto-hide
function showMessage(text, type = 'error', duration = 3000) {
  if (messageDiv) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.hidden = false;
    
    // Auto-hide after duration
    setTimeout(() => {
      messageDiv.textContent = '';
      messageDiv.hidden = true;
    }, duration);
  }
}
