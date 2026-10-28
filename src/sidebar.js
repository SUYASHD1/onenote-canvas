/**
 * OneNote Spatial Canvas — Authentic OneNote Dual-Column Sidebar & Drawer
 * 
 * Responsibilities:
 * - 3-Tier Hierarchy: Notebooks ➔ Sections ➔ Pages.
 * - Notebooks Drawer: flyout opened on clicking top notebook picker.
 * - Two Side-by-Side Columns: Sections (with colored bookmark tabs) & Pages (with previews).
 * - Clean Blank Page Guarantee: new pages load 100% empty canvas ([]).
 * - Instant Page Switching: auto-saves active page, restores in milliseconds.
 * - Inline Renaming & Safe Deletion.
 */

class SidebarManager {
  constructor(app) {
    this.app = app;
    this.sidebarEl = document.getElementById('app-sidebar');
    this.toggleBtn = document.getElementById('btn-toggle-sidebar');
    this.notebookPickerBtn = document.getElementById('btn-notebook-picker');
    this.notebooksDrawer = document.getElementById('notebooks-drawer');

    this.notebooksListEl = document.getElementById('sidebar-notebooks-list');
    this.sectionsListEl = document.getElementById('sidebar-sections-list');
    this.pagesListEl = document.getElementById('sidebar-pages-list');

    this.notebookTitleEl = document.getElementById('notebook-name-display');
    this.pageTitleEl = document.getElementById('page-title-display');

    // Section Bookmark Color Palette (matching OneNote signature tabs)
    this.sectionColors = [
      '#ff4d6a', // Coral / Red
      '#0078d4', // Royal Blue
      '#00b7c3', // Teal
      '#ffb900', // Yellow
      '#8764b8', // Purple
      '#107c41', // Emerald Green
      '#e05397', // Magenta
      '#d83b01'  // Orange
    ];

    this.notebookIcons = ['📙', '📘', '📗', '📕', '📓', '📔', '🟪'];

    // Initial Hierarchy State
    this.state = {
      activeNotebookId: 'nb-1',
      activeSectionId: 'sec-1',
      activePageId: 'page-1',
      notebooks: [
        {
          id: 'nb-1',
          name: 'Personal Workspace',
          icon: '📙',
          sections: [
            {
              id: 'sec-1',
              name: 'General Notes',
              color: '#8764b8',
              pages: [
                {
                  id: 'page-1',
                  title: 'Project Canvas',
                  preview: 'Welcome to your open spatial desk...',
                  data: null // default starter notes
                }
              ]
            }
          ]
        }
      ]
    };

    this.init();
  }

  init() {
    this.bindControls();
    this.render();
  }

  bindControls() {
    // 1. Sidebar Toggle Button
    if (this.toggleBtn) {
      this.toggleBtn.onclick = () => this.toggleSidebar();
    }

    // 2. Notebook Picker (Toggles Drawer)
    if (this.notebookPickerBtn) {
      this.notebookPickerBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleNotebooksDrawer();
      };
    }

    // Close drawer when clicking anywhere outside
    window.addEventListener('click', (e) => {
      if (this.notebooksDrawer && this.notebooksDrawer.style.display !== 'none') {
        if (!e.target.closest('#notebooks-drawer') && !e.target.closest('#btn-notebook-picker')) {
          this.closeNotebooksDrawer();
        }
      }
    });

    // 3. Add Buttons
    const btnAddNotebook = document.getElementById('btn-add-notebook');
    if (btnAddNotebook) {
      btnAddNotebook.onclick = () => this.createNotebook();
    }

    const btnAddSection = document.getElementById('btn-add-section');
    if (btnAddSection) {
      btnAddSection.onclick = () => this.createSection();
    }

