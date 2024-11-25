// Global variables
let currentAudio = null;
let audioElements = [];
let audioQueue = [];
let isProcessingQueue = false;
let savedInputText = null;

// Audio conversion state management
let currentConversion = {
  id: null,
  parts: [],
  totalDuration: 0,
  isComplete: false
};

// Global progress tracking
let globalProgress = {
  totalDuration: 0,
  currentTime: 0,
  parts: [],
  conversionId: null,
  isPlaying: false,
  currentPartIndex: 0,
  currentText: ''
};

// Maximum number of retries for operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// DOM Elements
let convertButton;
let textInput;
let closeButton;
let voiceSelect;
let modelSelect;
let darkModeToggle;
let messageDiv;
let speakButton;
let selectionStatus;
let urlInput;
let convertPageButton;
let openInFloatingWindow;
let refreshButton;

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
  const settings = await loadSettings();

  // If we have a persisted voice for this model, select it
  if (settings.voice && modelVoices.some((v) => v.id === settings.voice)) {
    voiceSelect.value = settings.voice;
  } else {
    // Otherwise use the first voice as default and save it
    const firstVoice = modelVoices[0]?.id;
    if (firstVoice) {
      voiceSelect.value = firstVoice;
      settings.voice = firstVoice;
      await saveSettings(settings);
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
async function updateVoiceOptions(model) {
  const voiceSelect = document.getElementById("voiceSelect");
  if (!voiceSelect) return;

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
  const settings = loadSettings();

  // If we have a voice for this model, use it
  const voiceForModel = modelVoices.find((v) => v.id === settings.voice);
  if (voiceForModel) {
    voiceSelect.value = voiceForModel.id;
  } else {
    // Otherwise use first voice
    voiceSelect.value = modelVoices[0].id;
  }

  // Save the updated settings
  settings.model = model;
  settings.voice = voiceSelect.value;
  saveSettings(settings);
  console.log("Saved settings after voice update:", settings);
}

// Function to initialize dark mode
function initializeDarkMode() {
  if (!darkModeToggle) return;

  const isDarkMode = localStorage.getItem("darkMode") === "enabled";
  if (isDarkMode) {
    document.body.classList.add("dark-mode");
  }

  darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem(
      "darkMode",
      document.body.classList.contains("dark-mode") ? "enabled" : "disabled"
    );
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
        "chrome-search://",
        "chrome-devtools://",
        "about:",
        "edge://",
        "data:",
        "view-source:",
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

  const settings = loadSettings();

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
  
  const audioEntry = {
    text: text,
    audio: audio
  };

  // Add to current conversion
  addAudioPart(audioEntry);

  // Set up audio event handlers
  audio.addEventListener('loadedmetadata', () => {
    // Re-initialize progress bar when all parts are loaded
    if (currentConversion.parts.length === audioQueue.length) {
      initializeGlobalProgress();
    }
  });

  setupAudioListeners(audio);

  audio.addEventListener('play', () => {
    globalProgress.isPlaying = true;
    updatePlayerUI(audioEntry);
  });

  audio.addEventListener('pause', () => {
    globalProgress.isPlaying = false;
    updatePlayerUI(audioEntry);
  });

  audio.addEventListener('ended', () => {
    globalProgress.isPlaying = false;
    
    // Move to next part if available
    const currentIndex = audioQueue.findIndex(entry => entry.audio === audio);
    if (currentIndex < audioQueue.length - 1) {
      const nextEntry = audioQueue[currentIndex + 1];
      currentAudio = nextEntry.audio;
      currentAudio.currentTime = 0;
      
      // Update state
      globalProgress.currentPartIndex = currentIndex + 1;
      globalProgress.isPlaying = true;
      
      // Play and update UI
      currentAudio.play().catch(error => {
        console.error('Error playing next audio:', error);
      });
      updatePlayerUI(nextEntry);
      
      // Update play button state
      const playIcon = document.querySelector("#playPauseButton i");
      if (playIcon) playIcon.className = "fa-solid fa-pause";
    } else {
      currentAudio = null;
      currentConversion.isComplete = true;
    }
  });

  return audioEntry;
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

// Playback control functions
function togglePlayPause() {
  const playIcon = document.querySelector("#playPauseButton i");
  
  if (!currentAudio) {
    // If no audio is playing, start from the beginning of the queue
    if (audioQueue.length > 0) {
      currentAudio = audioQueue[0].audio;
      updatePlayerUI(audioQueue[0]);
    } else {
      return;
    }
  }

  if (currentAudio.paused) {
    currentAudio.play().catch(error => {
      console.error('Error playing audio:', error);
    });
    playIcon.className = "fa-solid fa-pause";
    globalProgress.isPlaying = true;
  } else {
    currentAudio.pause();
    playIcon.className = "fa-solid fa-play";
    globalProgress.isPlaying = false;
  }
  updateGlobalProgress();
}

function skipToNext() {
  if (!currentAudio || audioQueue.length === 0) return;

  const currentIndex = audioQueue.findIndex(entry => entry.audio === currentAudio);
  if (currentIndex < audioQueue.length - 1) {
    currentAudio.pause();
    const nextEntry = audioQueue[currentIndex + 1];
    currentAudio = nextEntry.audio;
    currentAudio.currentTime = 0;
    
    // Update state
    globalProgress.currentPartIndex = currentIndex + 1;
    globalProgress.isPlaying = true;
    
    // Play and update UI
    currentAudio.play().catch(error => {
      console.error('Error playing next audio:', error);
    });
    updatePlayerUI(nextEntry);
    
    // Update play button state
    const playIcon = document.querySelector("#playPauseButton i");
    if (playIcon) playIcon.className = "fa-solid fa-pause";
  }
}

function skipToPrevious() {
  if (!currentAudio || audioQueue.length === 0) return;

  const currentIndex = audioQueue.findIndex(entry => entry.audio === currentAudio);
  if (currentIndex > 0) {
    currentAudio.pause();
    const prevEntry = audioQueue[currentIndex - 1];
    currentAudio = prevEntry.audio;
    currentAudio.currentTime = 0;
    
    // Update state
    globalProgress.currentPartIndex = currentIndex - 1;
    globalProgress.isPlaying = true;
    
    // Play and update UI
    currentAudio.play().catch(error => {
      console.error('Error playing previous audio:', error);
    });
    updatePlayerUI(prevEntry);
    
    // Update play button state
    const playIcon = document.querySelector("#playPauseButton i");
    if (playIcon) playIcon.className = "fa-solid fa-pause";
  }
}

// Update the updatePlayerUI function
function updatePlayerUI(entry) {
  const textDisplay = document.getElementById("currentAudioText");
  const playIcon = document.querySelector("#playPauseButton i");
  const currentTimeDisplay = document.getElementById("currentTime");
  const durationDisplay = document.getElementById("duration");
  const currentChunkDisplay = document.getElementById("currentChunk");
  const totalChunksDisplay = document.getElementById("totalChunks");
  const progressRing = document.querySelector(".progress-ring-circle");
  
  // Update text display
  if (textDisplay && entry.text) {
    textDisplay.textContent = entry.text.length > 100 ? 
      entry.text.substring(0, 100) + "..." : 
      entry.text;
    globalProgress.currentText = entry.text;
  }

  // Update play/pause button
  if (playIcon) {
    playIcon.className = currentAudio?.paused ? 
      "fa-solid fa-play" : 
      "fa-solid fa-pause";
  }

  // Update time displays
  if (currentTimeDisplay && currentAudio) {
    currentTimeDisplay.textContent = formatTime(currentAudio.currentTime);
  }
  if (durationDisplay && currentAudio) {
    durationDisplay.textContent = formatTime(currentAudio.duration);
  }

  // Update chunk information
  const currentIndex = audioQueue.findIndex(item => item === entry) + 1;
  if (currentChunkDisplay) {
    currentChunkDisplay.textContent = currentIndex.toString();
  }
  if (totalChunksDisplay) {
    totalChunksDisplay.textContent = audioQueue.length.toString();
  }

  // Update progress ring
  if (progressRing && currentAudio) {
    const progress = currentAudio.currentTime / currentAudio.duration || 0;
    const circumference = 163.36;
    const offset = circumference - progress * circumference;
    progressRing.style.strokeDashoffset = offset;
  }

  // Update progress tracking
  globalProgress.isPlaying = !currentAudio?.paused;
  globalProgress.currentPartIndex = currentIndex - 1;
  
  // Update skip buttons state
  const prevButton = document.getElementById("prevAudio");
  const nextButton = document.getElementById("nextAudio");
  
  if (prevButton) {
    prevButton.disabled = globalProgress.currentPartIndex <= 0;
  }
  if (nextButton) {
    nextButton.disabled = globalProgress.currentPartIndex >= audioQueue.length - 1;
  }
  
  updateGlobalProgress();
}

// Add event listeners for playback controls
document.addEventListener('DOMContentLoaded', () => {
  const playPauseButton = document.getElementById("playPauseButton");
  const previousButton = document.getElementById("prevAudio");
  const nextButton = document.getElementById("nextAudio");
  const textDisplay = document.getElementById("currentAudioText");
  
  if (playPauseButton) {
    playPauseButton.addEventListener("click", togglePlayPause);
  }
  
  if (previousButton) {
    previousButton.addEventListener("click", skipToPrevious);
  }
  
  if (nextButton) {
    nextButton.addEventListener("click", skipToNext);
  }
});

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
      messageDiv.textContent = "";
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
        /^(?:[0-9A-Z][.)]\s+|[0-9]+[.)][0-9.]*[.)]\s+)/i.test(trimmedLine) || // Numbered headings
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
const defaultSettings = {
  voice: "amy",
  model: "voice-en-us-amy-low",
};

