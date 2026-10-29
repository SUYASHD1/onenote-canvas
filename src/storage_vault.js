/**
 * OneNote Spatial Canvas — Local-First Storage & Data Safety Vault
 * 
 * Responsibilities:
 * - 4-Store IndexedDB engine: 'pages', 'hierarchy', 'assets', 'settings'.
 * - Storage Persistence Safe-Lock: calls navigator.storage.persist() to prevent OS sweeps.
 * - Live Diagnostics: real-time counts of notebooks, sections, pages, note boxes, and storage size.
 * - One-Click Backup: packages whole notebook vault into a single portable '.notes' file.
 * - Safe Restore: restores notes from '.notes' archive with instant canvas reload.
 * - Physical Folder Mirroring: mirrors notes to local computer folder via File System Access API.
 */

class StorageVault {
  constructor(app) {
    this.app = app;
    this.dbName = 'OneNoteSpatialVault';
    this.dbVersion = 1;
    this.db = null;
    this.isPersisted = false;
    this.mirroredFolderHandle = null;
    this.mirroredFolderName = null;

    // UI elements
    this.modalEl = document.getElementById('storage-hub-modal');
    this.openBtn = document.getElementById('btn-storage-hub');
    this.closeBtn = document.getElementById('btn-close-storage-hub');
    this.exportBtn = document.getElementById('btn-export-backup');
    this.importBtn = document.getElementById('btn-import-backup');
    this.importFileInput = document.getElementById('input-import-backup');
    this.connectFolderBtn = document.getElementById('btn-connect-folder');

    this.init();
  }

  async init() {
    try {
      await this.initDatabase();
      await this.checkPersistence();
      this.bindControls();
    } catch (err) {
      console.warn('StorageVault initialisation note:', err);
    }
  }

  /**
   * Initialize IndexedDB with 4 partitioned stores
   */
  initDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not available, fallback to memory');
        return resolve(null);
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Pages Store: note card data, positions, and contents
        if (!db.objectStoreNames.contains('pages')) {
          db.createObjectStore('pages', { keyPath: 'id' });
        }

        // 2. Hierarchy Store: notebook, section, and page organization tree
        if (!db.objectStoreNames.contains('hierarchy')) {
          db.createObjectStore('hierarchy', { keyPath: 'key' });
        }

