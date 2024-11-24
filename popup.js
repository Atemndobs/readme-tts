// Global variables
let currentAudio = null;
let audioElements = [];
let audioQueue = [];
let isProcessingQueue = false;
let savedInputText = null;

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
    "voice-en-us-josh-low",
    "voice-en-us-ryan-low",
    "voice-en-us-kathleen-low"
  ],
  "voice-en-gb": ["voice-en-gb-alan-low"],
  "voice-de": [
    "voice-de-thorsten-low",
    "voice-de-kerstin-low"
  ],
  "voice-es": [
    "voice-es-carlfm-x-low"
  ],
  "voice-fr": [
    "voice-fr-gilles-low",
    "voice-fr-mls_1840-low",
    "voice-fr-siwis-low",
    "voice-fr-siwis-medium"
  ],
  "voice-it": ["voice-it-paola-medium"]
};

// Function to populate voices based on selected model
async function populateVoices() {
  const voiceSelect = document.getElementById('voiceSelect');
  if (!voiceSelect) return;

  // Clear existing options
  voiceSelect.innerHTML = '';
  
  // Get the selected model
  const modelSelect = document.getElementById('modelSelect');
  const selectedModel = modelSelect?.value || 'voice-en-us';
  
  // Define voices for each model
  const voices = {
    'voice-en-us': [
      { id: 'voice-en-us-amy-low', name: 'Amy' },
      { id: 'voice-en-us-josh-low', name: 'Josh' },
      { id: 'voice-en-us-ryan-low', name: 'Ryan' },
      { id: 'voice-en-us-kathleen-low', name: 'Kathleen' }
    ],
    'voice-de': [
      { id: 'voice-de-thorsten-low', name: 'Thorsten' },
      { id: 'voice-de-kerstin-low', name: 'Kerstin' }
    ],
    'voice-fr': [
      { id: 'voice-fr-jean-low', name: 'Jean' },
      { id: 'voice-fr-marie-low', name: 'Marie' }
    ],
    'voice-es': [
      { id: 'voice-es-pedro-low', name: 'Pedro' },
      { id: 'voice-es-lucia-low', name: 'Lucia' }
    ],
    'voice-it': [
      { id: 'voice-it-marco-low', name: 'Marco' },
      { id: 'voice-it-sofia-low', name: 'Sofia' }
    ]
  };

  // Add voices for selected model
  const modelVoices = voices[selectedModel] || [];
  modelVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.id;
    option.textContent = voice.name;
    voiceSelect.appendChild(option);
  });

  // Load persisted settings
  const settings = await loadSettings();
  
  // If we have a persisted voice for this model, select it
  if (settings.voice && modelVoices.some(v => v.id === settings.voice)) {
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
  const modelSelect = document.getElementById('modelSelect');
  if (!modelSelect) return;

  // Clear existing options
  modelSelect.innerHTML = '';

  // Define languages with their display names
  const languages = [
    { id: 'voice-en-us', name: 'English (EN)' },
    { id: 'voice-de', name: 'German (DE)' },
    { id: 'voice-fr', name: 'French (FR)' },
    { id: 'voice-es', name: 'Spanish (ES)' },
    { id: 'voice-it', name: 'Italian (IT)' }
  ];

  // Add language options
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.id;
    option.textContent = lang.name;
    modelSelect.appendChild(option);
  });
}

// Function to update voice options based on selected model
async function updateVoiceOptions(model) {
  const voiceSelect = document.getElementById('voiceSelect');
  if (!voiceSelect) return;

  console.log('Updating voice options for model:', model);

  // Clear existing options
  voiceSelect.innerHTML = '';

  // Get voices for selected model
  const voices = {
    'voice-en-us': [
      { id: 'voice-en-us-amy-low', name: 'Amy' },
      { id: 'voice-en-us-josh-low', name: 'Josh' },
      { id: 'voice-en-us-ryan-low', name: 'Ryan' },
      { id: 'voice-en-us-kathleen-low', name: 'Kathleen' }
    ],
    'voice-de': [
      { id: 'voice-de-thorsten-low', name: 'Thorsten' },
      { id: 'voice-de-kerstin-low', name: 'Kerstin' }
    ],
    'voice-fr': [
      { id: 'voice-fr-jean-low', name: 'Jean' },
      { id: 'voice-fr-marie-low', name: 'Marie' }
    ],
    'voice-es': [
      { id: 'voice-es-pedro-low', name: 'Pedro' },
      { id: 'voice-es-lucia-low', name: 'Lucia' }
    ],
    'voice-it': [
      { id: 'voice-it-marco-low', name: 'Marco' },
      { id: 'voice-it-sofia-low', name: 'Sofia' }
    ]
  };

  // Add options for each voice
  const modelVoices = voices[model] || voices['voice-en-us'];
  modelVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.id;
    option.textContent = voice.name;
    voiceSelect.appendChild(option);
  });

  // Load current settings
  const settings = loadSettings();
  
  // If we have a voice for this model, use it
  const voiceForModel = modelVoices.find(v => v.id === settings.voice);
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
  console.log('Saved settings after voice update:', settings);
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
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

