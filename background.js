// Import utils first
try {
  // Inlined necessary functions and constants from utility files
  const defaultSettings = {
    voice: "amy",
    model: "voice-en-us-amy-low",
    darkMode: false,
    lastSync: 0,
    syncEnabled: true,
    pwaUrl: ""
  };

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

  class RetryError extends Error {
    constructor(message, attempts) {
      super(message);
      this.name = 'RetryError';
      this.attempts = attempts;
    }
  }

  const retry = async (operation, maxAttempts = 3, delay = 1000) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    throw new RetryError(`Operation failed after ${maxAttempts} attempts: ${lastError.message}`, maxAttempts);
  };

  // Store the floating window ID and tab ID
  let floatingWindowId = null;
  let floatingTabId = null;
  let injectedTabs = new Set();

  // Maximum number of retries for operations
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  // Store blob URLs and their associated tabs
  const blobUrls = new Map();

  // Function to check if extension context is valid
  function isExtensionContextValid() {
    return chrome.runtime?.id !== undefined;
  }

  // Function to wait
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Function to retry an operation with exponential backoff
  async function retryOperation(operation, maxRetries = MAX_RETRIES) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`Attempt ${i + 1} failed:`, error);
        lastError = error;
        if (i < maxRetries - 1) {
          await wait(RETRY_DELAY * Math.pow(2, i));
        }
      }
    }
    throw lastError;
  }

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

  // Function to handle tab updates with retry
  async function handleTabUpdate(tabId, changeInfo, tab) {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalid during tab update');
      return;
    }
    
    if (changeInfo.status === 'complete' && tab.url) {
      try {
        await retryOperation(async () => {
          // Check context before each operation
          if (!isExtensionContextValid()) throw new Error('Extension context invalidated');
          
          // Ensure tab is still valid
          const currentTab = await chrome.tabs.get(tabId);
          if (!currentTab) throw new Error(`No tab with id: ${tabId}`);
          
          // Enable the extension icon
          await chrome.action.enable(tabId);
          
          // Only inject content script for valid URLs
          if (shouldInjectContentScript(tab.url) && !injectedTabs.has(tabId)) {
            console.log('Injecting content script into tab:', tabId);
            
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
              });
              injectedTabs.add(tabId);
              console.log('Content script injected successfully into tab:', tabId);
              
              // Verify content script is responsive
              const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
              if (response?.success) {
                console.log('Content script verified in tab:', tabId);
              } else {
                throw new Error('Content script not responsive');
              }
            } catch (error) {
              console.error('Error injecting content script:', error);
              injectedTabs.delete(tabId);
              throw error;
            }
          }
        });
      } catch (error) {
        console.error('Error handling tab update:', error);
        // Remove from injected tabs if injection failed
        injectedTabs.delete(tabId);
      }
    }
  }

  // Update event listeners to use retry mechanism
  chrome.tabs.onUpdated.addListener(handleTabUpdate);

  // Clean up when tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    revokeBlobUrlsForTab(tabId);
    injectedTabs.delete(tabId);
    if (tabId === floatingTabId) {
      floatingTabId = null;
      floatingWindowId = null;
    }
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalid, rejecting message:', request.action);
      sendResponse({ success: false, error: 'Extension context invalidated' });
      return true;
    }

    if (request.action === 'pageInteraction') {
      // Enable the extension icon when user interacts with the page
      chrome.action.enable(sender.tab.id);
    }
    return true;
  });

  // Function to extract readable text from webpage
  function extractReadableText() {
    const content = document.body.innerText;
    return content.replace(/\s+/g, ' ').trim();
  }

  // Function to revoke blob URLs for a tab
  function revokeBlobUrlsForTab(tabId) {
    if (blobUrls.has(tabId)) {
      const urls = blobUrls.get(tabId);
      for (const url of urls) {
        try {
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Error revoking blob URL:', error);
        }
      }
      blobUrls.delete(tabId);
    }
  }

  // Handle messages with retry and proper cleanup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalid, rejecting message:', request.action);
      sendResponse({ error: 'Extension context invalid' });
      return true;
    }

    (async () => {
      try {
        switch (request.action) {
          case 'createFloatingWindow':
            const window = await createFloatingWindow(request.selectedText);
            sendResponse({ success: true, windowId: window.id });
            break;

          case 'convertTextToSpeech':
            const audioUrl = await retryOperation(async () => {
              return await convertTextToSpeech(request.text, sender.tab.id);
            });
            sendResponse({ success: true, audioUrl });
            break;

          case 'contentScriptReady':
            // Content script is ready, we can now enable features for this tab
            if (sender.tab?.id) {
              chrome.action.enable(sender.tab.id);
            }
            return true;

          default:
            console.warn('Unknown message action:', request.action);
            sendResponse({ error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
      }
    })();

    return true; // Keep the message channel open for async response
  });

  // Function to create floating window
  async function createFloatingWindow(selectedText = '') {
    try {
      // Close existing floating window if any
      if (floatingWindowId) {
        try {
          await chrome.windows.remove(floatingWindowId);
        } catch (error) {
          console.warn('Error closing existing floating window:', error);
        }
        floatingWindowId = null;
        floatingTabId = null;
      }

      // Create new floating window
      const window = await chrome.windows.create({
        url: chrome.runtime.getURL('popup.html') + '?floating=true',
        type: 'popup',
        width: 400,
        height: 600,
        focused: true
      });

      floatingWindowId = window.id;
      floatingTabId = window.tabs[0].id;

      // Wait for the tab to be fully loaded
      await new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === floatingTabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });

      // Send initialization data to the floating window
      await chrome.tabs.sendMessage(floatingTabId, {
        action: 'initializeFloatingWindow',
        selectedText: selectedText
      });

      return window;
    } catch (error) {
      console.error('Error creating floating window:', error);
      throw error;
    }
  }

  // Handle context menu clicks with proper cleanup
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'convertTextToSpeech' && tab?.id) {
      try {
        // Ensure content script is injected
        if (!injectedTabs.has(tab.id)) {
          console.log('Content script not injected, attempting injection...');
          await handleTabUpdate(tab.id, { status: 'complete' }, tab);
        }
        
        // Clean up previous blob URLs for this tab
        revokeBlobUrlsForTab(tab.id);
        
        // Get formatted selection from content script with retry
        const response = await retryOperation(async () => {
          const resp = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
          if (!resp?.success) {
            throw new Error(resp?.error || 'Failed to get formatted selection');
          }
          return resp;
        });

        // Open floating window with selected text
        await createFloatingWindow(response.text);
      } catch (error) {
        console.error('Error processing text to speech:', error);
        // Show error notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon/icons8-voice-recognition-128.png',
          title: 'Text-to-Speech Error',
          message: error.message || 'Failed to process text to speech'
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
        console.log('Floating window created with tab ID:', floatingTabId);
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

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    if (message.action === "createFloatingWindow") {
      createFloatingWindow(message.selectedText || "")
        .catch(error => console.error('Error creating floating window:', error));
      return true;
    }
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

  // Service worker activation
  chrome.runtime.onInstalled.addListener(async () => {
    try {
      console.log('Extension installed/updated');
      
      // Create context menu
      await chrome.contextMenus.create({
        id: 'convertTextToSpeech',
        title: 'raadMe - Read this text',
        contexts: ['selection']
      });
    } catch (error) {
      console.error('Error initializing extension:', error);
    }
  });

  // Keep service worker alive
  chrome.runtime.onConnect.addListener(port => {
    console.log('Port connected:', port.name);
    port.onDisconnect.addListener(() => {
      console.log('Port disconnected:', port.name);
    });
  });
} catch (error) {
  console.error('Error importing modules:', error);
}