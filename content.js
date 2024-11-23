// Store the current highlight element and audio
let currentHighlight = null;
let miniPlayer = null;
let currentAudio = null;
let isContextValid = true;

// Function to check if extension context is valid
function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && 
           chrome?.runtime?.id !== undefined && 
           chrome.runtime.getManifest() !== undefined;
  } catch (e) {
    isContextValid = false;
    console.warn('Extension context check failed:', e);
    return false;
  }
}

// Periodic context check
setInterval(() => {
  isContextValid = isExtensionContextValid();
  if (!isContextValid) {
    cleanup();
  }
}, 1000);

// Cleanup function
function cleanup() {
  try {
    if (currentHighlight) {
      const parent = currentHighlight.parentNode;
      if (parent) {
        parent.replaceChild(currentHighlight.firstChild, currentHighlight);
      }
      currentHighlight = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (miniPlayer) {
      hideMiniPlayer();
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Function to check if extension context is valid
function isExtensionContextValid() {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

// Function to handle page interactions with context check
document.addEventListener('click', () => {
  if (!isContextValid) return;
  
  try {
    chrome.runtime.sendMessage({ action: 'pageInteraction' })
      .catch(error => {
        console.warn('Page interaction error:', error);
        isContextValid = false;
        cleanup();
      });
  } catch (error) {
    console.warn('Page interaction error:', error);
    isContextValid = false;
    cleanup();
  }
});

// Function to escape special characters in string for regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to find and highlight text
function highlightText(searchText) {
  // Remove previous highlight if it exists
  if (currentHighlight) {
    const parent = currentHighlight.parentNode;
    parent.replaceChild(currentHighlight.firstChild, currentHighlight);
  }

  if (!searchText) return;

  const regex = new RegExp(escapeRegExp(searchText), 'gi');
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    const parent = node.parentNode;
    const content = node.textContent;
    const matches = content.match(regex);

    if (matches) {
      const span = document.createElement('span');
      span.innerHTML = content.replace(regex, '<mark class="tts-highlight">$&</mark>');
      parent.replaceChild(span, node);
      currentHighlight = span;
      
      // Scroll the highlight into view
      const mark = span.querySelector('.tts-highlight');
      if (mark) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      break;
    }
  }
}

// Create mini player element
function createMiniPlayer() {
    const player = document.createElement('div');
    player.className = 'tts-mini-player hidden';
    player.innerHTML = `
        <button class="play-pause" title="Play/Pause">
            <i class="fas fa-play"></i>
        </button>
        <svg class="progress-ring" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.91549430918954" stroke-dasharray="100 100"/>
        </svg>
        <span class="time">0:00</span>
        <button class="close" title="Close">
            <i class="fas fa-times"></i>
        </button>
    `;
    document.body.appendChild(player);

    // Add Font Awesome if not present
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(link);
    }

    return player;
}

// Update mini player position
function updateMiniPlayerPosition(x, y) {
    if (!miniPlayer) return;
    
    const rect = miniPlayer.getBoundingClientRect();
    const margin = 10; // pixels above the mouse
    
    // Position above the mouse
    let top = y - rect.height - margin;
    let left = x - (rect.width / 2);
    
    // Ensure player stays within viewport
    if (top < 0) top = margin;
    if (left < 0) left = margin;
    if (left + rect.width > window.innerWidth) {
        left = window.innerWidth - rect.width - margin;
    }
    
    miniPlayer.style.transform = `translate(${left}px, ${top}px)`;
}

// Show mini player
function showMiniPlayer(x, y) {
    if (!miniPlayer) {
        miniPlayer = createMiniPlayer();
        setupMiniPlayerControls();
    }
    
    updateMiniPlayerPosition(x, y);
    miniPlayer.classList.remove('hidden');
}

// Hide mini player
function hideMiniPlayer() {
    if (miniPlayer) {
        miniPlayer.classList.add('hidden');
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
    }
}

// Setup mini player controls
function setupMiniPlayerControls() {
    const playPauseBtn = miniPlayer.querySelector('.play-pause');
    const closeBtn = miniPlayer.querySelector('.close');
    
    playPauseBtn.addEventListener('click', () => {
        if (currentAudio) {
            if (currentAudio.paused) {
                currentAudio.play();
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                currentAudio.pause();
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        }
    });
    
    closeBtn.addEventListener('click', () => {
        hideMiniPlayer();
    });
}

// Update progress ring
function updateProgressRing(progress) {
    if (!miniPlayer) return;
    const circle = miniPlayer.querySelector('.progress-ring circle');
    const circumference = 100;
    const offset = circumference - (progress * circumference);
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
}

// Update time display
function updateTimeDisplay(currentTime, duration) {
    if (!miniPlayer) return;
    const timeDisplay = miniPlayer.querySelector('.time');
    const current = formatTime(currentTime);
    const total = formatTime(duration);
    timeDisplay.textContent = `${current}/${total}`;
}

// Format time as mm:ss
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Create and play audio with error handling
function createAndPlayAudio(audioUrl) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    currentAudio = new Audio(audioUrl);
    
    currentAudio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      const playPauseBtn = miniPlayer?.querySelector('.play-pause');
      if (playPauseBtn) {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      }
      updateProgressRing(0);
    });
    
    currentAudio.addEventListener('timeupdate', () => {
      updateProgressRing(currentAudio.currentTime / currentAudio.duration);
      updateTimeDisplay(currentAudio.currentTime, currentAudio.duration);
    });
    
    currentAudio.addEventListener('ended', () => {
      const playPauseBtn = miniPlayer?.querySelector('.play-pause');
      if (playPauseBtn) {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      }
      updateProgressRing(0);
    });
    
    currentAudio.addEventListener('play', () => {
      const playPauseBtn = miniPlayer?.querySelector('.play-pause');
      if (playPauseBtn) {
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      }
    });
    
    currentAudio.addEventListener('pause', () => {
      const playPauseBtn = miniPlayer?.querySelector('.play-pause');
      if (playPauseBtn) {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      }
    });

    currentAudio.play().catch(error => {
      console.error('Error playing audio:', error);
    });
  } catch (error) {
    console.error('Error creating audio:', error);
  }
}

