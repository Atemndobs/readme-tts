class SyncStatus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  static get observedAttributes() {
    return ['status', 'error'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  getStatusIcon() {
    const status = this.getAttribute('status') || 'synced';
    switch (status) {
      case 'syncing':
        return '🔄';
      case 'error':
        return '❌';
      case 'synced':
        return '✓';
      default:
        return '✓';
    }
  }

  getStatusText() {
    const status = this.getAttribute('status') || 'synced';
    const error = this.getAttribute('error');
    
    if (error) {
      return `Error: ${error}`;
    }

    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync Error';
      case 'synced':
        return 'Synced';
      default:
        return 'Synced';
    }
  }

  render() {
    const status = this.getAttribute('status') || 'synced';
    const styles = `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: default;
        background: var(--sync-bg, #f0f0f0);
        color: var(--sync-color, #333);
      }
      
      :host([status="syncing"]) {
        --sync-bg: #e3f2fd;
        --sync-color: #1976d2;
        animation: rotate 1s linear infinite;
      }
      
      :host([status="error"]) {
        --sync-bg: #ffebee;
        --sync-color: #d32f2f;
      }
      
      :host([status="synced"]) {
        --sync-bg: #e8f5e9;
        --sync-color: #388e3c;
      }

      @keyframes rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .icon {
        font-size: 14px;
      }

      .text {
        white-space: nowrap;
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <span class="icon">${this.getStatusIcon()}</span>
      <span class="text">${this.getStatusText()}</span>
    `;
  }
}

customElements.define('sync-status', SyncStatus);
