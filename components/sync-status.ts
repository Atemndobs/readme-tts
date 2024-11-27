// Sync status component
export class SyncStatusComponent extends HTMLElement {
  private statusIcon: HTMLElement;
  private statusText: HTMLElement;
  private retryButton: HTMLButtonElement;
  private tooltipContent: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
    this.setupListeners();
  }

  private render() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        position: relative;
      }

      .status-container {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        border-radius: 4px;
        background: var(--status-bg, #f0f0f0);
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .status-container:hover {
        background: var(--status-bg-hover, #e0e0e0);
      }

      .status-icon {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--status-color, #999);
      }

      .status-text {
        color: var(--text-color, #333);
        user-select: none;
      }

      .tooltip {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        max-width: 250px;
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.2s, visibility 0.2s;
        margin-bottom: 8px;
        z-index: 1000;
        white-space: pre-wrap;
      }

      .tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: #333;
      }

      .status-container:hover .tooltip {
        visibility: visible;
        opacity: 1;
      }

      .retry-button {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        background: #007aff;
        color: white;
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.2s;
        display: none;
      }

      .retry-button:hover {
        background: #0056b3;
      }

      .retry-button.visible {
        display: block;
      }

      /* Status-specific styles */
      :host([status="success"]) {
        --status-color: #34c759;
        --status-bg: #f0fff4;
        --status-bg-hover: #e0ffe4;
      }

      :host([status="error"]) {
        --status-color: #ff3b30;
        --status-bg: #fff0f0;
        --status-bg-hover: #ffe0e0;
      }

      :host([status="syncing"]) {
        --status-color: #007aff;
        --status-bg: #f0f8ff;
        --status-bg-hover: #e0f0ff;
      }

      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }

      :host([status="syncing"]) .status-icon {
        animation: pulse 1.5s infinite;
      }

      .dark-mode :host {
        --text-color: #fff;
        --status-bg: #2c2c2e;
        --status-bg-hover: #3c3c3e;
      }
    `;

    const container = document.createElement('div');
    container.className = 'status-container';

    this.statusIcon = document.createElement('div');
    this.statusIcon.className = 'status-icon';

    this.statusText = document.createElement('div');
    this.statusText.className = 'status-text';

    this.tooltipContent = document.createElement('div');
    this.tooltipContent.className = 'tooltip';

    this.retryButton = document.createElement('button');
    this.retryButton.className = 'retry-button';
    this.retryButton.textContent = 'Retry Sync';
    this.retryButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.requestSync();
    });

    container.appendChild(this.statusIcon);
    container.appendChild(this.statusText);
    container.appendChild(this.tooltipContent);
    container.appendChild(this.retryButton);

    this.shadowRoot!.appendChild(style);
    this.shadowRoot!.appendChild(container);

    // Set initial status
    this.updateStatus('initializing');
  }

  private setupListeners() {
    // Listen for sync status changes
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'syncStatusChanged') {
        this.updateFromSyncStatus(message.status);
      }
      return false;
    });

    // Get initial sync status
    chrome.runtime.sendMessage({ action: 'getSyncStatus' }, (status) => {
      if (status) {
        this.updateFromSyncStatus(status);
      }
    });
  }

  private updateFromSyncStatus(status: any) {
    if (status.isRetrying) {
      this.updateStatus('syncing', 'Syncing...', 'Synchronizing with PWA...');
    } else if (status.error) {
      const errorDetails = status.error;
      const retryText = status.consecutiveFailures > 1 ? 
        `\nFailed ${status.consecutiveFailures} times` : '';
      this.updateStatus(
        'error',
        'Sync Error',
        `${errorDetails}${retryText}`,
        true
      );
    } else if (status.lastSuccess) {
      const timeAgo = this.getTimeAgo(status.lastSuccess);
      this.updateStatus(
        'success',
        'Synced',
        `Last successful sync: ${timeAgo}`
      );
    } else {
      this.updateStatus(
        'initializing',
        'Initializing',
        'Preparing sync...'
      );
    }
  }

  private updateStatus(
    status: 'success' | 'error' | 'syncing' | 'initializing',
    text: string,
    tooltip: string = '',
    showRetry: boolean = false
  ) {
    this.setAttribute('status', status);
    this.statusText.textContent = text;
    this.tooltipContent.textContent = tooltip;
    this.retryButton.classList.toggle('visible', showRetry);
  }

  private getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) {
      return 'just now';
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(seconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }

  private requestSync() {
    chrome.runtime.sendMessage({ action: 'sync' }, (response) => {
      if (!response.success) {
        console.error('Manual sync failed:', response.error);
      }
    });
  }
}

// Register the component
customElements.define('sync-status', SyncStatusComponent);
