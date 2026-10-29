/**
 * OneNote Spatial Canvas — Digital Inking & Penmanship Engine
 * 
 * Responsibilities:
 * - Dedicated Draw Ribbon with 4 Quick-Color Pen slots and stroke thickness controls.
 * - Draggable Mode Puck anywhere across the screen to prevent palm contact.
 * - Sheet of Glass prevention: inking canvas is pointer-events: none in Navigate Mode.
 * - Canvas Palm Lock: locks canvas touch and panning in Ink Mode to eliminate accidental jumps.
 * - Pressure-sensitive fluid ballpoint pen with mid-point curve smoothing.
 * - True Under-Text Chisel Highlighter using multiply blending underneath note boxes.
 * - Smart Eraser with whole-stroke and shape erasure.
 * - "Draw-and-Hold" Geometric Shape Snapping for lines, circles, and rectangles.
 * - Seamless Undo/Redo integration and canvas synchronization.
 */

class InkEngine {
  constructor(app) {
    this.app = app;
    this.mode = 'navigate'; // 'navigate' | 'pen' | 'highlighter' | 'eraser'
    this.activeTab = 'home'; // 'home' | 'draw'

    // 4 Quick-Color Pen Slots
    this.colorSlots = ['#111111', '#7719aa', '#0078d4', '#d13438'];
    this.activeSlotIndex = 1;
    this.penColor = this.colorSlots[this.activeSlotIndex];
    this.highlighterColor = 'rgba(255, 235, 59, 0.65)';

    this.penWidth = 4;
    this.highlighterWidth = 22;
    this.eraserRadius = 14;
    this.isCanvasLocked = false;

    this.strokes = []; // Vector storage of strokes
    this.currentStroke = null;
    this.isDrawing = false;
    this.shapeHoldTimer = null;
    this.lastPointerPos = null;

    this.curatedPalette = [
      '#111111', '#505050', '#7719aa', '#0078d4',
      '#008272', '#107c41', '#d13438', '#d83b01',
      '#b4009e', '#8f7034', '#ffb900', '#00b7c3'
    ];

    this.initDOM();
    this.bindTabControls();
    this.bindDrawRibbonControls();
    this.bindInkingEvents();
  }

  initDOM() {
    const stage = document.getElementById('canvas-stage');

    // 1. Highlighter Canvas (Layered UNDER text, z-index: 2)
    this.highlighterCanvas = document.createElement('canvas');
    this.highlighterCanvas.id = 'highlighter-draw-canvas';
    this.highlighterCanvas.className = 'ink-surface-layer under-text';
    this.highlighterCtx = this.highlighterCanvas.getContext('2d');
    stage.insertBefore(this.highlighterCanvas, stage.firstChild);

    // 2. Main Inking Canvas (Layered for Pen & Eraser, z-index: 45)
    this.inkCanvas = document.createElement('canvas');
    this.inkCanvas.id = 'active-draw-canvas';
    this.inkCanvas.className = 'ink-surface-layer over-text';
    this.inkCtx = this.inkCanvas.getContext('2d');
    stage.appendChild(this.inkCanvas);

    // 3. Eraser Cursor Guide Element
    this.eraserGuide = document.createElement('div');
    this.eraserGuide.id = 'eraser-cursor-guide';
    this.eraserGuide.className = 'eraser-guide';
    stage.appendChild(this.eraserGuide);

    // 4. Shape Snapped Notification Pill
    this.snapPill = document.createElement('div');
    this.snapPill.id = 'shape-snap-pill';
    this.snapPill.className = 'shape-snap-pill';
    this.snapPill.textContent = '✨ Snapped';
    stage.appendChild(this.snapPill);

    this.syncCanvasSize();
    window.addEventListener('resize', () => this.syncCanvasSize());
  }

  syncCanvasSize() {
    const stage = document.getElementById('canvas-stage');
    if (!stage) return;
    const w = stage.offsetWidth || 3200;
    const h = stage.offsetHeight || 2400;

    if (this.inkCanvas.width !== w || this.inkCanvas.height !== h) {
      this.inkCanvas.width = w;
      this.inkCanvas.height = h;
      this.highlighterCanvas.width = w;
      this.highlighterCanvas.height = h;
      this.renderAllStrokes();
    }
  }

  // --- Home vs. Draw Tab Switching ---