        // 3. Assets Store: offline image files and media blobs
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }

        // 4. Settings Store: user preferences and theme selections
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Request and check browser storage persistence (Safe-Lock)
   */
  async checkPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      this.isPersisted = await navigator.storage.persist();
    } else if (navigator.storage && navigator.storage.persisted) {
      this.isPersisted = await navigator.storage.persisted();
    }
    return this.isPersisted;
  }

  // --- IndexedDB Operations ---

  savePage(pageId, pageData) {
    if (!this.db || !pageId) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['pages'], 'readwrite');
        const store = tx.objectStore('pages');
        store.put({ id: pageId, data: pageData, updated: Date.now() });
        tx.oncomplete = () => {
          this.mirrorToPhysicalFolder();
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  loadPage(pageId) {
    if (!this.db || !pageId) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['pages'], 'readonly');
        const store = tx.objectStore('pages');
        const req = store.get(pageId);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  saveHierarchy(hierarchyState) {
    if (!this.db || !hierarchyState) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['hierarchy'], 'readwrite');
        const store = tx.objectStore('hierarchy');
        store.put({ key: 'hierarchy_tree', state: hierarchyState, updated: Date.now() });
        tx.oncomplete = () => {
          this.mirrorToPhysicalFolder();
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  loadHierarchy() {
    if (!this.db) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['hierarchy'], 'readonly');
        const store = tx.objectStore('hierarchy');
        const req = store.get('hierarchy_tree');
        req.onsuccess = () => resolve(req.result ? req.result.state : null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  getAllPages() {
    if (!this.db) return Promise.resolve([]);
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['pages'], 'readonly');
        const store = tx.objectStore('pages');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
      }
    });
  }

  // --- Real-Time Diagnostics ---

  async getDiagnostics() {
    const hierarchy = this.app.sidebar ? this.app.sidebar.state : null;
    let nbCount = 0;
    let secCount = 0;
    let pageCount = 0;

    let totalNotesCount = this.app.noteBoxes ? this.app.noteBoxes.length : 0;
    if (hierarchy && hierarchy.notebooks) {
      nbCount = hierarchy.notebooks.length;
      hierarchy.notebooks.forEach(nb => {
        secCount += nb.sections ? nb.sections.length : 0;
        if (nb.sections) {
          nb.sections.forEach(sec => {
            pageCount += sec.pages ? sec.pages.length : 0;
            if (sec.pages) {
              sec.pages.forEach(p => {
                if (p.data && Array.isArray(p.data.boxes) && p.id !== hierarchy.activePageId) {
                  totalNotesCount += p.data.boxes.length;
                }
              });
            }
          });
        }
      });
    }

    // Calculate actual real note data bytes from notebooks, pages, and canvas items
    let realNotesBytes = 0;
    try {
      const allPages = await this.getAllPages();
      if (Array.isArray(allPages) && allPages.length > 0) {
        for (const p of allPages) {
          realNotesBytes += JSON.stringify(p).length;
        }
      }
      if (this.app.history) {
        realNotesBytes += JSON.stringify(this.app.history.serializeState()).length;
      }
      if (hierarchy) {
        realNotesBytes += JSON.stringify(hierarchy).length;
      }
    } catch (_) {}

    if (realNotesBytes === 0) {
      const serialized = JSON.stringify(this.app.history ? this.app.history.serializeState() : {});
      realNotesBytes = serialized.length;
    }

    return {
      notebooks: nbCount,
      sections: secCount,
      pages: pageCount,
      noteBoxes: totalNotesCount,
      storageBytes: realNotesBytes,
      storageFormatted: this.formatBytes(realNotesBytes),
      isPersisted: this.isPersisted,
      isMirrored: Boolean(this.mirroredFolderHandle),
      folderName: this.mirroredFolderName
    };
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // --- One-Click Backup Export & Safe Restore ---

  async exportBackup() {
    const hierarchyState = this.app.sidebar ? this.app.sidebar.state : null;
    const allPages = await this.getAllPages();

    // Ensure active page is included
    if (this.app.sidebar) {
      this.app.sidebar.saveActivePage();
    }

    const payload = {
      app: 'OneNote Spatial Canvas',
      formatVersion: '1.0',
      exportedAt: new Date().toISOString(),
      diagnostics: await this.getDiagnostics(),
      hierarchy: hierarchyState,
      pages: allPages
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `OneNote_Notebooks_Backup_${dateStr}.notes`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return payload;
  }

  async importBackup(jsonString) {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      if (!data || !data.hierarchy) {
        throw new Error('Invalid backup file: missing hierarchy structure.');
      }

      // 1. Restore hierarchy
      if (this.app.sidebar) {
        this.app.sidebar.state = data.hierarchy;
      }
      await this.saveHierarchy(data.hierarchy);

      // 2. Restore all pages into IndexedDB
      if (Array.isArray(data.pages)) {
        for (const item of data.pages) {
          if (item && item.id) {
            await this.savePage(item.id, item.data);
          }
        }
      }

      // 3. Re-render sidebar & active page
      if (this.app.sidebar) {
        const activePage = this.app.sidebar.getActivePage();
        if (activePage && activePage.data) {
          this.app.history.restoreState(activePage.data);
        }
        this.app.sidebar.render();
      }

      this.updateDiagnosticsUI();
      return true;
    } catch (err) {
      console.error('Backup restore failed:', err);
      alert('Failed to restore backup: ' + err.message);
      return false;
    }
  }

  // --- PC Hard Drive Folder Mirroring (File System Access API) ---

  async connectPhysicalFolder() {
    if (!window.showDirectoryPicker) {
      alert('Physical Folder Mirroring uses the File System Access API. Your browser allows one-click .notes backups instead.');
      return false;
    }

    try {
      this.mirroredFolderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      this.mirroredFolderName = this.mirroredFolderHandle.name || 'Selected Folder';
      await this.mirrorToPhysicalFolder();
      this.updateDiagnosticsUI();
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Folder selection error:', err);
      }
      return false;
    }
  }

  async mirrorToPhysicalFolder() {
    if (!this.mirroredFolderHandle) return;
    try {
      const hierarchy = this.app.sidebar ? this.app.sidebar.state : null;
      if (!hierarchy) return;

      const fileHandle = await this.mirroredFolderHandle.getFileHandle('onenote_hierarchy.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(hierarchy, null, 2));
      await writable.close();
    } catch (err) {
      console.warn('Mirror write error:', err);
    }
  }

  // --- UI Controls & Modal Dialog ---

  bindControls() {
    if (this.openBtn) {
      this.openBtn.onclick = () => this.openModal();
    }
    if (this.closeBtn) {
      this.closeBtn.onclick = () => this.closeModal();
    }
    if (this.modalEl) {
      this.modalEl.onclick = (e) => {
        if (e.target === this.modalEl) this.closeModal();
      };
    }
    if (this.exportBtn) {
      this.exportBtn.onclick = () => this.exportBackup();
    }
    if (this.importBtn && this.importFileInput) {
      this.importBtn.onclick = () => this.importFileInput.click();
      this.importFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          this.importBackup(event.target.result);
        };
        reader.readAsText(file);
        e.target.value = '';
      };
    }
    if (this.connectFolderBtn) {
      this.connectFolderBtn.onclick = () => this.connectPhysicalFolder();
    }
  }

  async openModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('active');
    await this.updateDiagnosticsUI();
  }

  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('active');
  }

  async updateDiagnosticsUI() {
    const stats = await this.getDiagnostics();

    const statNb = document.getElementById('stat-notebooks-count');
    const statSec = document.getElementById('stat-sections-count');
    const statPage = document.getElementById('stat-pages-count');
    const statNotes = document.getElementById('stat-notes-count');
    const statBytes = document.getElementById('stat-storage-size');
    const statLock = document.getElementById('stat-safelock-badge');
    const statFolder = document.getElementById('stat-folder-badge');

    if (statNb) statNb.textContent = stats.notebooks;
    if (statSec) statSec.textContent = stats.sections;
    if (statPage) statPage.textContent = stats.pages;
    if (statNotes) statNotes.textContent = stats.noteBoxes;
    if (statBytes) statBytes.textContent = stats.storageFormatted;
    if (statLock) {
      statLock.textContent = stats.isPersisted ? 'Active (Protected)' : 'Standard Storage';
      statLock.className = `storage-badge ${stats.isPersisted ? 'active-badge' : 'neutral-badge'}`;
    }
    if (statFolder) {
      statFolder.textContent = stats.isMirrored ? `Mirrored: ${stats.folderName}` : 'Not Connected';
      statFolder.className = `storage-badge ${stats.isMirrored ? 'active-badge' : 'neutral-badge'}`;
    }
  }
}

// Export for modular usage
window.StorageVault = StorageVault;
