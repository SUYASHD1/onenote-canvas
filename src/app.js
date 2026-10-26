/**
 * OneNote Spatial Canvas — Main Application Coordinator
 * 
 * Responsibilities:
 * - Bootstraps all subsystems (Canvas, Tables, Images, Flow, Shortcuts).
 * - Wires up top ribbon actions and file input listeners.
 * - Seeds default demonstration notes for an immediate, impressive first load.
 */

class OneNoteApp {
  constructor() {
    this.noteBoxes = [];
    this.boxIdCounter = 1;
    this.selectedNoteBox = null;

    this.init();
  }

  init() {
    // 1. Initialize Subsystems
    this.canvas = new OneNoteCanvas('canvas-viewport', 'canvas-stage');
    this.tableModule = new TableModule(this);
    this.imageModule = new ImageModule(this);
    this.flowEngine = new ElementFlowEngine(this);
    this.keyboardController = new KeyboardController(this);
    this.history = new HistoryManager(this);

    // 2. Connect Canvas Callbacks
    this.canvas.onCanvasDoubleClicked = (x, y) => {
      this.createNoteBox(x, y);
    };

    this.canvas.onCanvasSingleClicked = () => {
      this.deselectAll();
    };

    // 3. Connect Ribbon Toolbar
    this.bindRibbonControls();

    // 4. Seed Rich Starter Notes or Restore
    if (!this.history.loadFromStorage()) {
      this.seedStarterNotes();
    }
    this.history.pushState('initial');
  }

  createNoteBox(x = 100, y = 100, width = 360, height = null, recordHistory = true) {
    const id = this.boxIdCounter++;
    const box = new NoteBox(this, id, x, y, width, height);
    this.noteBoxes.push(box);
    this.selectNoteBox(box);
    this.canvas.ensureBounds(this.noteBoxes);
    if (recordHistory && this.history) {
      this.history.pushState('create_box');
    }
    return box;
  }

  findNoteBox(id) {
    return this.noteBoxes.find(b => String(b.id) === String(id));
  }

  removeNoteBox(id) {
    this.noteBoxes = this.noteBoxes.filter(b => String(b.id) !== String(id));
    if (this.selectedNoteBox && String(this.selectedNoteBox.id) === String(id)) {
      this.selectedNoteBox = null;
    }
    if (this.history) {
      this.history.pushState('remove_box');
    }
  }

  selectNoteBox(box, visuallyHighlight = true) {
    this.noteBoxes.forEach(b => b.setSelected(false));
    this.selectedNoteBox = box;
    if (visuallyHighlight && box) {
      box.setSelected(true);
      if (document.activeElement && document.activeElement.isContentEditable) {
        document.activeElement.blur();
      }
    }
  }

  deselectAll() {
    this.noteBoxes.forEach(b => b.setSelected(false));
    this.selectedNoteBox = null;
  }

