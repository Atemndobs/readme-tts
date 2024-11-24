// Store the floating window ID and tab ID
let floatingWindowId = null;
let floatingTabId = null;
let injectedTabs = new Set();

// Maximum number of retries for operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Store blob URLs and their associated tabs
const blobUrls = new Map();

// Service worker activation
chrome.runtime.onInstalled.addListener(async () => {
  try {
    console.log('Extension installed/updated');
    // Clear any existing state
    await chrome.storage.local.clear();
    injectedTabs.clear();
    
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

// Function to check if extension context is valid
function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && 
           chrome?.runtime?.id !== undefined && 
           chrome.runtime.getManifest() !== undefined;
  } catch (e) {
    console.warn('Extension context check failed:', e);
    return false;
  }
}

// Function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to retry an operation with exponential backoff
async function retryOperation(operation, maxRetries = MAX_RETRIES) {
  let lastError;
  let delay = RETRY_DELAY;

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (!isExtensionContextValid()) {
        await wait(100); // Short wait to check context again
        if (!isExtensionContextValid()) {
          throw new Error('Extension context invalidated');
        }
      }
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1}/${maxRetries} failed:`, error.message);
      
      if (error.message.includes('Extension context invalidated')) {
        await wait(delay);
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw lastError;
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
    sendResponse({ success: false, error: 'Extension context invalidated' });
    return true;
  }

  const tabId = sender.tab?.id;
  if (!tabId) {
    sendResponse({ success: false, error: 'Invalid tab ID' });
    return true;
  }

  if (request.action === 'convertTextToSpeech') {
    (async () => {
      try {
        // Clean up previous blob URLs for this tab
        revokeBlobUrlsForTab(tabId);
        
        // Convert text to speech with retry
        const audioUrl = await retryOperation(async () => {
          return await convertTextToSpeech(request.text, tabId);
        });
        
        sendResponse({ success: true, audioUrl });
      } catch (error) {
        console.error('Error in text-to-speech conversion:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to convert text to speech'
        });
      }
    })();
    return true;
  }

  if (request.action === 'contentScriptReady') {
    // Content script is ready, we can now enable features for this tab
    if (sender.tab?.id) {
      chrome.action.enable(sender.tab.id);
    }
    return true;
  }
  return true;
});

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

// Function to create floating window
async function createFloatingWindow(selectedText = '') {
  try {
    // If there's already a window open, focus it and update the text
    if (floatingWindowId !== null) {
      try {
        const existingWindow = await chrome.windows.get(floatingWindowId);
        // Update the selected text
        await chrome.storage.local.set({ 
          selectedText,
          autoConvert: true
        });
        // Focus the existing window
        await chrome.windows.update(floatingWindowId, { focused: true });
        // Send message to the popup tab to update the text and convert
        if (floatingTabId !== null) {
          await chrome.tabs.sendMessage(floatingTabId, {
            action: "newTextSelected",
            text: selectedText
          });
        }
        return existingWindow;
      } catch (error) {
        // If window not found, reset the ID and continue to create new window
        floatingWindowId = null;
        floatingTabId = null;
      }
    }

    const width = 480;
    const height = 580;
    
    // Position at top left of screen
    const left = 20; // 20px padding from left edge of screen
    const top = 20;  // 20px padding from top edge of screen
    
    // Store the selected text before creating the window
    await chrome.storage.local.set({ 
      selectedText,
      autoConvert: true
    });
    
    const window = await chrome.windows.create({
      url: chrome.runtime.getURL("popup.html?floating=true"),
      type: "popup",
      width: width,
      height: height,
      left: left,
      top: top,
      focused: true,
      state: "normal"
    });

    floatingWindowId = window.id;
    const tabs = await chrome.tabs.query({ windowId: window.id });
    if (tabs.length > 0) {
      floatingTabId = tabs[0].id;
    }
    return window;
  } catch (error) {
    console.error('Error creating floating window:', error);
    throw error;
  }
}