// Function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to retry an operation
async function retryOperation(operation, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (!isExtensionContextValid()) {
        throw new Error('Extension context invalidated');
      }
      return await operation();
    } catch (error) {
      lastError = error;
      if (error.message.includes('Extension context invalidated')) {
        console.log(`Attempt ${i + 1}/${maxRetries} failed due to invalid context, retrying...`);
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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return false;
      
      // Check for restricted URLs
      const restrictedUrls = ['chrome://', 'chrome-extension://', 'about:', 'file://', 'edge://', 'about:blank'];
      if (tab.url && restrictedUrls.some(url => tab.url.startsWith(url))) {
        console.log('Cannot access restricted URL:', tab.url);
        return false;
      }

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString().trim()
      });

      return result.length > 0;
    });
  } catch (error) {
    console.error('Error checking text selection:', error);
    if (error.message.includes('Extension context invalidated')) {
      if (selectionStatus) {
        selectionStatus.textContent = 'Extension reloaded. Please refresh the page.';
        selectionStatus.classList.add('text-red-500');
      }
    }
    return false;
  }
}

// Function to get selected text
async function getSelectedText() {
  try {
    return await retryOperation(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return '';
      
      // Check for restricted URLs
      const restrictedUrls = ['chrome://', 'chrome-extension://', 'about:', 'file://', 'edge://', 'about:blank'];
      if (tab.url && restrictedUrls.some(url => tab.url.startsWith(url))) {
        console.log('Cannot access restricted URL:', tab.url);
        return '';
      }

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString().trim()
      });

      return result;
    });
  } catch (error) {
    console.error('Error getting selected text:', error);
    if (error.message.includes('Extension context invalidated')) {
      if (messageDiv) {
        messageDiv.textContent = 'Extension reloaded. Please refresh the page.';
        messageDiv.classList.add('text-red-500');
      }
    }
    return '';
  }
}