// Load settings from storage
function loadSettings() {
  const voice = localStorage.getItem("ttsVoice") || defaultSettings.voice;
  const model = localStorage.getItem("ttsModel") || defaultSettings.model;
  return { voice, model };
}

// Save settings to storage
function saveSettings(settings) {
  localStorage.setItem("ttsVoice", settings.voice);
  localStorage.setItem("ttsModel", settings.model);
}

// Function to initialize settings
async function initializeSettings() {
  const settings = loadSettings();
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
        saveSettings(settings);
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
        saveSettings(settings);
      }
    }
  }
}

// Apply settings to UI
async function applySettings() {
  const settings = loadSettings();
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

// Function to update language display
function updateLanguageDisplay(model) {
  const languageDisplay = document.getElementById("currentLanguage");
  if (!languageDisplay) return;

  // Extract language code from model name
  const languageMap = {
    en: "EN",
    de: "DE",
    es: "ES",
    fr: "FR",
    it: "IT",
  };

  const langCode = model.split("-")[1]?.toLowerCase() || "en";
  languageDisplay.textContent = languageMap[langCode] || "EN";
}

// Settings modal handlers
document.getElementById("settingsButton").addEventListener("click", () => {
  // Load current settings
  const settings = loadSettings();
  console.log("Settings modal opened with settings:", settings);

  // Update model select
  const modelSelect = document.getElementById("modelSelect");
  if (modelSelect) {
    modelSelect.value = settings.model;
  }

  // Update voice options and select current voice
  updateVoiceOptions(settings.model);

  // Show modal
  document.getElementById("settingsModal").style.display = "block";
});

document.getElementById("closeSettings").addEventListener("click", () => {
  document.getElementById("settingsModal").style.display = "none";
});

// Close modal when clicking outside
document.getElementById("settingsModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("settingsModal")) {
    document.getElementById("settingsModal").style.display = "none";
  }
});