    const btnAddPage = document.getElementById('btn-add-page');
    if (btnAddPage) {
      btnAddPage.onclick = () => this.createPage();
    }
  }

  toggleSidebar() {
    if (!this.sidebarEl) return;
    this.sidebarEl.classList.toggle('collapsed');
    const isCollapsed = this.sidebarEl.classList.contains('collapsed');
    if (this.toggleBtn) {
      this.toggleBtn.classList.toggle('active', !isCollapsed);
    }
    setTimeout(() => {
      if (this.app.canvas) {
        this.app.canvas.applyDimensions();
      }
    }, 240);
  }

  toggleNotebooksDrawer() {
    if (!this.notebooksDrawer) return;
    const isVisible = this.notebooksDrawer.style.display === 'flex' || this.notebooksDrawer.style.display === 'block';
    if (isVisible) {
      this.closeNotebooksDrawer();
    } else {
      this.openNotebooksDrawer();
    }
  }

  openNotebooksDrawer() {
    if (!this.notebooksDrawer) return;
    this.notebooksDrawer.style.display = 'flex';
    if (this.notebookPickerBtn) {
      this.notebookPickerBtn.classList.add('open');
      const chevron = this.notebookPickerBtn.querySelector('.picker-chevron');
      if (chevron) chevron.textContent = '▴';
    }
  }

  closeNotebooksDrawer() {
    if (!this.notebooksDrawer) return;
    this.notebooksDrawer.style.display = 'none';
    if (this.notebookPickerBtn) {
      this.notebookPickerBtn.classList.remove('open');
      const chevron = this.notebookPickerBtn.querySelector('.picker-chevron');
      if (chevron) chevron.textContent = '▾';
    }
  }

  // --- Hierarchy Query Helpers ---

  getActiveNotebook() {
    return this.state.notebooks.find(nb => nb.id === this.state.activeNotebookId) || this.state.notebooks[0];
  }

  getActiveSection() {
    const nb = this.getActiveNotebook();
    if (!nb) return null;
    return nb.sections.find(sec => sec.id === this.state.activeSectionId) || nb.sections[0];
  }

  getActivePage() {
    const sec = this.getActiveSection();
    if (!sec) return null;
    return sec.pages.find(p => p.id === this.state.activePageId) || sec.pages[0];
  }

  // --- Page Switching & Clean Blank Page Guarantee ---

  saveActivePage() {
    const activePage = this.getActivePage();
    if (activePage && this.app.history) {
      activePage.data = this.app.history.serializeState();
      // Derive preview text from first note
      const firstBox = this.app.noteBoxes[0];
      if (firstBox) {
        const text = firstBox.contentArea.textContent.trim();
        activePage.preview = text.slice(0, 42) + (text.length > 42 ? '...' : '');
      } else {
        activePage.preview = 'Blank page';
      }
      if (this.app.storageVault) {
        this.app.storageVault.savePage(activePage.id, activePage.data);
        this.app.storageVault.saveHierarchy(this.state);
      }
    }
  }

  selectPage(pageId) {
    if (pageId === this.state.activePageId) return;

    this.saveActivePage();
    this.state.activePageId = pageId;
    const targetPage = this.getActivePage();
    if (!targetPage) return;

    if (targetPage.data) {
      this.app.history.restoreState(targetPage.data);
    } else {
      this.app.history.restoreState({ boxes: [] });
    }

    if (this.app.history) {
      this.app.history.undoStack = [this.app.history.serializeState()];
      this.app.history.redoStack = [];
      this.app.history.updateRibbonState();
    }

    this.render();
  }

  createPage(title = null) {
    const activeSec = this.getActiveSection();
    if (!activeSec) return;

    this.saveActivePage();

    const pageCount = activeSec.pages.length + 1;
    const pageId = `page-${Date.now()}`;
    const newPage = {
      id: pageId,
      title: title || `Untitled Page ${pageCount}`,
      preview: 'No additional text',
      data: { boxes: [] }
    };

    activeSec.pages.push(newPage);
    this.state.activePageId = pageId;

    this.app.history.restoreState({ boxes: [] });
    this.app.history.undoStack = [this.app.history.serializeState()];
    this.app.history.redoStack = [];
    this.app.history.updateRibbonState();

    this.render();
  }

  // --- Section & Notebook Management ---

  selectSection(sectionId) {
    if (sectionId === this.state.activeSectionId) return;
    this.saveActivePage();
    this.state.activeSectionId = sectionId;

    const sec = this.getActiveSection();
    if (sec && sec.pages.length > 0) {
      this.selectPage(sec.pages[0].id);
    } else {
      this.createPage();
    }
    this.render();
  }

  createSection(name = null) {
    const activeNb = this.getActiveNotebook();
    if (!activeNb) return;

    this.saveActivePage();

    const secCount = activeNb.sections.length + 1;
    const secId = `sec-${Date.now()}`;
    const newPageId = `page-${Date.now()}`;
    const color = this.sectionColors[(activeNb.sections.length) % this.sectionColors.length];

    const newSec = {
      id: secId,
      name: name || `Section ${secCount}`,
      color: color,
      pages: [
        {
          id: newPageId,
          title: 'Untitled Page',
          preview: 'No additional text',
          data: { boxes: [] }
        }
      ]
    };

    activeNb.sections.push(newSec);
    this.state.activeSectionId = secId;
    this.state.activePageId = newPageId;

    this.app.history.restoreState({ boxes: [] });
    this.app.history.undoStack = [this.app.history.serializeState()];
    this.app.history.redoStack = [];

    this.render();
  }

  selectNotebook(notebookId) {
    this.saveActivePage();
    this.state.activeNotebookId = notebookId;
    this.closeNotebooksDrawer();

    const nb = this.getActiveNotebook();
    if (nb && nb.sections.length > 0) {
      this.state.activeSectionId = nb.sections[0].id;
      const sec = nb.sections[0];
      if (sec.pages.length > 0) {
        this.selectPage(sec.pages[0].id);
      } else {
        this.createPage();
      }
    } else {
      this.createSection();
    }
    this.render();
  }

  createNotebook(name = null) {
    this.saveActivePage();

    const nbCount = this.state.notebooks.length + 1;
    const nbId = `nb-${Date.now()}`;
    const secId = `sec-${Date.now()}`;
    const pageId = `page-${Date.now()}`;
    const icon = this.notebookIcons[(this.state.notebooks.length) % this.notebookIcons.length];

    const newNb = {
      id: nbId,
      name: name || `Notebook ${nbCount}`,
      icon: icon,
      sections: [
        {
          id: secId,
          name: 'Section 1',
          color: this.sectionColors[0],
          pages: [
            {
              id: pageId,
              title: 'Untitled Page',
              preview: 'No additional text',
              data: { boxes: [] }
            }
          ]
        }
      ]
    };

    this.state.notebooks.push(newNb);
    this.state.activeNotebookId = nbId;
    this.state.activeSectionId = secId;
    this.state.activePageId = pageId;

    this.app.history.restoreState({ boxes: [] });
    this.app.history.undoStack = [this.app.history.serializeState()];
    this.app.history.redoStack = [];

    this.closeNotebooksDrawer();
    this.render();
  }

  // --- Inline Renaming & Safe Deletion ---

  startInlineRename(el, currentText, onSave) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sidebar-rename-input';
    input.value = currentText;

    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const val = input.value.trim() || currentText;
      onSave(val);
      this.render();
    };

    input.onblur = commit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') {
        committed = true;
        this.render();
      }
    };
  }

  deleteNotebook(nbId) {
    if (this.state.notebooks.length <= 1) {
      alert('Cannot delete the only notebook.');
      return;
    }
    if (!confirm('Are you sure you want to delete this notebook?')) return;

    this.state.notebooks = this.state.notebooks.filter(nb => nb.id !== nbId);
    if (this.state.activeNotebookId === nbId) {
      this.selectNotebook(this.state.notebooks[0].id);
    } else {
      this.render();
    }
  }

  deleteSection(secId) {
    const nb = this.getActiveNotebook();
    if (!nb || nb.sections.length <= 1) {
      alert('Cannot delete the only section in this notebook.');
      return;
    }
    if (!confirm('Are you sure you want to delete this section?')) return;

    nb.sections = nb.sections.filter(s => s.id !== secId);
    if (this.state.activeSectionId === secId) {
      this.selectSection(nb.sections[0].id);
    } else {
      this.render();
    }
  }

  deletePage(pageId) {
    const sec = this.getActiveSection();
    if (!sec || sec.pages.length <= 1) {
      alert('Cannot delete the only page in this section.');
      return;
    }
    if (!confirm('Are you sure you want to delete this page?')) return;

    sec.pages = sec.pages.filter(p => p.id !== pageId);
    if (this.state.activePageId === pageId) {
      this.selectPage(sec.pages[0].id);
    } else {
      this.render();
    }
  }

  // --- Rendering UI Lists ---

  render() {
    const activeNb = this.getActiveNotebook();
    const activeSec = this.getActiveSection();
    const activePage = this.getActivePage();

    // 1. Top Header Notebook & Page Displays
    if (this.notebookTitleEl && activeNb) {
      this.notebookTitleEl.textContent = activeNb.name;
    }
    if (this.pageTitleEl && activePage) {
      this.pageTitleEl.textContent = activePage.title;
    }

    // 2. Render Sections (Column 1) with Colorful Bookmark Tabs
    if (this.sectionsListEl && activeNb) {
      this.sectionsListEl.innerHTML = '';
      activeNb.sections.forEach((sec, idx) => {
        const color = sec.color || this.sectionColors[idx % this.sectionColors.length];
        const item = document.createElement('div');
        item.className = `section-item ${sec.id === this.state.activeSectionId ? 'active' : ''}`;
        item.dataset.id = sec.id;

        // Bookmark color tab on left edge
        const tab = document.createElement('div');
        tab.className = 'section-bookmark-tab';
        tab.style.backgroundColor = color;

        // Title
        const titleSpan = document.createElement('span');
        titleSpan.className = 'section-item-title';
        titleSpan.textContent = sec.name;
        titleSpan.ondblclick = (e) => {
          e.stopPropagation();
          this.startInlineRename(titleSpan, sec.name, (newName) => { sec.name = newName; });
        };

        // Action icons on hover
        const actions = document.createElement('div');
        actions.className = 'sidebar-item-actions';
        actions.innerHTML = `
          <button class="sidebar-action-btn rename" title="Rename Section">✏️</button>
          <button class="sidebar-action-btn delete" title="Delete Section">🗑️</button>
        `;
        actions.querySelector('.rename').onclick = (e) => {
          e.stopPropagation();
          this.startInlineRename(titleSpan, sec.name, (newName) => { sec.name = newName; });
        };
        actions.querySelector('.delete').onclick = (e) => {
          e.stopPropagation();
          this.deleteSection(sec.id);
        };

        item.onclick = () => this.selectSection(sec.id);
        item.appendChild(tab);
        item.appendChild(titleSpan);
        item.appendChild(actions);
        this.sectionsListEl.appendChild(item);
      });
    }

    // 3. Render Pages (Column 2) with Title and Subtitle Preview
    if (this.pagesListEl && activeSec) {
      this.pagesListEl.innerHTML = '';
      activeSec.pages.forEach(p => {
        const item = document.createElement('div');
        item.className = `page-item ${p.id === this.state.activePageId ? 'active' : ''}`;
        item.dataset.id = p.id;

        const titleSpan = document.createElement('div');
        titleSpan.className = 'page-item-title';
        titleSpan.textContent = p.title;
        titleSpan.ondblclick = (e) => {
          e.stopPropagation();
          this.startInlineRename(titleSpan, p.title, (newTitle) => { p.title = newTitle; });
        };

        const previewSpan = document.createElement('div');
        previewSpan.className = 'page-item-preview';
        previewSpan.textContent = p.preview || 'No additional text';

        const actions = document.createElement('div');
        actions.className = 'sidebar-item-actions';
        actions.innerHTML = `
          <button class="sidebar-action-btn rename" title="Rename Page">✏️</button>
          <button class="sidebar-action-btn delete" title="Delete Page">🗑️</button>
        `;
        actions.querySelector('.rename').onclick = (e) => {
          e.stopPropagation();
          this.startInlineRename(titleSpan, p.title, (newTitle) => { p.title = newTitle; });
        };
        actions.querySelector('.delete').onclick = (e) => {
          e.stopPropagation();
          this.deletePage(p.id);
        };

        item.onclick = () => this.selectPage(p.id);
        item.appendChild(titleSpan);
        item.appendChild(previewSpan);
        item.appendChild(actions);
        this.pagesListEl.appendChild(item);
      });
    }

    // 4. Render Notebooks (Drawer Flyout) with Colorful Icons
    if (this.notebooksListEl) {
      this.notebooksListEl.innerHTML = '';
      this.state.notebooks.forEach((nb, idx) => {
        const icon = nb.icon || this.notebookIcons[idx % this.notebookIcons.length];
        const item = document.createElement('div');
        item.className = `notebook-item ${nb.id === this.state.activeNotebookId ? 'active' : ''}`;
        item.dataset.id = nb.id;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'notebook-item-icon';
        iconSpan.textContent = icon;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'notebook-item-title';
        titleSpan.textContent = nb.name;
        titleSpan.ondblclick = (e) => {
          e.stopPropagation();
          this.startInlineRename(titleSpan, nb.name, (newName) => { nb.name = newName; });
        };

        const actions = document.createElement('div');
        actions.className = 'sidebar-item-actions';
        actions.innerHTML = `
          <button class="sidebar-action-btn rename" title="Rename Notebook">✏️</button>
          <button class="sidebar-action-btn delete" title="Delete Notebook">🗑️</button>
        `;
        actions.querySelector('.rename').onclick = (e) => {
          e.stopPropagation();
          this.startInlineRename(titleSpan, nb.name, (newName) => { nb.name = newName; });
        };
        actions.querySelector('.delete').onclick = (e) => {
          e.stopPropagation();
          this.deleteNotebook(nb.id);
        };

        item.onclick = () => this.selectNotebook(nb.id);
        item.appendChild(iconSpan);
        item.appendChild(titleSpan);
        item.appendChild(actions);
        this.notebooksListEl.appendChild(item);
      });
    }
  }
}

// Export for modular usage
window.SidebarManager = SidebarManager;
