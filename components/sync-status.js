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
        padding: 4px;
        font-size: 12px;
        cursor: default;
        color: var(--sync-color, #666);
      }
      
      :host([status="syncing"]) {
        --sync-color: #1976d2;
        animation: rotate 1s linear infinite;
      }
      
      :host([status="error"]) {
        --sync-color: #d32f2f;
      }
      
      :host([status="synced"]) {
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
