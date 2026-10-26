/**
 * OneNote Spatial Canvas — Unified History & Undo/Redo Engine
 * 
 * Responsibilities:
 * - Snapshots entire canvas state (note boxes, text, tables, images, crop data).
 * - Full Undo (Ctrl+Z) and Redo (Ctrl+Y, Ctrl+Shift+Z, Ctrl+R).
 * - Prevents Ctrl+R from refreshing the browser and destroying notes.
 * - Local storage persistence so work is never lost on reload.
 * - Smooth state transitions with element re-binding.
 */

class HistoryManager {
  constructor(app) {
    this.app = app;
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;
    this.isRestoring = false;
    this.saveTimeout = null;

    this.bindGlobalShortcuts();
  }

  /**
   * Serialize current canvas state to a lightweight JSON structure
   */
  serializeState() {
    return {
      timestamp: Date.now(),
      boxes: this.app.noteBoxes.map(box => ({
        id: box.id,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        html: box.contentArea.innerHTML
      }))
    };
  }

  /**
   * Push current state to undo history
   */
  pushState(actionName = 'action') {
    if (this.isRestoring) return;

    const state = this.serializeState();
    
    // Avoid duplicate states
    if (this.undoStack.length > 0) {
      const lastState = this.undoStack[this.undoStack.length - 1];
      if (JSON.stringify(lastState.boxes) === JSON.stringify(state.boxes)) {
        return;
      }
    }

    this.undoStack.push(state);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // New action invalidates redo stack
    this.redoStack = [];
    this.persistToStorage(state);
    this.updateRibbonState();
  }

  /**
   * Debounced push for typing or continuous resizing
   */
  debouncePush(actionName = 'edit', delayMs = 400) {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.pushState(actionName);
    }, delayMs);
  }

  /**
   * Undo last operation
   */
  undo() {
    if (this.undoStack.length <= 1) return; // Keep initial state

    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);

    const prevState = this.undoStack[this.undoStack.length - 1];
    if (prevState) {
      this.restoreState(prevState);
    }
    this.updateRibbonState();
  }

  /**
   * Redo previously undone operation
   */
  redo() {
    if (this.redoStack.length === 0) return;

    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);

    this.restoreState(nextState);
    this.updateRibbonState();
  }

  /**
   * Reconstruct canvas elements faithfully from state snapshot
   */
  restoreState(state) {
    if (!state || !state.boxes) return;
    this.isRestoring = true;

    // 1. Remove all existing note boxes from DOM
    this.app.noteBoxes.forEach(b => b.element.remove());
    this.app.noteBoxes = [];
    this.app.selectedNoteBox = null;

    // 2. Re-instantiate note boxes from state
    let maxId = 1;
    state.boxes.forEach(boxData => {
      const box = new NoteBox(
        this.app,
        boxData.id,
        boxData.x,
        boxData.y,
        boxData.width,
        boxData.height
      );
      box.contentArea.innerHTML = boxData.html;
      this.app.noteBoxes.push(box);

      if (typeof boxData.id === 'number' && boxData.id >= maxId) {
        maxId = boxData.id + 1;
      }

      // Reconnect all interactions
      this.app.keyboardController.rebindContainerElements(box);
    });

    this.app.boxIdCounter = Math.max(this.app.boxIdCounter, maxId);
    this.app.canvas.ensureBounds(this.app.noteBoxes);
    this.persistToStorage(state);

    this.isRestoring = false;
  }

  /**
   * Intercept Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, and Ctrl+R
   */
  bindGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;

      const key = e.key.toLowerCase();

      // Undo: Ctrl + Z (without Shift)
      if (key === 'z' && !e.shiftKey) {
        // If typing plain text inside a contenteditable with local text edits,
        // let text-level undo happen, but if no text is selected or at canvas level, trigger spatial undo
        const selection = window.getSelection();
        const isCollapsed = selection?.isCollapsed;
        
        // Canvas / Container level undo
        if (!document.activeElement?.isContentEditable || (isCollapsed && this.undoStack.length > 1)) {
          e.preventDefault();
          this.undo();
        }
      }

      // Redo: Ctrl + Y OR Ctrl + Shift + Z OR Ctrl + R
      if (key === 'y' || (key === 'z' && e.shiftKey) || key === 'r') {
        e.preventDefault(); // Prevents Ctrl+R from destroying notes by reloading page!
        this.redo();
      }
    }, true); // Capture phase ensures browser reload is intercepted
  }

  persistToStorage(state) {
    try {
      localStorage.setItem('onenote_canvas_workspace', JSON.stringify(state));
    } catch (_) {}
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('onenote_canvas_workspace');
      if (saved) {
        const state = JSON.parse(saved);
        if (state && state.boxes && state.boxes.length > 0) {
          this.restoreState(state);
          this.undoStack = [state];
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  updateRibbonState() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');

    if (btnUndo) {
      btnUndo.style.opacity = this.undoStack.length > 1 ? '1' : '0.4';
      btnUndo.style.pointerEvents = this.undoStack.length > 1 ? 'auto' : 'none';
    }
    if (btnRedo) {
      btnRedo.style.opacity = this.redoStack.length > 0 ? '1' : '0.4';
      btnRedo.style.pointerEvents = this.redoStack.length > 0 ? 'auto' : 'none';
    }
  }
}

// Export for modular usage
window.HistoryManager = HistoryManager;