// Save settings when changed
document.getElementById("modelSelect").addEventListener("change", (e) => {
  console.log("Model changed to:", e.target.value);
  updateVoiceOptions(e.target.value);
  updateLanguageDisplay(e.target.value);
});

document.getElementById("voiceSelect").addEventListener("change", (e) => {
  console.log("Voice changed to:", e.target.value);
  const settings = loadSettings();
  settings.voice = e.target.value;
  saveSettings(settings);
});

// Function to initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  // Check if this is a floating window
  const urlParams = new URLSearchParams(window.location.search);
  const isFloatingWindow = urlParams.get("floating") === "true";

  // Initialize DOM elements
  convertButton = document.getElementById("convertButton");
  textInput = document.getElementById("textInput");
  closeButton = document.getElementById("closeButton");
  voiceSelect = document.getElementById("voiceSelect");
  modelSelect = document.getElementById("modelSelect");
  darkModeToggle = document.getElementById("darkModeToggle");
  messageDiv = document.getElementById("message");
  speakButton = document.getElementById("speakButton");
  selectionStatus = document.getElementById("selectionStatus");
  urlInput = document.getElementById("pageUrlInput");
  convertPageButton = document.getElementById("convertPageButton");
  openInFloatingWindow = document.getElementById("openInFloatingWindow");
  refreshButton = document.getElementById("refreshButton");

  // Initialize player controls
  const playPauseButton = document.getElementById("playPauseButton");
  const prevButton = document.getElementById("prevAudio");
  const nextButton = document.getElementById("nextAudio");

  // Play/Pause button click handler
  if (playPauseButton) {
    playPauseButton.addEventListener("click", () => {
      if (!currentAudio) {
        // If no audio is playing, start playing the first one in queue
        if (audioQueue.length > 0) {
          const firstAudio = audioQueue[0];
          firstAudio.audio.play();
          currentAudio = firstAudio.audio;
          updatePlayerUI(firstAudio);
        }
      } else {
        if (currentAudio.paused) {
          currentAudio.play();
        } else {
          currentAudio.pause();
        }
        // Find current audio entry and update UI
        const currentEntry = audioQueue.find(
          (entry) => entry.audio === currentAudio
        );
        if (currentEntry) {
          updatePlayerUI(currentEntry);
        }
      }
    });
  }

  // Previous button click handler
  if (prevButton) {
    prevButton.addEventListener("click", () => {
      if (currentAudio && audioQueue.length > 0) {
        const currentIndex = audioQueue.findIndex(
          (entry) => entry.audio === currentAudio
        );
        if (currentIndex > 0) {
          currentAudio.pause();
          const prevEntry = audioQueue[currentIndex - 1];
          currentAudio = prevEntry.audio;
          currentAudio.play();
          updatePlayerUI(prevEntry);
        }
      }
    });
  }

  // Next button click handler
  if (nextButton) {
    nextButton.addEventListener("click", () => {
      if (currentAudio && audioQueue.length > 0) {
        const currentIndex = audioQueue.findIndex(
          (entry) => entry.audio === currentAudio
        );
        if (currentIndex < audioQueue.length - 1) {
          currentAudio.pause();
          const nextEntry = audioQueue[currentIndex + 1];
          currentAudio = nextEntry.audio;
          currentAudio.play();
          updatePlayerUI(nextEntry);
        }
      }
    });
  }

  // Initialize refresh button handler
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      // Add spinning animation class
      refreshButton.querySelector("i").classList.add("fa-spin");

      // Reload the page after a brief delay to show the animation
      setTimeout(() => {
        window.location.reload();
      }, 300);
    });
  }

  // Initialize text input toggle
  const toggleButton = document.getElementById("toggleTextInput");
  const textInputContainer = document.getElementById("textInputContainer");

  if (toggleButton && textInputContainer) {
    // Load saved state or default to collapsed
    const isCollapsed = localStorage.getItem("textInputCollapsed") !== "false"; // Default to true
    if (isCollapsed) {
      toggleButton.classList.add("collapsed");
      textInputContainer.classList.add("collapsed");
    }

    toggleButton.addEventListener("click", () => {
      // Toggle collapsed state
      toggleButton.classList.toggle("collapsed");
      textInputContainer.classList.toggle("collapsed");

      // Save state
      localStorage.setItem(
        "textInputCollapsed",
        textInputContainer.classList.contains("collapsed")
      );
    });
  }

  // Initialize dark mode
  initializeDarkMode();

  // Initialize voices
  if (modelSelect) {
    modelSelect.addEventListener("change", populateVoices);
    populateVoices(); // Initial population
  }

  // Initialize text input handlers
  if (textInput) {
    textInput.addEventListener("input", () => {
      if (convertButton) {
        // Show/hide button based on text content
        convertButton.hidden = !textInput.value.trim();
      }
    });
  }

  // Initialize convert button
  if (convertButton) {
    convertButton.addEventListener("click", async () => {
      if (textInput?.value) {
        const input = textInput.value;
        try {
          // Update button to show processing
          convertButton.disabled = true;
          convertButton.textContent = "Processing text...";

          // Split text into paragraphs and headings
          const normalizedText = input
            .replace(/\r\n/g, "\n")
            .replace(/[\t ]+\n/g, "\n");

          // Split into initial segments
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
                (trimmedLine.toUpperCase() === trimmedLine &&
                  trimmedLine.length < 100); // ALL CAPS lines

              if (isHeading) {
                if (currentParagraph.length > 0) {
                  chunks.push(
                    currentParagraph.join(" ").replace(/\s+/g, " ").trim()
                  );
                  currentParagraph = [];
                }
                chunks.push(trimmedLine);
              } else {
                currentParagraph.push(trimmedLine);
              }
            }

            if (currentParagraph.length > 0) {
              chunks.push(
                currentParagraph.join(" ").replace(/\s+/g, " ").trim()
              );
            }
          }

          const finalChunks = chunks.filter((chunk) => chunk.length > 0);

          console.log("Created chunks:", finalChunks.length);

          // Reset audio queue
          audioQueue = [];

          // Clear audio container
          const audioContainer = document.getElementById("audioContainer");
          if (audioContainer) {
            audioContainer.innerHTML = "";
          }

          // Update UI to show initial state
          updatePlayerUI(null);

          // Process chunks
          for (let i = 0; i < finalChunks.length; i++) {
            convertButton.textContent = `Converting ${
              i + 1}/${finalChunks.length}...`;
            try {
              await convertTextToSpeech(finalChunks[i]);
            } catch (error) {
              console.error(
                `Error converting chunk ${i}:`,
                error
              );
              convertButton.textContent = `Error in chunk ${i + 1}: ${
                error.message
              }`;
              await new Promise((resolve) => setTimeout(resolve, 2000)); // Show error for 2 seconds
            }
          }

          // Reset button state with success message
          convertButton.textContent = "Conversion Complete!";
          setTimeout(() => {
            convertButton.disabled = false;
            convertButton.textContent = "Convert to Speech";
            convertButton.hidden = true; // Hide the button after conversion
          }, 2000);
        } catch (error) {
          console.error("Error processing text:", error);
          convertButton.textContent = `Error: ${
            error.message || "Unknown error"
          }`;
          setTimeout(() => {
            convertButton.disabled = false;
            convertButton.textContent = "Convert to Speech";
          }, 2000);
        }
      }
    });
  }

  // Initialize close button
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      // Clean up audio resources
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      audioQueue = [];
      isProcessingQueue = false;
      window.close();
    });
  }

  // Check for stored selected text
  chrome.storage.local.get(
    ["selectedText", "autoConvert"],
    async function (result) {
      if (result.selectedText && textInput) {
        // Preserve the original text with formatting
        textInput.value = result.selectedText;
        if (convertButton) {
          convertButton.disabled = false;
        }

        if (result.autoConvert) {
          // Chunk the text while preserving formatting
          const chunks = chunkText(result.selectedText);
          console.log("Processing chunks:", chunks.length);

          // Process each chunk
          for (let i = 0; i < chunks.length; i++) {
            updateChunkDisplay(i + 1, chunks.length);
            await convertTextToSpeech(chunks[i]);
          }

          // Reset chunk display
          updateChunkDisplay(0, 0);
        }

        // Clear the stored data
        chrome.storage.local.remove(["selectedText", "autoConvert"]);
      }
    }
  );

  // Initialize page URL conversion
  if (convertPageButton) {
    convertPageButton.addEventListener("click", async () => {
      const messageDiv = document.getElementById("message");
      const urlInput = document.getElementById("pageUrlInput");
      const urlInputGroup = document.querySelector(".url-input-group");

      try {
        let tab;
        let url = urlInput?.value?.trim();

        // Validate URL if provided
        if (url) {
          try {
            url = new URL(url).href;
          } catch (e) {
            throw new Error("Invalid URL format");
          }

          if (!isValidUrl(url)) {
            throw new Error("Cannot access this type of URL");
          }

          // Create a new tab with the URL
          tab = await chrome.tabs.create({ url, active: false });

          // Wait for the page to load
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("Page load timeout")),
              30000
            );

            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab.id && info.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        } else {
          // Get the active tab if no URL is provided
          [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (!tab?.url || !isValidUrl(tab.url)) {
            throw new Error("Cannot access this page type");
          }
        }

        if (!tab?.id) {
          throw new Error("No valid tab found");
        }

        // Extract text from the webpage
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: function (node) {
                  if (
                    !node.parentElement ||
                    node.parentElement.offsetParent === null
                  ) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  if (
                    ["SCRIPT", "STYLE", "NOSCRIPT"].includes(
                      node.parentElement.tagName
                    )
                  ) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  return node.textContent.trim()
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
                },
              }
            );

            const paragraphs = [];
            let currentParagraph = [];
            let node;

            while ((node = walker.nextNode())) {
              const text = node.textContent.trim();
              if (text) {
                const isEndOfParagraph =
                  [
                    "P",
                    "DIV",
                    "H1",
                    "H2",
                    "H3",
                    "H4",
                    "H5",
                    "H6",
                    "LI",
                  ].includes(node.parentElement.tagName) ||
                  node.parentElement.nextElementSibling?.style.display ===
                    "block" ||
                  text.endsWith(".") ||
                  text.endsWith("!") ||
                  text.endsWith("?");

                currentParagraph.push(text);

                if (isEndOfParagraph && currentParagraph.length > 0) {
                  paragraphs.push(currentParagraph.join(" "));
                  currentParagraph = [];
                }
              }
            }

            if (currentParagraph.length > 0) {
              paragraphs.push(currentParagraph.join(" "));
            }

            return paragraphs
              .filter((p) => p.trim().split(/\s+/).length > 3)
              .map((p) => p.replace(/\s+/g, " ").trim());
          },
        });

        // Close the tab if we created it from URL input
        if (url) {
          chrome.tabs.remove(tab.id);
        }

        if (!result?.result || result.result.length === 0) {
          throw new Error("No readable text found on the page");
        }

        // Disable the button during conversion
        const originalButtonText = convertPageButton.textContent;
        const originalButtonIcon = '<i class="fa-solid fa-book-open-reader"></i>';
        const spinningIconHtml = 'Working <i class="fas fa-spinner fa-spin"></i> ';
        convertPageButton.disabled = true;
        convertPageButton.innerHTML = spinningIconHtml;
        convertPageButton.style.cursor = 'wait';

        // Process the text chunks
        await handleWebPageConversion(result.result, result.result.length);
        hideUrlInputGroup(); // Hide URL input group after successful conversion

        // Clear the URL input after successful conversion
        if (urlInput) {
          urlInput.value = "";
        }

        // Re-enable the button after conversion
        convertPageButton.disabled = false;
        convertPageButton.innerHTML = ' Read Page' + originalButtonIcon;
        convertPageButton.style.cursor = 'pointer';
      } catch (error) {
        // Show the URL input field after error if it was previously hidden


        if (urlInput && urlInput.hidden) {
          urlInput.hidden = false;
          if (urlInputGroup) {
            urlInputGroup.style.display = "flex";
          }
        } else {
          console.error("Error converting page:", error);
          showMessage(`Error: ${
            error.message || "Failed to convert page"
          }. Please try again.`);
        }

        // Re-enable the button after error
        if (convertPageButton) {
          const originalButtonIcon = '<i class="fa-solid fa-book-open-reader"></i>';
          convertPageButton.disabled = false;
          convertPageButton.innerHTML = originalButtonIcon + ' Read Page';
          convertPageButton.style.cursor = 'pointer';
        }
      }
    });
  }

  // Open floating window
  if (openInFloatingWindow) {
    openInFloatingWindow.addEventListener("click", async () => {
      // Send message to background script to create floating window
      await chrome.runtime.sendMessage({
        action: "createFloatingWindow",
        selectedText: "", // No text selected when opening from icon
      });
      // Close the popup
      window.close();
    });
  }

  // Handle messages from background script
  const messageListener = async (message, sender, sendResponse) => {
    try {
      if (!chrome.runtime?.id) {
        throw new Error("Extension context invalid");
      }

      if (
        isFloatingWindow &&
        message.action === "newTextSelected" &&
        message.text &&
        textInput
      ) {
        textInput.value = message.text;
        if (convertButton) {
          convertButton.disabled = false;
        }
        console.log("Original text:", message.text);

        try {
          // Chunk the text while preserving formatting
          const chunks = chunkText(message.text);
          console.log("Processing chunks:", chunks.length);

          // Process each chunk
          for (let i = 0; i < chunks.length; i++) {
            updateChunkDisplay(i + 1, chunks.length);
            await convertTextToSpeech(chunks[i]);
          }

          // Reset chunk display
          updateChunkDisplay(0, 0);
        } catch (error) {
          console.error("Error processing chunks:", error);
          if (convertButton) {
            convertButton.textContent = `Error: ${error.message}`;
            setTimeout(() => {
              convertButton.disabled = false;
              convertButton.textContent = "Convert to Speech";
            }, 2000);
          }
        }
      }
      // Send response to prevent "The message port closed before a response was received" warning
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error in message listener:", error);
      sendResponse({ success: false, error: error.message });
    }
    // Return true to indicate we'll send a response asynchronously
    return true;
  };

  // Remove existing message listener before adding a new one
  if (chrome.runtime?.onMessage?.hasListener(messageListener)) {
    chrome.runtime.onMessage.removeListener(messageListener);
  }

  // Add message listener
  chrome.runtime.onMessage.addListener(messageListener);

  // Clean up on window unload
  window.addEventListener("unload", () => {
    // Remove event listeners
    if (modelSelect) {
      modelSelect.removeEventListener("change", populateVoices);
    }
    if (closeButton) {
      closeButton.removeEventListener("click", window.close);
    }
    chrome.runtime.onMessage.removeListener(messageListener);

    // Clean up audio resources
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    audioQueue = [];
    isProcessingQueue = false;
  });

  // Update language options first
  updateLanguageOptions();

  // Then initialize settings
  await initializeSettings();
  const settings = await loadSettings();
  updateLanguageDisplay(settings.model);
});

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