// Function to convert text to speech
async function convertTextToSpeech(text) {
  if (!text.trim()) return;
  
  const settings = loadSettings();
  
  try {
    if (!chrome.runtime?.id) {
      throw new Error('Extension context invalid');
    }

    // if (messageDiv) {
    //   messageDiv.textContent = 'Converting text to speech...';
    // }

    console.log('Making API request with:', {
      input: text,
      model: settings.voice,
      voice: settings.voice
    });

    const response = await fetch('https://voice.cloud.atemkeng.de/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: settings.voice,
        voice: settings.voice
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', errorData);
      throw new Error(`Server error: ${response.status} - ${errorData}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Received empty audio data');
    }

    console.log('Received audio blob:', blob);

    const audioUrl = URL.createObjectURL(blob);
    console.log('Created audio URL:', audioUrl);

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
    console.error('Error converting text to speech:', error);
    if (messageDiv) {
      messageDiv.textContent = `Error: ${error.message}`;
      setTimeout(() => {
        messageDiv.textContent = '';
      }, 5000);
    }
    throw error;
  }
}

// Function to create audio entry
function createAudioEntry(text, audioUrl) {
  const audio = new Audio(audioUrl);
  
  // Set up audio event listeners
  audio.addEventListener('loadedmetadata', () => {
    console.log('Audio metadata loaded:', {
      duration: audio.duration,
      readyState: audio.readyState
    });
    
    // Validate duration before updating UI
    if (!isNaN(audio.duration) && isFinite(audio.duration)) {
      updatePlayerUI({ audio, text });
    } else {
      console.warn('Invalid duration after metadata load:', audio.duration);
    }
  });

  // Handle play/pause events
  audio.addEventListener('play', () => {
    console.log('Audio playing');
    updatePlayerUI({ audio, text });
  });

  audio.addEventListener('pause', () => {
    console.log('Audio paused');
    updatePlayerUI({ audio, text });
  });

  // Handle errors
  audio.addEventListener('error', (e) => {
    console.error('Audio error:', e.target.error);
    if (messageDiv) {
      messageDiv.textContent = 'Error playing audio. Please try again.';
    }
  });

  // Handle audio loading
  audio.addEventListener('canplay', () => {
    console.log('Audio can play');
    updatePlayerUI({ audio, text });
  });

  // Handle audio ended
  audio.addEventListener('ended', () => {
    console.log('Audio ended, checking for next audio');
    const currentIndex = audioQueue.findIndex(entry => entry.audio === audio);
    if (currentIndex < audioQueue.length - 1) {
      // Play next audio
      const nextEntry = audioQueue[currentIndex + 1];
      currentAudio = nextEntry.audio;
      currentAudio.play().catch(error => {
        console.error('Error playing next audio:', error);
        if (messageDiv) {
          messageDiv.textContent = 'Error playing next audio. Please try again.';
          setTimeout(() => messageDiv.textContent = '', 3000);
        }
      });
      updatePlayerUI(nextEntry);
    } else {
      console.log('No more audio in queue');
      // Reset play button when playlist ends
      const playIcon = document.querySelector('#playPauseButton i');
      if (playIcon) {
        playIcon.className = 'fa-solid fa-play';
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
    console.log('Processing audio queue:', {
      queueLength: audioQueue.length,
      currentAudio: currentEntry?.audio?.src
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
      console.log('Audio ended, processing next in queue');
      audioQueue.shift(); // Remove the finished audio
      isProcessingQueue = false;
      currentEntry.audio.removeEventListener('ended', onEnded);
      processAudioQueue(); // Process next in queue
    };
    
    currentEntry.audio.addEventListener('ended', onEnded);
    
    console.log('Playing audio:', currentEntry.audio.src);
    await currentEntry.audio.play().catch(error => {
      console.error('Error playing audio:', error);
      throw error;
    });
    
    // Update UI
    updatePlayerUI(currentEntry);
  } catch (error) {
    console.error('Error playing audio:', error);
    if (messageDiv) {
      messageDiv.textContent = 'Error playing audio. Please try again.';
    }
    isProcessingQueue = false;
    audioQueue.shift();
    processAudioQueue();
  }
}

// Function to add to audio queue
function addToAudioQueue(audioEntry) {
  audioQueue.push(audioEntry);
  if (audioQueue.length === 1) { // If this is the first entry, start processing
    processAudioQueue();
  }
}

// Function to update player UI
function updatePlayerUI(audioEntry) {
  const playButton = document.querySelector('.play-button');
  const progressRing = document.querySelector('.progress-ring-circle');
  const currentTimeDisplay = document.getElementById('currentTime');
  const durationDisplay = document.getElementById('duration');
  const currentChunkDisplay = document.getElementById('currentChunk');
  const totalChunksDisplay = document.getElementById('totalChunks');
  const currentAudioTextDisplay = document.getElementById('currentAudioText');

  // Update total chunks immediately
  if (totalChunksDisplay) {
    totalChunksDisplay.textContent = audioQueue.length.toString();
  }
  
  if (!audioEntry || !audioEntry.audio) {
    // Reset UI when no audio is playing
    if (playButton) {
      playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
      playButton.classList.remove('playing');
    }
    if (progressRing) {
      progressRing.style.strokeDashoffset = 163.36; // Full circle
    }
    if (currentTimeDisplay) currentTimeDisplay.textContent = '0:00';
    if (durationDisplay) durationDisplay.textContent = '0:00';
    if (currentChunkDisplay) currentChunkDisplay.textContent = '0';
    if (currentAudioTextDisplay) currentAudioTextDisplay.textContent = '';
    if (textInput) textInput.value = '';
    return;
  }

  const { audio, text } = audioEntry;
  
  // Update play/pause button
  if (playButton) {
    playButton.innerHTML = audio.paused ? 
      '<i class="fa-solid fa-play"></i>' : 
      '<i class="fa-solid fa-pause"></i>';
    playButton.classList.toggle('playing', !audio.paused);
  }

  // Update progress ring and time displays
  const updateProgress = () => {
    // Skip if audio isn't ready
    if (!audio.readyState) {
      console.log('Audio not ready yet');
      return;
    }

    // Ensure we have valid duration
    if (isNaN(audio.duration) || !isFinite(audio.duration)) {
      console.warn('Invalid audio duration:', audio.duration);
      return;
    }

    // Update progress ring
    if (progressRing) {
      const progress = (audio.currentTime / audio.duration) || 0;
      const circumference = 163.36;
      const offset = circumference - (progress * circumference);
      progressRing.style.strokeDashoffset = offset;
    }

    // Update time displays with validation
    if (currentTimeDisplay && !isNaN(audio.currentTime)) {
      currentTimeDisplay.textContent = formatTime(Math.max(0, audio.currentTime));
    }
    if (durationDisplay && !isNaN(audio.duration)) {
      durationDisplay.textContent = formatTime(Math.max(0, audio.duration));
    }
  };

  // Add timeupdate listener for continuous progress updates
  audio.removeEventListener('timeupdate', updateProgress); // Remove any existing listener
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('durationchange', updateProgress); // Add listener for when duration becomes available
  
  // Initial progress update if audio is ready
  if (audio.readyState) {
    updateProgress();
  }

  // Update chunk information
  const currentIndex = audioQueue.findIndex(entry => entry === audioEntry) + 1;
  if (currentChunkDisplay) {
    currentChunkDisplay.textContent = currentIndex.toString();
  }

  // Update text preview
  if (currentAudioTextDisplay) {
    currentAudioTextDisplay.textContent = text.length > 100 ? 
      text.substring(0, 100) + '...' : 
      text;
  }

  // Update input field with current chunk text
  if (textInput && !audio.paused) {
    textInput.value = text;
  }

  // Clean up timeupdate listener when audio ends
  audio.addEventListener('ended', () => {
    audio.removeEventListener('timeupdate', updateProgress);
  });
}

// Function to format time
function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Function to validate URL for content script injection
function isValidUrl(url) {
  const restrictedPatterns = [
    'chrome://',
    'chrome-extension://',
    'chrome-search://',
    'chrome-devtools://',
    'about:',
    'edge://',
    'data:',
    'view-source:'
  ];
  return url && !restrictedPatterns.some(pattern => url.startsWith(pattern));
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
      // if (messageDiv) {
      //   messageDiv.textContent = `Converting page: ${i + 1}/${totalChunks} chunks`;
      // }
    } catch (error) {
      console.error(`Error converting chunk ${i}:`, error);
            if (messageDiv) {
        messageDiv.textContent = `Error converting chunk ${i + 1}/${totalChunks}, ${error.message || 'Unknown error'}`;
        setTimeout(() => {
          if (messageDiv) {
            messageDiv.textContent = '';
          }
        }, 3000);
      }
      continue;
    }
  }
  
  if (messageDiv) {
    messageDiv.textContent = "Page conversion completed!";
    messageDiv.className = 'success';
    setTimeout(() => {
      if (messageDiv) {
        messageDiv.textContent = "";
        messageDiv.className = '';
      }
    }, 3000);
  }

  // Hide convert button after successful conversion
  if (convertButton) {
    convertButton.hidden = true;
  }
}

// Function to update chunk display
function updateChunkDisplay(current, total) {
  const currentChunkDisplay = document.getElementById('currentChunk');
  const totalChunksDisplay = document.getElementById('totalChunks');
  
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
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/[\t ]+\n/g, '\n');

  // Split into initial segments (paragraphs)
  const segments = normalizedText.split(/\n\s*\n+/);
  
  // Process each segment and detect headings
  const chunks = [];
  for (const segment of segments) {
    const lines = segment.split('\n');
    let currentParagraph = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check if line is a heading/title
      const isHeading = (
        /^#{1,6}\s+/.test(trimmedLine) || // Markdown headings
        /^(?:[0-9A-Z][.)]\s+|[0-9]+[.)][0-9.]*[.)]\s+)/i.test(trimmedLine) || // Numbered headings
        (trimmedLine.length < 100 && !/[.!?:,;]$/.test(trimmedLine) && /^[A-Z]/.test(trimmedLine)) || // Short title-like lines
        (trimmedLine.toUpperCase() === trimmedLine && trimmedLine.length < 100) // ALL CAPS lines
      );

      if (isHeading) {
        // If we have accumulated paragraph text, add it as a chunk
        if (currentParagraph.length > 0) {
          chunks.push(currentParagraph.join(' ').replace(/\s+/g, ' ').trim());
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
      chunks.push(currentParagraph.join(' ').replace(/\s+/g, ' ').trim());
    }
  }

  // Filter out empty chunks and ensure minimum length
  return chunks.filter(chunk => chunk.length > 0);
}

// Settings management
const defaultSettings = {
  voice: 'amy',
  model: 'voice-en-us-amy-low'
};

// Load settings from storage
function loadSettings() {
  const voice = localStorage.getItem('ttsVoice') || defaultSettings.voice;
  const model = localStorage.getItem('ttsModel') || defaultSettings.model;
  return { voice, model };
}

// Save settings to storage
function saveSettings(settings) {
  localStorage.setItem('ttsVoice', settings.voice);
  localStorage.setItem('ttsModel', settings.model);
}

// Function to initialize settings
async function initializeSettings() {
  const settings = loadSettings();
  const modelSelect = document.getElementById('modelSelect');
  
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
  await updateVoiceOptions(settings.model || modelSelect?.value || 'voice-en-us');
  
  // Set voice if we have a persisted value
  const voiceSelect = document.getElementById('voiceSelect');
  if (voiceSelect && settings.voice) {
    // Check if the persisted voice is available for current model
    const voiceExists = Array.from(voiceSelect.options).some(opt => opt.value === settings.voice);
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
  document.getElementById('modelSelect').value = settings.model;
  updateVoiceOptions(settings.model);
  
  // Wait for voice options to be updated before setting the voice
  setTimeout(() => {
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
      voiceSelect.value = settings.voice;
    }
  }, 100);
}

// Function to update language display
function updateLanguageDisplay(model) {
  const languageDisplay = document.getElementById('currentLanguage');
  if (!languageDisplay) return;

  // Extract language code from model name
  const languageMap = {
    'en': 'EN',
    'de': 'DE',
    'es': 'ES',
    'fr': 'FR',
    'it': 'IT'
  };

  const langCode = model.split('-')[1]?.toLowerCase() || 'en';
  languageDisplay.textContent = languageMap[langCode] || 'EN';
}

// Settings modal handlers
document.getElementById('settingsButton').addEventListener('click', () => {
  // Load current settings
  const settings = loadSettings();
  console.log('Settings modal opened with settings:', settings);
  
  // Update model select
  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) {
    modelSelect.value = settings.model;
  }
  
  // Update voice options and select current voice
  updateVoiceOptions(settings.model);
  
  // Show modal
  document.getElementById('settingsModal').style.display = 'block';
});

document.getElementById('closeSettings').addEventListener('click', () => {
  document.getElementById('settingsModal').style.display = 'none';
});

// Close modal when clicking outside
document.getElementById('settingsModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('settingsModal')) {
    document.getElementById('settingsModal').style.display = 'none';
  }
});

// Save settings when changed
document.getElementById('modelSelect').addEventListener('change', (e) => {
  console.log('Model changed to:', e.target.value);
  updateVoiceOptions(e.target.value);
  updateLanguageDisplay(e.target.value);
});

document.getElementById('voiceSelect').addEventListener('change', (e) => {
  console.log('Voice changed to:', e.target.value);
  const settings = loadSettings();
  settings.voice = e.target.value;
  saveSettings(settings);
});

// Function to initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Check if this is a floating window
  const urlParams = new URLSearchParams(window.location.search);
  const isFloatingWindow = urlParams.get('floating') === 'true';

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
  const playPauseButton = document.getElementById('playPauseButton');
  const prevButton = document.getElementById('prevAudio');
  const nextButton = document.getElementById('nextAudio');
  
  // Play/Pause button click handler
  if (playPauseButton) {
    playPauseButton.addEventListener('click', () => {
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
        const currentEntry = audioQueue.find(entry => entry.audio === currentAudio);
        if (currentEntry) {
          updatePlayerUI(currentEntry);
        }
      }
    });
  }

  // Previous button click handler
  if (prevButton) {
    prevButton.addEventListener('click', () => {
      if (currentAudio && audioQueue.length > 0) {
        const currentIndex = audioQueue.findIndex(entry => entry.audio === currentAudio);
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
    nextButton.addEventListener('click', () => {
      if (currentAudio && audioQueue.length > 0) {
        const currentIndex = audioQueue.findIndex(entry => entry.audio === currentAudio);
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
    refreshButton.addEventListener('click', () => {
      // Add spinning animation class
      refreshButton.querySelector('i').classList.add('fa-spin');
      
      // Reload the page after a brief delay to show the animation
      setTimeout(() => {
        window.location.reload();
      }, 300);
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
          convertButton.textContent = 'Processing text...';

          // Split text into paragraphs and headings
          const normalizedText = input
            .replace(/\r\n/g, '\n')
            .replace(/[\t ]+\n/g, '\n');

          // Split into initial segments
          const segments = normalizedText.split(/\n\s*\n+/);
          
          // Process each segment and detect headings
          const chunks = [];
          for (const segment of segments) {
            const lines = segment.split('\n');
            let currentParagraph = [];

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              // Check if line is a heading/title
              const isHeading = (
                /^#{1,6}\s+/.test(trimmedLine) || // Markdown headings
                /^(?:[0-9A-Z][.)]\s+|[0-9]+[.)][0-9.]*[.)]\s+)/i.test(trimmedLine) || // Numbered headings
                (trimmedLine.length < 100 && !/[.!?:,;]$/.test(trimmedLine) && /^[A-Z]/.test(trimmedLine)) || // Short title-like lines
                (trimmedLine.toUpperCase() === trimmedLine && trimmedLine.length < 100) // ALL CAPS lines
              );

              if (isHeading) {
                if (currentParagraph.length > 0) {
                  chunks.push(currentParagraph.join(' ').replace(/\s+/g, ' ').trim());
                  currentParagraph = [];
                }
                chunks.push(trimmedLine);
              } else {
                currentParagraph.push(trimmedLine);
              }
            }

            if (currentParagraph.length > 0) {
              chunks.push(currentParagraph.join(' ').replace(/\s+/g, ' ').trim());
            }
          }

          const finalChunks = chunks.filter(chunk => chunk.length > 0);

          console.log('Created chunks:', finalChunks.length);
          
          // Reset audio queue
          audioQueue = [];
          
          // Clear audio container
          const audioContainer = document.getElementById('audioContainer');
          if (audioContainer) {
            audioContainer.innerHTML = '';
          }

          // Update UI to show initial state
          updatePlayerUI(null);

          // Process chunks
          for (let i = 0; i <finalChunks.length; i++) {
            const chunk = finalChunks[i];
            // Detect if this chunk is a heading
            const isHeading = (
              /^#{1,6}\s+/.test(chunk) || // Markdown headings
              /^(?:[0-9A-Z][.)]\s+|[0-9]+[.)][0-9.]*[.)]\s+)/i.test(chunk) || // Numbered headings
              (chunk.length < 100 && !/[.!?:,;]$/.test(chunk) && /^[A-Z]/.test(chunk)) || // Short title-like lines
              (chunk.toUpperCase() === chunk && chunk.length < 100) // ALL CAPS lines
            );

            convertButton.textContent = `Converting ${isHeading ? 'heading' : 'paragraph'} ${i + 1}/${finalChunks.length}...`;
            try {
              await convertTextToSpeech(finalChunks[i]);
            } catch (error) {
              console.error(`Error converting ${isHeading ? 'heading' : 'paragraph'} ${i + 1}:`, error);
              convertButton.textContent = `Error in ${isHeading ? 'heading' : 'paragraph'} ${i + 1}: ${error.message}`;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Show error for 2 seconds
            }
          }

          // Reset button state with success message
          convertButton.textContent = 'Conversion Complete!';
          setTimeout(() => {
            convertButton.disabled = false;
            convertButton.textContent = 'Convert to Speech';
            convertButton.hidden = true;  // Hide the button after conversion
          }, 2000);

        } catch (error) {
          console.error('Error processing text:', error);
          convertButton.textContent = `Error: ${error.message || 'Unknown error'}`;
          setTimeout(() => {
            convertButton.disabled = false;
            convertButton.textContent = 'Convert to Speech';
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
  chrome.storage.local.get(['selectedText', 'autoConvert'], async function(result) {
    if (result.selectedText && textInput) {
      // Preserve the original text with formatting
      textInput.value = result.selectedText;
      if (convertButton) {
        convertButton.disabled = false;
      }
      
      if (result.autoConvert) {
        // Chunk the text while preserving formatting
        const chunks = chunkText(result.selectedText);
        console.log('Processing chunks:', chunks.length);
        
        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
          updateChunkDisplay(i + 1, chunks.length);
          await convertTextToSpeech(chunks[i]);
        }
        
        // Reset chunk display
        updateChunkDisplay(0, 0);
      }
      
      // Clear the stored data
      chrome.storage.local.remove(['selectedText', 'autoConvert']);
    }
  });

  // Initialize page URL conversion
  if (convertPageButton) {
    convertPageButton.addEventListener("click", async () => {
      const messageDiv = document.getElementById("message");
      
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
            const timeout = setTimeout(() => reject(new Error("Page load timeout")), 30000);
            
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        } else {
          // Get the active tab if no URL is provided
          [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
                acceptNode: function(node) {
                  if (!node.parentElement || node.parentElement.offsetParent === null) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
              }
            );

            const paragraphs = [];
            let currentParagraph = [];
            let node;

            while (node = walker.nextNode()) {
              const text = node.textContent.trim();
              if (text) {
                const isEndOfParagraph = 
                  ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(node.parentElement.tagName) ||
                  (node.parentElement.nextElementSibling?.style.display === 'block') ||
                  text.endsWith('.') || text.endsWith('!') || text.endsWith('?');

                currentParagraph.push(text);

                if (isEndOfParagraph && currentParagraph.length > 0) {
                  paragraphs.push(currentParagraph.join(' '));
                  currentParagraph = [];
                }
              }
            }

            if (currentParagraph.length > 0) {
              paragraphs.push(currentParagraph.join(' '));
            }

            return paragraphs
              .filter(p => p.trim().split(/\s+/).length > 3)
              .map(p => p.replace(/\s+/g, ' ').trim());
          }
        });

        // Close the tab if we created it from URL input
        if (url) {
          chrome.tabs.remove(tab.id);
        }

        if (!result?.result || result.result.length === 0) {
          throw new Error("No readable text found on the page");
        }

        // Process the text chunks
        await handleWebPageConversion(result.result, result.result.length);
        
        // Clear the URL input after successful conversion
        if (urlInput) {
          urlInput.value = '';
        }
        
      } catch (error) {
        console.error('Error converting page:', error);
        if (messageDiv) {
          messageDiv.textContent = `Error: ${error.message || "Failed to convert page"}. Please try again.`;
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
        selectedText: "" // No text selected when opening from icon
      });
      // Close the popup
      window.close();
    });
  }

  // Handle messages from background script
  const messageListener = async (message, sender, sendResponse) => {
    try {
      if (!chrome.runtime?.id) {
        throw new Error('Extension context invalid');
      }

      if (isFloatingWindow && message.action === "newTextSelected" && message.text && textInput) {
        textInput.value = message.text;
        if (convertButton) {
          convertButton.disabled = false;
        }
        console.log("Original text:", message.text);
        
        try {
          // Chunk the text while preserving formatting
          const chunks = chunkText(message.text);
          console.log('Processing chunks:', chunks.length);
          
          // Process each chunk
          for (let i = 0; i < chunks.length; i++) {
            updateChunkDisplay(i + 1, chunks.length);
            await convertTextToSpeech(chunks[i]);
          }
          
          // Reset chunk display
          updateChunkDisplay(0, 0);
        } catch (error) {
          console.error('Error processing chunks:', error);
          if (convertButton) {
            convertButton.textContent = `Error: ${error.message}`;
            setTimeout(() => {
              convertButton.disabled = false;
              convertButton.textContent = 'Convert to Speech';
            }, 2000);
          }
        }
      }
      // Send response to prevent "The message port closed before a response was received" warning
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error in message listener:', error);
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
  window.addEventListener('unload', () => {
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