  /**
   * Bind all ribbon buttons and keyboard helpers
   */
  bindRibbonControls() {
    // New Note
    const btnNew = document.getElementById('btn-new-note');
    if (btnNew) {
      btnNew.onclick = () => {
        const vp = this.canvas.viewport;
        const x = (vp.scrollLeft + 120) / this.canvas.zoomLevel;
        const y = (vp.scrollTop + 120) / this.canvas.zoomLevel;
        const box = this.createNoteBox(Math.round(x), Math.round(y));
        box.addTextBlock('');
      };
    }

    // Insert Table
    const btnTable = document.getElementById('btn-insert-table');
    if (btnTable) {
      btnTable.onclick = () => {
        let targetBox = this.selectedNoteBox;
        if (!targetBox) {
          const vp = this.canvas.viewport;
          targetBox = this.createNoteBox((vp.scrollLeft + 140) / this.canvas.zoomLevel, (vp.scrollTop + 140) / this.canvas.zoomLevel, 440);
        }
        const tableBlock = this.tableModule.createTableElement(3, 3, 'layout-classic-grid');
        targetBox.contentArea.appendChild(tableBlock);
        this.flowEngine.attachGripDrag(tableBlock, targetBox);
      };
    }

    // Insert Image
    const btnImage = document.getElementById('btn-insert-image');
    const fileInput = document.getElementById('image-file-input');
    if (btnImage && fileInput) {
      btnImage.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            let targetBox = this.selectedNoteBox;
            if (!targetBox) {
              const vp = this.canvas.viewport;
              targetBox = this.createNoteBox((vp.scrollLeft + 160) / this.canvas.zoomLevel, (vp.scrollTop + 160) / this.canvas.zoomLevel, 400);
            }
            const imgBlock = this.imageModule.createImageBlock(ev.target.result, file.name);
            targetBox.contentArea.appendChild(imgBlock);
            this.flowEngine.attachGripDrag(imgBlock, targetBox);
          };
          reader.readAsDataURL(file);
        }
      };
    }

    // Text formatting
    const bindFormat = (id, command) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.onclick = () => document.execCommand(command, false, null);
      }
    };
    bindFormat('btn-bold', 'bold');
    bindFormat('btn-italic', 'italic');
    bindFormat('btn-underline', 'underline');
    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.onclick = () => this.history.undo();
    const btnRedo = document.getElementById('btn-redo');
    if (btnRedo) btnRedo.onclick = () => this.history.redo();

    // To-do Checkbox button
    const btnTodo = document.getElementById('btn-todo');
    if (btnTodo) {
      btnTodo.onclick = () => {
        let targetBox = this.selectedNoteBox;
        if (!targetBox) {
          const vp = this.canvas.viewport;
          targetBox = this.createNoteBox((vp.scrollLeft + 100) / this.canvas.zoomLevel, (vp.scrollTop + 100) / this.canvas.zoomLevel);
        }
        targetBox.addTodoBlock('New to-do item');
      };
    }

    // Zoom controls
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnToggleGrid = document.getElementById('btn-toggle-grid');

    if (btnZoomIn) btnZoomIn.onclick = () => this.canvas.adjustZoom(0.1);
    if (btnZoomOut) btnZoomOut.onclick = () => this.canvas.adjustZoom(-0.1);
    if (btnToggleGrid) btnToggleGrid.onclick = () => this.canvas.toggleGrid();
  }

  /**
   * Seed rich starter notes showcasing all features on launch
   */
  seedStarterNotes() {
    // --- Note 1: OneNote Overview & Core Controls ---
    const note1 = this.createNoteBox(60, 50, 420);
    note1.addTextBlock('OneNote Spatial Canvas', true);
    note1.addTextBlock('Welcome to your open spatial desk! Here is how to use it:');
    note1.addTextBlock('• <b>Double-Click anywhere</b> on blank space to create a new note box.');
    note1.addTextBlock('• Hover on the left of any line to see the <b>grip (:::)</b>.');
    note1.addTextBlock('• <b>Pop-Out:</b> Drag the grip outside this box to detach it into its own card.');
    note1.addTextBlock('• <b>Pop-In:</b> Drag an item over another card to see the radiant blue line and drop.');
    note1.addTodoBlock('Try dragging this checklist item to the canvas', false);
    note1.addTodoBlock('Type text and hit Tab to instantly make a table', true);

    // --- Note 2: Table Auto-Detection & 4 Layout Styles ---
    const note2 = this.createNoteBox(520, 50, 520);
    note2.addTextBlock('Productivity & Metrics Table', true);
    note2.addTextBlock('Auto-detects tables when you type a word and press <b>Tab</b>. Try switching layout styles below:');
    
    const tableData = [
      ['Sprint Phase', 'Deliverable', 'Status', 'Owner'],
      ['Phase 1', 'Canvas Engine & Elastic Bounds', 'Completed', 'Engineering'],
      ['Phase 2', 'Table Auto-Detection & 4 Styles', 'Active', 'UI / UX Team'],
      ['Phase 3', 'In-Place Image Cropping & Sizing', 'Testing', 'QA Lead']
    ];
    const tableBlock = this.tableModule.createTableFromData(tableData, 'layout-modern-accent');
    note2.contentArea.appendChild(tableBlock);
    this.flowEngine.attachGripDrag(tableBlock, note2);

    // --- Note 3: Image Sizing, Cropping & Locked Captions ---
    const note3 = this.createNoteBox(1080, 50, 420);
    note3.addTextBlock('Visual Assets & In-Place Crop', true);
    note3.addTextBlock('Images resize seamlessly and have a built-in crop tool:');

    // Create a crisp SVG diagram data URI for instant visual demonstration
    const sampleSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><rect width="400" height="240" fill="%232b223a"/><circle cx="200" cy="120" r="70" fill="%237719aa" opacity="0.8"/><rect x="80" y="80" width="240" height="80" rx="10" fill="%23ffffff" opacity="0.15"/><text x="200" y="115" font-family="sans-serif" font-size="18" font-weight="bold" fill="%23ffffff" text-anchor="middle">OneNote Spatial Engine</text><text x="200" y="140" font-family="sans-serif" font-size="12" fill="%23d8b4fe" text-anchor="middle">Hover &amp; Click "✂ Crop" to Test</text></svg>`;
    const imgBlock = this.imageModule.createImageBlock(sampleSvg, 'Figure 1: Spatial Architecture Vector (Caption Locked)');
    note3.contentArea.appendChild(imgBlock);
    this.flowEngine.attachGripDrag(imgBlock, note3);

    this.deselectAll();
  }
}

// Instantiate application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new OneNoteApp();
});