// Function to initialize global progress bar
function initializeGlobalProgress() {
  const track = document.querySelector('.global-track');
  const markers = document.getElementById('partMarkers');
  
  if (!track || !markers || !currentConversion.id) return;

  // Ensure we have valid durations
  if (currentConversion.totalDuration <= 0) {
    let total = 0;
    currentConversion.parts.forEach(part => {
      if (part.audio.duration) {
        total += part.audio.duration;
      }
    });
    currentConversion.totalDuration = total;
  }

  // Clear existing markers
  markers.innerHTML = '';
  
  // Create markers for each part
  currentConversion.parts.forEach((part, index) => {
    const startTime = currentConversion.parts
      .slice(0, index)
      .reduce((sum, p) => sum + (p.duration || 0), 0);

    const marker = document.createElement('div');
    marker.className = 'marker';
    const position = (startTime / currentConversion.totalDuration) * 100;
    marker.style.left = `${position}%`;
    marker.setAttribute('data-index', index);
    marker.setAttribute('data-start', startTime);
    
    // Add click handler for the marker
    marker.addEventListener('click', (event) => {
      event.stopPropagation();
      const clickedIndex = parseInt(event.target.getAttribute('data-index'));
      const startTime = parseFloat(event.target.getAttribute('data-start'));
      
      if (currentConversion.parts[clickedIndex]) {
        const targetEntry = audioQueue[clickedIndex];
        if (targetEntry) {
          if (currentAudio) {
            currentAudio.pause();
          }
          
          // Update queue and play from the clicked part
          audioQueue = audioQueue.slice(clickedIndex);
          currentAudio = targetEntry.audio;
          currentAudio.currentTime = 0; // Start from beginning of the clicked part
          
          // Update global progress state
          globalProgress.currentPartIndex = clickedIndex;
          globalProgress.currentTime = startTime;
          
          // Play the audio and update UI
          currentAudio.play().catch(error => {
            console.error('Error playing audio:', error);
          });
          updatePlayerUI(targetEntry);
          
          // Update marker states
          document.querySelectorAll('.marker').forEach((m, i) => {
            m.classList.toggle('active', i === clickedIndex);
          });
        }
      }
    });
    
    markers.appendChild(marker);
  });

  // Add click handler for the track
  track.removeEventListener('click', handleTrackClick);
  track.addEventListener('click', handleTrackClick);
}

