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

// Model to voices mapping
const modelToVoices = {
  "voice-en-us": [
    "voice-en-us-amy-low",
    "voice-en-gb-alan-low",
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
function populateVoices() {
  if (!modelSelect || !voiceSelect) return;
  
  const selectedModel = modelSelect.value;
  const voices = modelToVoices[selectedModel] || [];

  // Clear previous options
  voiceSelect.innerHTML = "";

  // Populate the voice dropdown
  voices.forEach(voice => {
    const option = document.createElement("option");
    option.value = voice;
    option.textContent = voice.replace(/-/g, " ");
    voiceSelect.appendChild(option);
  });
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
async function convertTextToSpeech(input) {
  // Validate input text
  if (!input || typeof input !== 'string' || !input.trim()) {
    throw new Error('Please enter valid text to convert');
  }

  // Get selected voice and model
  const selectedModel = modelSelect?.value || 'voice-en-us-amy-low';
  const selectedVoice = voiceSelect?.value || 'voice-en-us-amy-low';
  
  // Validate that the voice is available for the selected model
  const availableVoices = modelToVoices[selectedModel] || [];
  if (!availableVoices.includes(selectedVoice)) {
    throw new Error('Selected voice is not available for this model');
  }
  
  try {
    const response = await fetch('https://voice.cloud.atemkeng.de/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedVoice,
        input: input.trim(),
        voice: selectedVoice
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', errorData);
      throw new Error(`Server error: ${response.status}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Received empty audio data');
    }

    const audioUrl = URL.createObjectURL(blob);
    
    // Create and add audio entry
    const { element, audio, text: audioText } = createAudioEntry(input, audioUrl);
    const audioContainer = document.getElementById('audioContainer');
    if (audioContainer) {
      audioContainer.prepend(element);
      addToAudioQueue({ element, audio, text: audioText });
    }
    
  } catch (error) {
    console.error('Error converting text to speech:', error);
    if (selectionStatus) {
      selectionStatus.textContent = 'Error converting text to speech';
      selectionStatus.classList.add('text-red-500');
    }
    throw error; // Re-throw to handle in the calling function
  }
}

// Function to process audio queue
async function processAudioQueue() {
  if (isProcessingQueue || audioQueue.length === 0) return;
  
  isProcessingQueue = true;
  const currentEntry = audioQueue[0];
  
  try {
    // Stop any currently playing audio
    if (currentAudio && currentAudio !== currentEntry.audio) {
      currentAudio.pause();
      currentAudio = null;
    }
    
    currentAudio = currentEntry.audio;
    
    // Set up the ended event handler
    const onEnded = () => {
      audioQueue.shift(); // Remove the finished audio
      isProcessingQueue = false;
      currentEntry.audio.removeEventListener('ended', onEnded);
      processAudioQueue(); // Process next in queue
    };
    
    currentEntry.audio.addEventListener('ended', onEnded);
    await currentEntry.audio.play();
    
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

  // Always update total chunks
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
    // Clear input field when nothing is playing
    if (textInput) {
      textInput.value = '';
    }
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

  // Update progress ring
  if (progressRing && !isNaN(audio.duration)) {
    const progress = audio.currentTime / audio.duration;
    const circumference = 163.36; // 2 * π * radius (26)
    const offset = circumference - (progress * circumference);
    progressRing.style.strokeDashoffset = offset;
  }

  // Update time displays
  if (currentTimeDisplay && !isNaN(audio.currentTime)) {
    currentTimeDisplay.textContent = formatTime(audio.currentTime);
  }
  if (durationDisplay && !isNaN(audio.duration)) {
    durationDisplay.textContent = formatTime(audio.duration);
  }

  // Update chunk information - show currently playing chunk
  const currentIndex = audioQueue.findIndex(entry => entry.audio === audio) + 1;
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
}

// Function to create audio entry with improved UI elements
function createAudioEntry(text, audioUrl) {
  const audio = new Audio(audioUrl);
  
  // Create container element
  const element = document.createElement('div');
  element.className = 'audio-entry';
  
  // Create text preview
  const textPreview = document.createElement('div');
  textPreview.className = 'text-preview';
  textPreview.textContent = text.length > 100 ? text.substring(0, 100) + '...' : text;
  
  // Create audio element wrapper
  const audioWrapper = document.createElement('div');
  audioWrapper.className = 'audio-wrapper';
  
  // Create custom controls
  const controls = document.createElement('div');
  controls.className = 'custom-controls';
  
  // Create play/pause button
  const playPauseBtn = document.createElement('button');
  playPauseBtn.className = 'play-pause-btn';
  playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  
  // Add click handler for play/pause
  playPauseBtn.addEventListener('click', () => {
    if (audio.paused) {
      // Pause any currently playing audio
      if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
        // Save the current input text if it's different from the audio text
        if (textInput && textInput.value !== text) {
          savedInputText = textInput.value;
        }
      }
      audio.play();
      currentAudio = audio;
      // Update input with current chunk text
      if (textInput) {
        textInput.value = text;
      }
    } else {
      audio.pause();
      // Restore saved input text if it exists
      if (textInput && savedInputText !== null) {
        textInput.value = savedInputText;
        savedInputText = null;
      }
    }
    updatePlayerUI({ element, audio, text });
  });
  
  // Add timeupdate listener for progress
  audio.addEventListener('timeupdate', () => {
    if (audio === currentAudio) {
      updatePlayerUI({ element, audio, text });
    }
  });
  
  // Add ended listener
  audio.addEventListener('ended', () => {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    if (audio === currentAudio) {
      // Find next audio in queue
      const currentIndex = audioQueue.findIndex(entry => entry.audio === audio);
      if (currentIndex < audioQueue.length - 1) {
        const nextEntry = audioQueue[currentIndex + 1];
        currentAudio = nextEntry.audio;
        currentAudio.play();
        // Update input with next chunk text
        if (textInput) {
          textInput.value = nextEntry.text;
        }
        updatePlayerUI(nextEntry);
      } else {
        currentAudio = null;
        // Restore saved input text if it exists
        if (textInput && savedInputText !== null) {
          textInput.value = savedInputText;
          savedInputText = null;
        }
        updatePlayerUI(null);
      }
    }
  });
  
  controls.appendChild(playPauseBtn);
  audioWrapper.appendChild(controls);
  element.appendChild(textPreview);
  element.appendChild(audioWrapper);
  
  return { element, audio, text };
}

// Function to format time
function formatTime(seconds) {
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
  
  if (messageDiv) {
    messageDiv.textContent = `Converting page: 0/${totalChunks} chunks`;
  }
  
  for (let i = 0; i < chunks.length; i++) {
    try {
      await convertTextToSpeech(chunks[i]);
      if (messageDiv) {
        messageDiv.textContent = `Converting page: ${i + 1}/${totalChunks} chunks`;
      }
    } catch (error) {
      console.error(`Error converting chunk ${i}:`, error);
      continue;
    }
  }
  
  if (messageDiv) {
    messageDiv.textContent = "Page conversion completed!";
    setTimeout(() => {
      if (messageDiv) {
        messageDiv.textContent = "";
      }
    }, 3000);
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

// Initialize popup
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
        convertButton.disabled = !textInput.value.trim();
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

          // Process text directly in chunks
          const words = input.split(' ');
          const chunks = [];
          let currentChunk = [];
          let currentSize = 0;
          const chunkSize = 1000;

          for (const word of words) {
            if (currentSize + word.length > chunkSize) {
              chunks.push(currentChunk.join(' '));
              currentChunk = [word];
              currentSize = word.length;
            } else {
              currentChunk.push(word);
              currentSize += word.length + 1; // +1 for space
            }
          }

          if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
          }

          console.log('Created chunks:', chunks.length);
          
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
          for (let i = 0; i < chunks.length; i++) {
            convertButton.textContent = `Converting chunk ${i + 1}/${chunks.length}...`;
            try {
              await convertTextToSpeech(chunks[i]);
            } catch (error) {
              console.error(`Error converting chunk ${i + 1}:`, error);
              convertButton.textContent = `Error in chunk ${i + 1}: ${error.message}`;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Show error for 2 seconds
            }
          }

          // Reset button state with success message
          convertButton.textContent = 'Conversion Complete!';
          setTimeout(() => {
            convertButton.disabled = false;
            convertButton.textContent = 'Convert to Speech';
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
      textInput.value = result.selectedText;
      if (convertButton) {
        convertButton.disabled = false;
      }
      
      if (result.autoConvert) {
        await convertTextToSpeech(result.selectedText);
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

  // Handle messages from background script
  const messageListener = (message, sender, sendResponse) => {
    if (isFloatingWindow && message.action === "newTextSelected" && message.text && textInput) {
      textInput.value = message.text;
      if (convertButton) {
        convertButton.disabled = false;
      }
      convertTextToSpeech(message.text);
    }
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // Open floating window
  if (openInFloatingWindow) {
    openInFloatingWindow.addEventListener("click", () => {
      const width = 480;
      const height = 780;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      window.open("popup.html", "PopupWindow", `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
    });
  }

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
});