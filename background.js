// Store the floating window ID and tab ID
let floatingWindowId = null;
let floatingTabId = null;
let injectedTabs = new Set();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Clear any existing state
  chrome.storage.local.clear();
  injectedTabs.clear();
});

// Clean up when extension is updated or reloaded
chrome.runtime.onSuspend.addListener(() => {
  injectedTabs.clear();
  if (floatingWindowId) {
    chrome.windows.remove(floatingWindowId);
  }
});

// Function to check if URL should be injected
function shouldInjectContentScript(url) {
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

// Function to handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Always enable the extension icon
      await chrome.action.enable(tabId);
      
      // Only inject content script for valid URLs
      if (shouldInjectContentScript(tab.url) && !injectedTabs.has(tabId)) {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        injectedTabs.add(tabId);
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
  if (tabId === floatingTabId) {
    floatingTabId = null;
    floatingWindowId = null;
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'pageInteraction') {
    // Enable the extension icon when user interacts with the page
    chrome.action.enable(sender.tab.id);
  }
});

// Function to extract readable text from webpage
function extractReadableText() {
  const content = document.body.innerText;
  return content.replace(/\s+/g, ' ').trim();
}

// Function to chunk text
function chunkText(text, chunkSize = 1000) {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

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

  return chunks;
}

// Function to split text into paragraphs
function splitIntoParagraphs(text) {
  // Split by common paragraph separators
  const rawParagraphs = text.split(/(?:\r?\n\r?\n|\r\r)/);
  
  return rawParagraphs
    .map(p => p.trim())
    .filter(p => p.length > 0 && p.split(/\s+/).length > 3) // Filter out empty and very short paragraphs
    .map(p => p.replace(/\s+/g, ' ')); // Normalize whitespace
}

// Function to convert text to speech
async function convertTextToSpeech(text) {
  try {
    const response = await fetch('https://voice.cloud.atemkeng.de/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        voice: 'nova',
        model: 'en-us-x-tts',
        speed: 1.0
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to convert text to speech');
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('TTS conversion error:', error);
    throw error;
  }
}

// Function to inject content script
async function ensureContentScriptInjected(tabId) {
  try {
    // Check if the content script is already injected
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    // If we get an error, the content script is not injected yet
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['highlight.css', 'mini-player.css']
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
}

// Listen for tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && shouldInjectContentScript(tab.url)) {
    ensureContentScriptInjected(tabId);
  }
});

// Handle text selection from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'convertSelection') {
    convertTextToSpeech(request.text)
      .then(audioUrl => {
        sendResponse({ success: true, audioUrl });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'convertTextToSpeech',
    title: 'Convert to Speech',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'convertTextToSpeech' && tab?.id) {
    try {
      const audioUrl = await convertTextToSpeech(info.selectionText);
      
      // Send audio URL to content script
      await chrome.tabs.sendMessage(tab.id, {
        action: 'playAudio',
        audioUrl: audioUrl,
        text: info.selectionText
      });
    } catch (error) {
      console.error('Error processing text to speech:', error);
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Text-to-Speech Error',
        message: error.message || 'Failed to convert text to speech'
      });
    }
  }
});

// Listen for window creation to store floating window ID
chrome.windows.onCreated.addListener(async (window) => {
  if (window.type === "popup" && window.url && window.url.includes("popup.html")) {
    floatingWindowId = window.id;
    // Get the tab ID from the window
    const tabs = await chrome.tabs.query({ windowId: window.id });
    if (tabs.length > 0) {
      floatingTabId = tabs[0].id;
    }
  }
});

// Listen for window removal to clear floating window ID
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === floatingWindowId) {
    floatingWindowId = null;
    floatingTabId = null;
  }
});

// Function to create floating window
async function createFloatingWindow() {
  const width = 500;
  const height = 600;
  
  // Get the current window to calculate the center position
  const currentWindow = await chrome.windows.getCurrent();
  const left = Math.round(currentWindow.left + (currentWindow.width - width) / 2);
  const top = Math.round(currentWindow.top + (currentWindow.height - height) / 2);
  
  const window = await chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: width,
    height: height,
    left: left,
    top: top
  });
  
  floatingWindowId = window.id;
  const tabs = await chrome.tabs.query({ windowId: window.id });
  if (tabs.length > 0) {
    floatingTabId = tabs[0].id;
  }
  return window;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  if (message.action === 'chunkText' && message.text) {
    try {
      console.log('Chunking text of length:', message.text.length);
      const chunks = chunkText(message.text);
      console.log('Created chunks:', chunks.length);
      // Send response immediately
      sendResponse({ success: true, chunks: chunks });
    } catch (error) {
      console.error('Error in background script:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  // Must return true if response is sent asynchronously
  return true;
});