// Function to handle track clicks
function handleTrackClick(event) {
  if (!currentAudio || !currentConversion.totalDuration) return;

  const track = event.currentTarget;
  const rect = track.getBoundingClientRect();
  const clickPosition = (event.clientX - rect.left) / rect.width;
  const targetTime = clickPosition * currentConversion.totalDuration;

  let accumulatedTime = 0;
  let targetPart = null;
  let timeInPart = 0;

  for (let i = 0; i < currentConversion.parts.length; i++) {
    const part = currentConversion.parts[i];
    if (targetTime >= accumulatedTime && targetTime < accumulatedTime + part.duration) {
      targetPart = part;
      timeInPart = targetTime - accumulatedTime;
      break;
    }
    accumulatedTime += part.duration;
  }

  if (!targetPart && targetTime >= currentConversion.totalDuration) {
    targetPart = currentConversion.parts[currentConversion.parts.length - 1];
    timeInPart = targetPart.duration;
  }

  if (targetPart) {
    const targetEntry = audioQueue[targetPart.index];
    if (targetEntry) {
      if (currentAudio) {
        currentAudio.pause();
      }
      audioQueue = audioQueue.slice(targetPart.index);
      currentAudio = targetEntry.audio;
      currentAudio.currentTime = Math.min(timeInPart, currentAudio.duration);
      currentAudio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
      updatePlayerUI(targetEntry);
    }
  }
}

