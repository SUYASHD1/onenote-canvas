/**
 * OneNote Spatial Canvas — Canvas Stage & Viewport Engine
 * 
 * Responsibilities:
 * - Fixed (0,0) origin anchored at top and left (no negative space).
 * - Elastic dynamic growth: expands width and height down & right when cards near edges.
 * - Zoom controls (50% to 200%) and viewport scroll tracking.
 * - Double-click detection on blank canvas to spawn new note boxes.
 * - Grid toggling and status bar coordinate reporting.
 */

class OneNoteCanvas {
  constructor(viewportId, stageId) {
    this.viewport = document.getElementById(viewportId);
    this.stage = document.getElementById(stageId);
    this.zoomLevel = 1.0;
    this.minZoom = 0.5;
    this.maxZoom = 2.0;
    this.baseWidth = 3200;
    this.baseHeight = 2400;
    this.currentWidth = this.baseWidth;
    this.currentHeight = this.baseHeight;
    this.edgePadding = 400; // auto-expand threshold

    this.onCanvasDoubleClicked = null;
    this.onCanvasSingleClicked = null;

    this.init();
  }

  init() {
    this.applyDimensions();
    this.bindEvents();
    this.updateStatus();
  }

  applyDimensions() {
    this.stage.style.width = `${this.currentWidth}px`;
    this.stage.style.height = `${this.currentHeight}px`;
    this.updateStatus();
  }

  bindEvents() {
    // Double click to create note box at exact position
    this.stage.addEventListener('dblclick', (e) => {
      // Ignore if double-clicking inside an existing note box or interactive element
      if (e.target.closest('.note-box') || e.target.closest('.crop-modal')) {
        return;
      }
      const coords = this.clientToCanvas(e.clientX, e.clientY);
      if (this.onCanvasDoubleClicked) {
        this.onCanvasDoubleClicked(coords.x, coords.y);
      }
    });

    // Single click on empty canvas to deselect all
    this.stage.addEventListener('click', (e) => {
      if (!e.target.closest('.note-box') && !e.target.closest('.crop-modal')) {
        document.querySelectorAll('.image-card.active-selected').forEach(c => c.classList.remove('active-selected'));
        if (this.onCanvasSingleClicked) {
          this.onCanvasSingleClicked();
        }
      }
    });

    // Middle-mouse drag panning
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    this.viewport.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollLeft = this.viewport.scrollLeft;
        scrollTop = this.viewport.scrollTop;
        this.viewport.style.cursor = 'grab';
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.viewport.scrollLeft = scrollLeft - dx;
      this.viewport.scrollTop = scrollTop - dy;
    });

    window.addEventListener('mouseup', (e) => {
      if (isPanning) {
        isPanning = false;
        this.viewport.style.cursor = 'default';
      }
    });

    // Ctrl + Mouse Wheel for Smooth Zooming
    this.viewport.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.adjustZoom(delta, e.clientX, e.clientY);
      }
    }, { passive: false });
  }

  /**
   * Convert client window (screen) coordinates to canvas coordinates
   */
  clientToCanvas(clientX, clientY) {
    const rect = this.stage.getBoundingClientRect();
    const x = (clientX - rect.left) / this.zoomLevel;
    const y = (clientY - rect.top) / this.zoomLevel;
    return {
      x: Math.max(20, Math.round(x)),
      y: Math.max(20, Math.round(y))
    };
  }

  /**
   * Adjust Zoom Level smoothly anchored around mouse or viewport center
   */
  adjustZoom(delta, clientX = null, clientY = null) {
    const prevZoom = this.zoomLevel;
    let nextZoom = Math.round((prevZoom + delta) * 10) / 10;
    nextZoom = Math.min(this.maxZoom, Math.max(this.minZoom, nextZoom));

    if (nextZoom === prevZoom) return;

    this.zoomLevel = nextZoom;
    this.stage.style.transform = `scale(${this.zoomLevel})`;

    // Update zoom label in ribbon
    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }

    this.updateStatus();
  }

  setZoom(val) {
    this.zoomLevel = Math.min(this.maxZoom, Math.max(this.minZoom, val));
    this.stage.style.transform = `scale(${this.zoomLevel})`;
    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
    this.updateStatus();
  }

  toggleGrid() {
    this.stage.classList.toggle('show-grid');
  }

  /**
   * Check if any note box is near the right or bottom boundary, and auto-expand canvas
   */
  ensureBounds(noteBoxes) {
    let maxRight = this.baseWidth;
    let maxBottom = this.baseHeight;

    noteBoxes.forEach(box => {
      const right = box.x + box.width + this.edgePadding;
      const bottom = box.y + (box.height || 200) + this.edgePadding;
      if (right > maxRight) maxRight = right;
      if (bottom > maxBottom) maxBottom = bottom;
    });

    if (maxRight > this.currentWidth || maxBottom > this.currentHeight) {
      this.currentWidth = Math.max(this.currentWidth, maxRight);
      this.currentHeight = Math.max(this.currentHeight, maxBottom);
      this.applyDimensions();
    }
  }

  updateStatus() {
    const dimEl = document.getElementById('canvas-dimensions');
    if (dimEl) {
      dimEl.textContent = `Page Bounds: ${this.currentWidth} × ${this.currentHeight} px (${Math.round(this.zoomLevel * 100)}%)`;
    }
  }
}

// Export for modular usage
window.OneNoteCanvas = OneNoteCanvas;