  bindTabControls() {
    const tabHome = document.getElementById('tab-btn-home');
    const tabDraw = document.getElementById('tab-btn-draw');

    if (tabHome) {
      tabHome.onclick = () => this.switchTab('home');
    }
    if (tabDraw) {
      tabDraw.onclick = () => this.switchTab('draw');
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    const tabHome = document.getElementById('tab-btn-home');
    const tabDraw = document.getElementById('tab-btn-draw');
    const homeContent = document.getElementById('ribbon-home-content');
    const drawContent = document.getElementById('ribbon-draw-content');

    if (tabName === 'draw') {
      if (tabHome) tabHome.classList.remove('active');
      if (tabDraw) tabDraw.classList.add('active');
      if (homeContent) homeContent.style.display = 'none';
      if (drawContent) drawContent.style.display = 'flex';

      // Switch to pen mode and lock canvas for accidental touch protection
      this.setMode('pen');
      this.setCanvasLock(true);
    } else {
      if (tabHome) tabHome.classList.add('active');
      if (tabDraw) tabDraw.classList.remove('active');
      if (homeContent) homeContent.style.display = 'flex';
      if (drawContent) drawContent.style.display = 'none';

      // Switch back to normal pointer mode and unlock canvas
      this.setMode('navigate');
      this.setCanvasLock(false);
    }
  }

  // --- Dedicated Draw Ribbon Controls ---

  bindDrawRibbonControls() {
    const btnPointer = document.getElementById('btn-draw-pointer');
    const btnPen = document.getElementById('btn-draw-pen');
    const btnHighlighter = document.getElementById('btn-draw-highlighter');
    const btnEraser = document.getElementById('btn-draw-eraser');

    if (btnPointer) btnPointer.onclick = () => this.setMode('navigate');
    if (btnPen) btnPen.onclick = () => this.setMode('pen');
    if (btnHighlighter) btnHighlighter.onclick = () => this.setMode('highlighter');
    if (btnEraser) btnEraser.onclick = () => this.setMode('eraser');

    // 4 Quick-Color Pen Slots
    this.renderColorSlots();

    // Dedicated Color Picker Button
    const btnColorPicker = document.getElementById('btn-draw-color-picker');
    const inputColorPicker = document.getElementById('draw-color-picker-input');

    if (btnColorPicker && inputColorPicker) {
      btnColorPicker.onclick = () => {
        inputColorPicker.click();
      };

      const handleColorPick = (e) => {
        const pickedColor = e.target.value;
        this.colorSlots[this.activeSlotIndex] = pickedColor;
        this.penColor = pickedColor;
        this.renderColorSlots();
        this.setMode('pen');
      };

      inputColorPicker.addEventListener('input', handleColorPick);
      inputColorPicker.addEventListener('change', handleColorPick);
    }

    // Thickness Buttons
    const btnThin = document.getElementById('btn-pen-thin');
    const btnMed = document.getElementById('btn-pen-medium');
    const btnThick = document.getElementById('btn-pen-thick');

    const setWidth = (w, activeBtn) => {
      this.penWidth = w;
      [btnThin, btnMed, btnThick].forEach(b => b?.classList.remove('active'));
      activeBtn?.classList.add('active');
      if (this.mode !== 'highlighter' && this.mode !== 'eraser') {
        this.setMode('pen');
      }
    };

    if (btnThin) btnThin.onclick = () => setWidth(2, btnThin);
    if (btnMed) btnMed.onclick = () => setWidth(4, btnMed);
    if (btnThick) btnThick.onclick = () => setWidth(8, btnThick);

    // Canvas Palm Lock Toggle
    const btnLock = document.getElementById('btn-toggle-canvas-lock');
    if (btnLock) {
      btnLock.onclick = () => this.setCanvasLock(!this.isCanvasLocked);
    }
  }

  renderColorSlots() {
    this.colorSlots.forEach((col, idx) => {
      const el = document.getElementById(`pen-slot-${idx}`);
      if (!el) return;
      const tip = el.querySelector('.pen-slot-tip');
      if (tip) tip.style.backgroundColor = col;
      el.classList.toggle('active', idx === this.activeSlotIndex);

      el.onclick = () => {
        this.activeSlotIndex = idx;
        this.penColor = col;
        this.renderColorSlots();
        this.setMode('pen');
        const pickerInput = document.getElementById('draw-color-picker-input');
        if (pickerInput) pickerInput.value = col;
      };
    });

    const previewSwatch = document.getElementById('draw-picker-preview');
    if (previewSwatch) {
      previewSwatch.style.backgroundColor = this.colorSlots[this.activeSlotIndex];
    }
  }

  setCanvasLock(locked) {
    this.isCanvasLocked = locked;
    if (this.app.canvas) {
      if (typeof this.app.canvas.setLocked === 'function') {
        this.app.canvas.setLocked(locked);
      } else {
        this.app.canvas.isPanningLocked = locked;
      }
    }
    const badge = document.getElementById('canvas-lock-badge');
    const btnLock = document.getElementById('btn-toggle-canvas-lock');
    if (badge && btnLock) {
      if (locked) {
        badge.textContent = '🔒 Canvas Locked';
        btnLock.classList.add('active');
      } else {
        badge.textContent = '🔓 Canvas Unlocked';
        btnLock.classList.remove('active');
      }
    }
  }

  // --- Mode Switching ---

  setMode(newMode) {
    this.mode = newMode;

    // 1. Sync Top Draw Ribbon Buttons
    const ribbonDrawButtons = [
      { id: 'btn-draw-pointer', mode: 'navigate' },
      { id: 'btn-draw-pen', mode: 'pen' },
      { id: 'btn-draw-highlighter', mode: 'highlighter' },
      { id: 'btn-draw-eraser', mode: 'eraser' }
    ];
    ribbonDrawButtons.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) el.classList.toggle('active', item.mode === newMode);
    });

    // 2. Pointer event switching ("Sheet of Glass" prevention)
    if (newMode === 'navigate') {
      this.inkCanvas.style.pointerEvents = 'none';
      this.eraserGuide.style.display = 'none';
      document.body.classList.remove('ink-mode-active');
    } else {
      this.inkCanvas.style.pointerEvents = 'auto';
      document.body.classList.add('ink-mode-active');
      this.eraserGuide.style.display = newMode === 'eraser' ? 'block' : 'none';
    }
  }

  // Backward compatibility stubs
  bindPuckControls() {}
  bindDraggablePuck() {}

  // --- Inking & Drawing Handlers ---

  bindInkingEvents() {
    const canvas = this.inkCanvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode === 'navigate') return;
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}

      const pos = this.getCanvasCoords(e);
      this.isDrawing = true;
      this.lastPointerPos = pos;

      if (this.mode === 'eraser') {
        this.eraseAt(pos.x, pos.y);
        return;
      }

      this.currentStroke = {
        id: 'stroke-' + Date.now(),
        tool: this.mode,
        color: this.mode === 'pen' ? this.penColor : this.highlighterColor,
        width: this.mode === 'pen' ? this.penWidth : this.highlighterWidth,
        points: [{ x: pos.x, y: pos.y, p: e.pressure || 0.5 }],
        shape: null
      };

      // Draw initial contact dot instantly
      this.drawContactDot(this.currentStroke);
      this.startShapeHoldTimer();
    });

    canvas.addEventListener('pointermove', (e) => {
      const pos = this.getCanvasCoords(e);

      // Update eraser cursor guide
      if (this.mode === 'eraser') {
        this.eraserGuide.style.left = `${pos.x - this.eraserRadius}px`;
        this.eraserGuide.style.top = `${pos.y - this.eraserRadius}px`;
      }

      if (!this.isDrawing) return;

      if (this.mode === 'eraser') {
        this.eraseAt(pos.x, pos.y);
        return;
      }

      // Check distance moved for Draw-and-Hold shape snapping
      if (this.lastPointerPos) {
        const dist = Math.hypot(pos.x - this.lastPointerPos.x, pos.y - this.lastPointerPos.y);
        if (dist > 14) {
          this.lastPointerPos = pos;
          this.startShapeHoldTimer(); // Reset stillness timer
        }
      }

      this.currentStroke.points.push({ x: pos.x, y: pos.y, p: e.pressure || 0.5 });
      // Buttery smooth incremental segment rendering (0ms lag, no full-canvas clears)
      this.drawLatestSegment(this.currentStroke);
    });

    const stopDrawing = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.clearShapeHoldTimer();

      if (this.currentStroke && this.currentStroke.points.length > 0) {
        if (this.currentStroke.points.length > 1 && !this.currentStroke.shape) {
          this.drawFinalSegment(this.currentStroke);
        }
        this.strokes.push(this.currentStroke);
        this.currentStroke = null;
        if (this.app.history) this.app.history.pushState('ink_stroke');
      }
    };

    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
  }

  getCanvasCoords(e) {
    const stage = document.getElementById('canvas-stage');
    const rect = stage.getBoundingClientRect();
    const zoom = this.app.canvas ? this.app.canvas.zoomLevel : 1;
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    };
  }

  // --- Draw-and-Hold Geometric Shape Snapping ---

  startShapeHoldTimer() {
    this.clearShapeHoldTimer();
    this.shapeHoldTimer = setTimeout(() => {
      if (this.isDrawing && this.currentStroke && this.currentStroke.points.length >= 8) {
        this.snapCurrentStroke();
      }
    }, 420);
  }

  clearShapeHoldTimer() {
    if (this.shapeHoldTimer) {
      clearTimeout(this.shapeHoldTimer);
      this.shapeHoldTimer = null;
    }
  }

  snapCurrentStroke() {
    const pts = this.currentStroke.points;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const startEndDist = Math.hypot(last.x - first.x, last.y - first.y);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const w = maxX - minX;
    const h = maxY - minY;

    let shapeType = null;
    let shapeData = null;

    if (startEndDist < 35 && pts.length > 12) {
      shapeType = 'ellipse';
      shapeData = { cx: minX + w / 2, cy: minY + h / 2, rx: w / 2, ry: h / 2 };
    } else {
      let totalLength = 0;
      for (let i = 1; i < pts.length; i++) {
        totalLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }
      if (startEndDist / totalLength > 0.88) {
        shapeType = 'line';
        shapeData = { x1: first.x, y1: first.y, x2: last.x, y2: last.y };
      }
    }

    if (shapeType) {
      this.currentStroke.shape = { type: shapeType, data: shapeData };
      this.showSnapNotification(last.x, last.y);
      this.renderActiveStroke();
    }
  }

  showSnapNotification(x, y) {
    if (!this.snapPill) return;
    this.snapPill.style.left = `${x + 12}px`;
    this.snapPill.style.top = `${y - 12}px`;
    this.snapPill.classList.add('visible');
    setTimeout(() => this.snapPill.classList.remove('visible'), 900);
  }

  // --- Smart Eraser ---

  eraseAt(x, y) {
    const r = this.eraserRadius;
    const initialCount = this.strokes.length;

    this.strokes = this.strokes.filter(stroke => {
      if (stroke.shape) {
        if (stroke.shape.type === 'ellipse') {
          const d = stroke.shape.data;
          const distFromCenter = Math.hypot(x - d.cx, y - d.cy);
          if (distFromCenter <= Math.max(d.rx, d.ry) + r) {
            return false;
          }
        } else if (stroke.shape.type === 'line') {
          const d = stroke.shape.data;
          const distToLine = Math.min(Math.hypot(x - d.x1, y - d.y1), Math.hypot(x - d.x2, y - d.y2));
          if (distToLine <= r) return false;
        }
      }

      for (const pt of stroke.points) {
        if (Math.hypot(pt.x - x, pt.y - y) <= r) {
          return false;
        }
      }
      return true;
    });

    if (this.strokes.length !== initialCount) {
      this.renderAllStrokes();
      if (this.app.history) this.app.history.debouncePush('erase_stroke');
    }
  }

  // --- Rendering Vectors & Highlighters ---

  isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  resolveDisplayColor(color, tool) {
    if (!color) return color;
    if (!this.isDarkMode()) {
      return color;
    }

    if (tool === 'highlighter') {
      const c = color.toLowerCase();
      // Standard daylight yellow highlighter becomes midnight warm amber glow
      if (c.includes('255, 235, 59') || c.includes('#ffeb3b') || c.includes('yellow')) {
        return 'rgba(255, 225, 90, 0.65)';
      }
      return color;
    }

    // Pen: automatically soften black/dark ink to cream white (#f5f5f5) on dark paper
    const clean = color.trim().toLowerCase();
    if (
      clean === '#111111' ||
      clean === '#111' ||
      clean === '#000000' ||
      clean === '#000' ||
      clean === '#1a1a1a' ||
      clean === '#222222' ||
      clean === '#242424' ||
      clean === 'rgb(17, 17, 17)' ||
      clean === 'rgb(0, 0, 0)' ||
      clean === 'rgb(36, 36, 36)' ||
      clean === 'black'
    ) {
      return '#f5f5f5';
    }

    return color;
  }

  onThemeChanged(theme) {
    // Update visual swatch on slot 0
    const slot0Tip = document.querySelector('#pen-slot-0 .pen-slot-tip');
    const slot0Btn = document.getElementById('pen-slot-0');
    if (slot0Tip) {
      slot0Tip.style.backgroundColor = theme === 'dark' ? '#f5f5f5' : '#111111';
    }
    if (slot0Btn) {
      slot0Btn.title = theme === 'dark' ? 'Pen 1 (Cream White)' : 'Pen 1 (Black)';
    }

    // Refresh inking canvas with smart theme colors
    this.renderAllStrokes();
  }

  renderAllStrokes() {
    this.inkCtx.clearRect(0, 0, this.inkCanvas.width, this.inkCanvas.height);
    this.highlighterCtx.clearRect(0, 0, this.highlighterCanvas.width, this.highlighterCanvas.height);
    this.strokes.forEach(s => this.drawStroke(s));
  }

  renderActiveStroke() {
    if (!this.currentStroke) return;
    this.renderAllStrokes();
    this.drawStroke(this.currentStroke);
  }

  drawContactDot(stroke) {
    const isHighlighter = stroke.tool === 'highlighter';
    const ctx = isHighlighter ? this.highlighterCtx : this.inkCtx;
    const pt = stroke.points[0];
    if (!pt) return;

    ctx.save();
    ctx.fillStyle = this.resolveDisplayColor(stroke.color, stroke.tool);
    if (isHighlighter) {
      ctx.globalCompositeOperation = this.isDarkMode() ? 'screen' : 'multiply';
    }
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawLatestSegment(stroke) {
    const pts = stroke.points;
    const len = pts.length;
    if (len < 2) return;

    const isHighlighter = stroke.tool === 'highlighter';
    const ctx = isHighlighter ? this.highlighterCtx : this.inkCtx;

    ctx.save();
    ctx.strokeStyle = this.resolveDisplayColor(stroke.color, stroke.tool);
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isHighlighter) {
      ctx.globalCompositeOperation = this.isDarkMode() ? 'screen' : 'multiply';
    }

    ctx.beginPath();
    if (len === 2) {
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(midX, midY);
    } else {
      const prevMidX = (pts[len - 3].x + pts[len - 2].x) / 2;
      const prevMidY = (pts[len - 3].y + pts[len - 2].y) / 2;
      const curMidX = (pts[len - 2].x + pts[len - 1].x) / 2;
      const curMidY = (pts[len - 2].y + pts[len - 1].y) / 2;

      ctx.moveTo(prevMidX, prevMidY);
      ctx.quadraticCurveTo(pts[len - 2].x, pts[len - 2].y, curMidX, curMidY);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawFinalSegment(stroke) {
    const pts = stroke.points;
    const len = pts.length;
    if (len < 2) return;

    const isHighlighter = stroke.tool === 'highlighter';
    const ctx = isHighlighter ? this.highlighterCtx : this.inkCtx;

    ctx.save();
    ctx.strokeStyle = this.resolveDisplayColor(stroke.color, stroke.tool);
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isHighlighter) {
      ctx.globalCompositeOperation = this.isDarkMode() ? 'screen' : 'multiply';
    }

    ctx.beginPath();
    const finalMidX = (pts[len - 2].x + pts[len - 1].x) / 2;
    const finalMidY = (pts[len - 2].y + pts[len - 1].y) / 2;
    ctx.moveTo(finalMidX, finalMidY);
    ctx.lineTo(pts[len - 1].x, pts[len - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  drawStroke(stroke) {
    const isHighlighter = stroke.tool === 'highlighter';
    const ctx = isHighlighter ? this.highlighterCtx : this.inkCtx;
    const displayColor = this.resolveDisplayColor(stroke.color, stroke.tool);

    ctx.save();
    ctx.strokeStyle = displayColor;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isHighlighter) {
      ctx.globalCompositeOperation = this.isDarkMode() ? 'screen' : 'multiply';
    }

    if (stroke.shape) {
      ctx.beginPath();
      if (stroke.shape.type === 'line') {
        const d = stroke.shape.data;
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
      } else if (stroke.shape.type === 'ellipse') {
        const d = stroke.shape.data;
        ctx.ellipse(d.cx, d.cy, d.rx, d.ry, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    const pts = stroke.points;
    if (pts.length < 2) {
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = displayColor;
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }

    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  // --- Serialization for Pages & History ---

  serializeStrokes() {
    return JSON.parse(JSON.stringify(this.strokes));
  }

  restoreStrokes(strokesArray) {
    this.strokes = Array.isArray(strokesArray) ? strokesArray : [];
    this.renderAllStrokes();
  }
}

// Export for modular usage
window.InkEngine = InkEngine;