// Function to update global progress
function updateGlobalProgress() {
  if (!currentAudio || !currentConversion.totalDuration) return;

  const fill = document.querySelector('.global-fill');
  const markers = document.querySelectorAll('.marker');
  const prevTime = document.getElementById('prevTime');
  const nextTime = document.getElementById('nextTime');

  const currentPartIndex = currentConversion.parts.findIndex(part => part.audio === currentAudio);
  if (currentPartIndex === -1) return;

  // Calculate global current time
  const previousPartsTime = currentConversion.parts
    .slice(0, currentPartIndex)
    .reduce((sum, part) => sum + (part.duration || 0), 0);
  const globalCurrentTime = previousPartsTime + currentAudio.currentTime;

  // Update fill
  if (fill) {
    const progressPercentage = (globalCurrentTime / currentConversion.totalDuration) * 100;
    fill.style.width = `${progressPercentage}%`;
  }

  // Update markers
  markers.forEach(marker => {
    const index = parseInt(marker.getAttribute('data-index'));
    marker.classList.toggle('active', index === currentPartIndex);
  });

  // Update time labels
  if (prevTime && currentPartIndex > 0) {
    const prevPartStartTime = currentConversion.parts
      .slice(0, currentPartIndex)
      .reduce((sum, part) => sum + (part.duration || 0), 0);
    prevTime.textContent = formatTime(prevPartStartTime);
  } else if (prevTime) {
    prevTime.textContent = '0:00';
  }

  if (nextTime && currentPartIndex < currentConversion.parts.length - 1) {
    const nextPartStartTime = currentConversion.parts
      .slice(0, currentPartIndex + 1)
      .reduce((sum, part) => sum + (part.duration || 0), 0);
    nextTime.textContent = formatTime(nextPartStartTime);
  } else if (nextTime) {
    nextTime.textContent = formatTime(currentConversion.totalDuration);
  }
}