// Handle messages from the extension with context check
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!isContextValid) {
    console.warn('Extension context invalid, ignoring message');
    sendResponse({ success: false, error: 'Extension context invalidated' });
    return true;
  }

  try {
    switch (request.action) {
      case 'highlight':
        highlightText(request.text);
        sendResponse({ success: true });
        break;
      case 'ping':
        sendResponse({ success: true });
        break;
      case 'playAudio':
        createAndPlayAudio(request.audioUrl);
        if (request.text) {
          highlightText(request.text);
        }
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Message handling error:', error);
    cleanup();
    sendResponse({ success: false, error: error.message });
    if (error.message.includes('Extension context invalidated')) {
      isContextValid = false;
    }
  }
  return true;
});

// Initialize highlight styles
const style = document.createElement('style');
style.textContent = `
  .tts-highlight-container {
    display: inline;
  }
  
  .tts-highlight {
    background-color: #fef08a;
    border-radius: 2px;
    padding: 2px 0;
    display: inline;
  }
  
  @media (prefers-color-scheme: dark) {
    .tts-highlight {
      background-color: #854d0e;
    }
  }
  
  .tts-mini-player {
    position: fixed;
    z-index: 999999;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.2s;
  }
  
  .tts-mini-player.hidden {
    opacity: 0;
    pointer-events: none;
  }
  
  .dark-mode .tts-mini-player {
    background: #1f2937;
    color: white;
  }
`;
document.head.appendChild(style);

// Initial context check and setup
if (isExtensionContextValid()) {
  try {
    chrome.runtime.sendMessage({ action: 'contentScriptReady' })
      .catch(error => {
        console.warn('Error sending ready message:', error);
        isContextValid = false;
      });
  } catch (error) {
    console.warn('Error during initialization:', error);
    isContextValid = false;
  }
}

// Handle unload
window.addEventListener('unload', cleanup);