// Function to generate conversion ID
function generateConversionId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Function to reset conversion state
function resetConversionState() {
  currentConversion = {
    id: generateConversionId(),
    parts: [],
    totalDuration: 0,
    isComplete: false
  };
  globalProgress = {
    totalDuration: 0,
    currentTime: 0,
    parts: [],
    conversionId: currentConversion.id,
    isPlaying: false,
    currentPartIndex: 0,
    currentText: ''
  };
  
  // Reset UI elements
  const fill = document.querySelector('.global-fill');
  const markers = document.getElementById('partMarkers');
  if (fill) fill.style.width = '0%';
  if (markers) markers.innerHTML = '';
}

// Function to add audio part to current conversion
function addAudioPart(audioEntry) {
  if (!currentConversion.id) {
    resetConversionState();
  }

  const part = {
    index: currentConversion.parts.length,
    audio: audioEntry.audio,
    text: audioEntry.text,
    duration: 0
  };

  // Wait for audio duration to be available
  const checkDuration = () => {
    if (audioEntry.audio.duration) {
      part.duration = audioEntry.audio.duration;
      currentConversion.totalDuration += part.duration;
      updateGlobalProgress();
    } else {
      setTimeout(checkDuration, 100);
    }
  };
  checkDuration();

  currentConversion.parts.push(part);
  return part;
}

function resetConversionState() {
  currentConversion = {
    id: generateConversionId(),
    parts: [],
    totalDuration: 0,
    isComplete: false
  };
  
  // Reset global progress
  globalProgress = {
    totalDuration: 0,
    currentTime: 0,
    parts: [],
    conversionId: currentConversion.id,
    isPlaying: false,
    currentPartIndex: 0,
    currentText: ''
  };
  
  // Reset UI elements
  const fill = document.querySelector('.global-fill');
  const markers = document.getElementById('partMarkers');
  if (fill) fill.style.width = '0%';
  if (markers) markers.innerHTML = '';
}

// Update the updatePlayerUI function to use global state
function updatePlayerUI(entry) {
  const textDisplay = document.getElementById("currentAudioText");
  if (textDisplay && entry.text) {
    textDisplay.textContent = entry.text;
    globalProgress.currentText = entry.text;
  }

  // Update progress tracking
  globalProgress.isPlaying = true;
  globalProgress.currentPartIndex = audioQueue.findIndex(item => item === entry);
  
  updateGlobalProgress();
}

function setupAudioListeners(audio) {
  const updateProgress = () => {
    const currentTimeDisplay = document.getElementById("currentTime");
    const durationDisplay = document.getElementById("duration");
    const progressRing = document.querySelector(".progress-ring-circle");
    
    if (currentTimeDisplay) {
      currentTimeDisplay.textContent = formatTime(audio.currentTime);
    }
    if (durationDisplay) {
      durationDisplay.textContent = formatTime(audio.duration);
    }
    if (progressRing) {
      const progress = audio.currentTime / audio.duration || 0;
      const circumference = 163.36;
      const offset = circumference - progress * circumference;
      progressRing.style.strokeDashoffset = offset;
    }
    
    updateGlobalProgress();
  };

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("durationchange", updateProgress);
  audio.addEventListener("ended", () => {
    audio.removeEventListener("timeupdate", updateProgress);
  });
}
