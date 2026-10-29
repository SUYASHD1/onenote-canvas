/**
 * OneNote Spatial Canvas — Canvas Stage & Viewport Engine
 * 
 * Responsibilities:
 * - Fixed (0,0) origin anchored at top and left (no negative space).
 * - Elastic dynamic growth: expands width and height down & right when cards near edges.
 * - Cursor-Anchored Zero-Drift Zooming: keeps content under cursor stationary.
 * - Kinetic Gliding (Momentum Panning): smooth coasting on pointer release.
 * - Ghost Spatial Scrollbars: translucent tracks, real-time thumbs, click-to-jump.
 * - Marquee Multi-Box Selection: radiant selection box to select and group note cards.
 * - Double-click detection on blank canvas to spawn new note boxes.
 * - Grid toggling and status bar coordinate reporting.
 */

class OneNoteCanvas {
  constructor(viewportId, stageId) {
    this.viewport = document.getElementById(viewportId);
    this.stage = document.getElementById(stageId);
    this.app = null; // Set by OneNoteApp

    this.zoomLevel = 1.0;
    this.minZoom = 0.5;
    this.maxZoom = 2.0;
    this.baseWidth = 3200;
    this.baseHeight = 2400;
    this.currentWidth = this.baseWidth;
    this.currentHeight = this.baseHeight;
    this.edgePadding = 400;
    this.isPanningLocked = false;

    // Callbacks
    this.onCanvasDoubleClicked = null;
    this.onCanvasSingleClicked = null;

    // Kinetic momentum state
    this.momentumAnimId = null;
    this.velocitySamples = [];

    // Ghost scrollbars elements
    this.ghostH = document.getElementById('ghost-scrollbar-h');
    this.ghostThumbH = document.getElementById('ghost-thumb-h');
    this.ghostV = document.getElementById('ghost-scrollbar-v');
    this.ghostThumbV = document.getElementById('ghost-thumb-v');

    // Marquee selection state
    this.isMarqueeSelecting = false;
    this.marqueeBoxEl = null;

    this.init();
  }

  init() {
    this.applyDimensions();
    this.bindEvents();
    this.initGhostScrollbars();
    this.initMarqueeSelection();
    this.updateStatus();
    this.updateGhostScrollbars();
  }

  applyDimensions() {
    const vpW = this.viewport ? this.viewport.clientWidth : window.innerWidth;
    const vpH = this.viewport ? this.viewport.clientHeight : window.innerHeight;
    const minW = Math.ceil((vpW || 1440) / this.zoomLevel);
    const minH = Math.ceil((vpH || 900) / this.zoomLevel);

    this.effectiveWidth = Math.max(this.currentWidth, minW);
    this.effectiveHeight = Math.max(this.currentHeight, minH);

    this.stage.style.width = `${this.effectiveWidth}px`;
    this.stage.style.height = `${this.effectiveHeight}px`;
    this.updateStatus();
    this.updateGhostScrollbars();
    if (this.app && this.app.inkEngine && typeof this.app.inkEngine.syncCanvasSize === 'function') {
      this.app.inkEngine.syncCanvasSize();
    }
  }

  bindEvents() {
    // Double click to create note box at exact position
    this.stage.addEventListener('dblclick', (e) => {
      if (e.target.closest('.note-box') || e.target.closest('.crop-modal')) {
        return;
      }
      const coords = this.clientToCanvas(e.clientX, e.clientY);
      if (this.onCanvasDoubleClicked) {
        this.onCanvasDoubleClicked(coords.x, coords.y);
      }
    });

    // Middle-mouse or Alt+Click drag panning with kinetic momentum & RAF governor
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let panRafId = null;
    let targetScrollX = 0;
    let targetScrollY = 0;

    const applyPan = () => {
      if (!isPanning) return;
      this.viewport.scrollLeft = targetScrollX;
      this.viewport.scrollTop = targetScrollY;
      this.updateGhostScrollbars();
      panRafId = null;
    };

    // Active touches for mobile/tablet gestures
    const activeTouches = new Map();
    let initialPinchDist = null;
    let lastPinchCenter = null;
    let lastTapInfo = null;
    let touchStartTime = 0;
    let touchStartPos = null;

    // Viewport Pointerdown: handles touch gestures & tablet navigation
    this.viewport.addEventListener('pointerdown', (e) => {
      if (this.isPanningLocked) return;

      if (e.pointerType === 'pen') {
        return; // Stylus/pen inputs never pan the canvas viewport
      }

      if (e.pointerType === 'touch') {
        // Disregard touches starting on note boxes, modals, scrollbars, or controls
        if (e.target.closest('.note-box, .crop-modal, .ghost-scrollbar, button, input, select, .ribbon-cluster')) {
          return;
        }

        // In ink mode: if pen is drawing, or if finger drawing is active, freeze viewport panning
        if (this.app && this.app.inkEngine && this.app.inkEngine.mode !== 'navigate') {
          if (this.app.inkEngine.isDrawing || !this.app.inkEngine.pencilOnly) {
            return;
          }
        }

        activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try {
          this.viewport.setPointerCapture(e.pointerId);
        } catch (_) {}

        if (activeTouches.size === 1) {
          touchStartTime = Date.now();
          touchStartPos = { x: e.clientX, y: e.clientY };

          // 1-finger background drag pan
          this.stopMomentum();
          isPanning = true;
          startX = e.clientX;
          startY = e.clientY;
          scrollLeft = this.viewport.scrollLeft;
          scrollTop = this.viewport.scrollTop;
          targetScrollX = scrollLeft;
          targetScrollY = scrollTop;
          this.velocitySamples = [{ time: performance.now(), x: e.clientX, y: e.clientY }];
        } else if (activeTouches.size === 2) {
          // 2 fingers down: initiate two-finger pinch-to-zoom and pan
          isPanning = false;
          if (panRafId) {
            cancelAnimationFrame(panRafId);
            panRafId = null;
          }
          const touches = Array.from(activeTouches.values());
          initialPinchDist = Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
          lastPinchCenter = {
            x: (touches[0].x + touches[1].x) / 2,
            y: (touches[0].y + touches[1].y) / 2
          };
        }
      }
    }, { passive: true });

    this.viewport.addEventListener('mousedown', (e) => {
      if (this.isPanningLocked) return;
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        this.stopMomentum();
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollLeft = this.viewport.scrollLeft;
        scrollTop = this.viewport.scrollTop;
        targetScrollX = scrollLeft;
        targetScrollY = scrollTop;
        this.velocitySamples = [{ time: performance.now(), x: e.clientX, y: e.clientY }];
        this.viewport.style.cursor = 'grab';
        e.preventDefault();
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        if (this.app && this.app.inkEngine && this.app.inkEngine.isDrawing) {
          return; // Ignore resting palm slide while actively drawing with pen
        }

        if (activeTouches.has(e.pointerId)) {
          activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (activeTouches.size >= 2) {
          const touches = Array.from(activeTouches.values());
          const curDist = Math.hypot(touches[1].x - touches[0].x, touches[1].y - touches[0].y);
          const curCenter = {
            x: (touches[0].x + touches[1].x) / 2,
            y: (touches[0].y + touches[1].y) / 2
          };

          // Pinch zoom
          if (initialPinchDist && initialPinchDist > 5) {
            const pinchDiff = curDist - initialPinchDist;
            if (Math.abs(pinchDiff) > 3) {
              const zoomDelta = pinchDiff / 320;
              this.adjustZoom(zoomDelta, curCenter.x, curCenter.y);
              initialPinchDist = curDist;
            }
          }

          // Two-finger pan
          if (lastPinchCenter) {
            const dx = curCenter.x - lastPinchCenter.x;
            const dy = curCenter.y - lastPinchCenter.y;
            this.viewport.scrollLeft -= dx;
            this.viewport.scrollTop -= dy;
            this.updateGhostScrollbars();
          }
          lastPinchCenter = curCenter;
          return;
        }

        if (isPanning && activeTouches.size === 1) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          targetScrollX = scrollLeft - dx;
          targetScrollY = scrollTop - dy;

          const now = performance.now();
          this.velocitySamples.push({ time: now, x: e.clientX, y: e.clientY });
          if (this.velocitySamples.length > 5) {
            this.velocitySamples.shift();
          }

          if (!panRafId) {
            panRafId = requestAnimationFrame(applyPan);
          }
        }
      }
    }, { passive: true });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      targetScrollX = scrollLeft - dx;
      targetScrollY = scrollTop - dy;

      const now = performance.now();
      this.velocitySamples.push({ time: now, x: e.clientX, y: e.clientY });
      if (this.velocitySamples.length > 5) {
        this.velocitySamples.shift();
      }

      if (!panRafId) {
        panRafId = requestAnimationFrame(applyPan);
      }
    });

    const handleTouchPointerUp = (e) => {
      if (e.pointerType === 'touch') {
        try {
          if (this.viewport.hasPointerCapture && this.viewport.hasPointerCapture(e.pointerId)) {
            this.viewport.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}

        const touchDownPos = activeTouches.get(e.pointerId);
        activeTouches.delete(e.pointerId);
        if (activeTouches.size < 2) {
          initialPinchDist = null;
          lastPinchCenter = null;
        }

        // Tap & double-tap recognition upon lifting a stationary single touch
        if (activeTouches.size === 0 && touchStartPos && touchDownPos) {
          const dt = Date.now() - touchStartTime;
          const dist = Math.hypot(e.clientX - touchStartPos.x, e.clientY - touchStartPos.y);
          if (dt < 300 && dist < 20) {
            const now = Date.now();
            if (lastTapInfo && (now - lastTapInfo.time < 350) && Math.hypot(e.clientX - lastTapInfo.x, e.clientY - lastTapInfo.y) < 25) {
              lastTapInfo = null;
              const coords = this.clientToCanvas(e.clientX, e.clientY);
              if (this.onCanvasDoubleClicked) {
                this.onCanvasDoubleClicked(coords.x, coords.y);
              }
            } else {
              lastTapInfo = { time: now, x: e.clientX, y: e.clientY };
            }
          }
          touchStartPos = null;
        }

        if (isPanning && activeTouches.size === 0) {
          isPanning = false;
          if (panRafId) {
            cancelAnimationFrame(panRafId);
            panRafId = null;
          }
          applyPan();

          if (this.velocitySamples.length >= 2) {
            const now = performance.now();
            const oldest = this.velocitySamples[0];
            const dt = now - oldest.time;
            if (dt > 0 && dt < 200) {
              const vx = ((e.clientX - oldest.x) / dt) * 16.6;
              const vy = ((e.clientY - oldest.y) / dt) * 16.6;
              if (Math.hypot(vx, vy) > 1.2) {
                this.startMomentum(vx, vy);
              }
            }
          }
        }
      }
    };
    window.addEventListener('pointerup', handleTouchPointerUp, { passive: true });
    window.addEventListener('pointercancel', handleTouchPointerUp, { passive: true });

    window.addEventListener('mouseup', (e) => {
      if (isPanning) {
        isPanning = false;
        if (panRafId) {
          cancelAnimationFrame(panRafId);
          panRafId = null;
        }
        applyPan();
        this.viewport.style.cursor = 'default';

        // Calculate release velocity for kinetic gliding
        if (this.velocitySamples.length >= 2) {
          const now = performance.now();
          const oldest = this.velocitySamples[0];
          const dt = now - oldest.time;
          if (dt > 0 && dt < 200) {
            const vx = ((e.clientX - oldest.x) / dt) * 16.6;
            const vy = ((e.clientY - oldest.y) / dt) * 16.6;
            if (Math.hypot(vx, vy) > 1.2) {
              this.startMomentum(vx, vy);
            }
          }
        }
      }
    });

    // Wheel event: completely freeze when locked; cursor-anchored zoom when ctrlKey pressed
    this.viewport.addEventListener('wheel', (e) => {
      if (this.isPanningLocked) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.adjustZoom(delta, e.clientX, e.clientY);
      }
    }, { passive: false });

    // Block native browser scrolling so our kinetic panning & pinch-zoom engine has 100% exclusive, jitter-free control
    this.viewport.addEventListener('touchmove', (e) => {
      if (e.cancelable && !e.target.closest('input, textarea, select')) {
        e.preventDefault();
      }
    }, { passive: false });

    // Sync ghost scrollbars and auto-expand infinite canvas on native viewport scrolling
    let scrollbarRafId = null;
    this.viewport.addEventListener('scroll', () => {
      if (!scrollbarRafId) {
        scrollbarRafId = requestAnimationFrame(() => {
          this.checkInfiniteExpansion();
          this.updateGhostScrollbars();
          scrollbarRafId = null;
        });
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      this.updateGhostScrollbars();
    });
  }

  /**
   * Seamless Infinite Canvas Expansion:
   * Keeps stage paper and grid perpetually larger than viewport scrolling position
   */
  checkInfiniteExpansion() {
    if (!this.viewport) return;
    const vp = this.viewport;
    const zoom = this.zoomLevel || 1.0;
    const threshold = 400;
    let expanded = false;

    if (vp.scrollLeft + vp.clientWidth + threshold > (this.effectiveWidth || this.currentWidth) * zoom) {
      this.currentWidth = Math.max(this.currentWidth, Math.ceil((vp.scrollLeft + vp.clientWidth + 1200) / zoom));
      expanded = true;
    }
    if (vp.scrollTop + vp.clientHeight + threshold > (this.effectiveHeight || this.currentHeight) * zoom) {
      this.currentHeight = Math.max(this.currentHeight, Math.ceil((vp.scrollTop + vp.clientHeight + 1200) / zoom));
      expanded = true;
    }

    if (expanded) {
      this.applyDimensions();
    }
  }

  /**
   * Set Canvas Lock (Palm Rejection)
   */
  setLocked(locked) {
    this.isPanningLocked = !!locked;
    if (this.isPanningLocked) {
      this.stopMomentum();
      this.viewport.classList.add('canvas-locked');
      this.viewport.style.overflow = 'hidden';
      this.viewport.style.touchAction = 'none';
    } else {
      this.viewport.classList.remove('canvas-locked');
      this.viewport.style.overflow = 'scroll';
      this.viewport.style.touchAction = 'none';
    }
    this.updateGhostScrollbars();
  }

  /**
   * Convert client window (screen) coordinates to canvas coordinates
   */
  clientToCanvas(clientX, clientY) {
    const rect = this.stage.getBoundingClientRect();
    const x = (clientX - rect.left) / this.zoomLevel;
    const y = (clientY - rect.top) / this.zoomLevel;
    return {
      x: Math.max(10, Math.round(x)),
      y: Math.max(10, Math.round(y))
    };
  }

  /**
   * Adjust Zoom Level with Cursor-Anchored Zero-Drift Math
   */
  adjustZoom(delta, clientX = null, clientY = null) {
    const prevZoom = this.zoomLevel;
    let nextZoom = Math.round((prevZoom + delta) * 10) / 10;
    nextZoom = Math.min(this.maxZoom, Math.max(this.minZoom, nextZoom));
    if (nextZoom === prevZoom) return;

    this.applyZoomAt(nextZoom, clientX, clientY);
  }

  setZoom(val, clientX = null, clientY = null) {
    const nextZoom = Math.min(this.maxZoom, Math.max(this.minZoom, val));
    if (nextZoom === this.zoomLevel) return;

    this.applyZoomAt(nextZoom, clientX, clientY);
  }

  applyZoomAt(targetZoom, clientX = null, clientY = null) {
    const prevZoom = this.zoomLevel;
    const vRect = this.viewport.getBoundingClientRect();

    // Determine pivot point (cursor location or viewport center)
    const pivotX = (clientX !== null ? clientX : (vRect.left + vRect.width / 2)) - vRect.left;
    const pivotY = (clientY !== null ? clientY : (vRect.top + vRect.height / 2)) - vRect.top;

    // Exact stage coordinate under pivot before scaling
    const stageX = (this.viewport.scrollLeft + pivotX) / prevZoom;
    const stageY = (this.viewport.scrollTop + pivotY) / prevZoom;

    this.zoomLevel = targetZoom;
    this.stage.style.transform = `scale(${this.zoomLevel})`;
    this.applyDimensions();

    // Re-anchor scroll so the same stage point stays stationary under pivot
    this.viewport.scrollLeft = Math.max(0, stageX * targetZoom - pivotX);
    this.viewport.scrollTop = Math.max(0, stageY * targetZoom - pivotY);

    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }

    this.updateStatus();
    this.updateGhostScrollbars();
  }

  toggleGrid() {
    this.stage.classList.toggle('show-grid');
  }

  /**
   * Kinetic Gliding (Momentum Panning)
   */
  startMomentum(vx, vy) {
    this.stopMomentum();
    let curVx = Math.max(-35, Math.min(35, vx));
    let curVy = Math.max(-35, Math.min(35, vy));

    const step = () => {
      curVx *= 0.935;
      curVy *= 0.935;
      this.viewport.scrollLeft -= curVx;
      this.viewport.scrollTop -= curVy;
      this.updateGhostScrollbars();

      if (Math.hypot(curVx, curVy) > 0.4) {
        this.momentumAnimId = requestAnimationFrame(step);
      } else {
        this.stopMomentum();
      }
    };
    this.momentumAnimId = requestAnimationFrame(step);
  }

  stopMomentum() {
    if (this.momentumAnimId) {
      cancelAnimationFrame(this.momentumAnimId);
      this.momentumAnimId = null;
    }
  }

  /**
   * Ghost Spatial Scrollbars: Click-to-Jump & Real-time Dragging
   */
  initGhostScrollbars() {
    if (!this.ghostH || !this.ghostV) return;

    // Horizontal Track Jump & Drag
    let isDraggingH = false;
    let dragStartX = 0;
    let initialScrollLeft = 0;

    this.ghostThumbH.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingH = true;
      dragStartX = e.clientX;
      initialScrollLeft = this.viewport.scrollLeft;
      this.ghostThumbH.classList.add('dragging');
    });

    this.ghostH.addEventListener('mousedown', (e) => {
      if (e.target === this.ghostThumbH) return;
      const rect = this.ghostH.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const maxScroll = Math.max(0, (this.currentWidth * this.zoomLevel) - this.viewport.clientWidth);
      this.viewport.scrollLeft = clickRatio * maxScroll;
      this.updateGhostScrollbars();
    });

    // Vertical Track Jump & Drag
    let isDraggingV = false;
    let dragStartY = 0;
    let initialScrollTop = 0;

    this.ghostThumbV.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingV = true;
      dragStartY = e.clientY;
      initialScrollTop = this.viewport.scrollTop;
      this.ghostThumbV.classList.add('dragging');
    });

    this.ghostV.addEventListener('mousedown', (e) => {
      if (e.target === this.ghostThumbV) return;
      const rect = this.ghostV.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const maxScroll = Math.max(0, (this.currentHeight * this.zoomLevel) - this.viewport.clientHeight);
      this.viewport.scrollTop = clickRatio * maxScroll;
      this.updateGhostScrollbars();
    });

    let ghostDragRafId = null;
    let targetGhostScrollX = null;
    let targetGhostScrollY = null;

    const applyGhostScroll = () => {
      if (targetGhostScrollX !== null) {
        this.viewport.scrollLeft = targetGhostScrollX;
        targetGhostScrollX = null;
      }
      if (targetGhostScrollY !== null) {
        this.viewport.scrollTop = targetGhostScrollY;
        targetGhostScrollY = null;
      }
      this.updateGhostScrollbars();
      ghostDragRafId = null;
    };

    window.addEventListener('mousemove', (e) => {
      if (isDraggingH) {
        const trackW = this.ghostH.clientWidth - this.ghostThumbH.clientWidth;
        if (trackW > 0) {
          const deltaX = e.clientX - dragStartX;
          const maxScroll = Math.max(0, (this.currentWidth * this.zoomLevel) - this.viewport.clientWidth);
          targetGhostScrollX = initialScrollLeft + (deltaX / trackW) * maxScroll;
        }
      }
      if (isDraggingV) {
        const trackH = this.ghostV.clientHeight - this.ghostThumbV.clientHeight;
        if (trackH > 0) {
          const deltaY = e.clientY - dragStartY;
          const maxScroll = Math.max(0, (this.currentHeight * this.zoomLevel) - this.viewport.clientHeight);
          targetGhostScrollY = initialScrollTop + (deltaY / trackH) * maxScroll;
        }
      }
      if (isDraggingH || isDraggingV) {
        if (!ghostDragRafId) {
          ghostDragRafId = requestAnimationFrame(applyGhostScroll);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (ghostDragRafId) {
        cancelAnimationFrame(ghostDragRafId);
        ghostDragRafId = null;
      }
      applyGhostScroll();
      if (isDraggingH) {
        isDraggingH = false;
        this.ghostThumbH.classList.remove('dragging');
      }
      if (isDraggingV) {
        isDraggingV = false;
        this.ghostThumbV.classList.remove('dragging');
      }
    });
  }

  updateGhostScrollbars() {
    if (!this.ghostH || !this.ghostV || !this.ghostThumbH || !this.ghostThumbV) return;

    const vpW = this.viewport.clientWidth;
    const vpH = this.viewport.clientHeight;
    const totalW = (this.effectiveWidth || this.currentWidth) * this.zoomLevel;
    const totalH = (this.effectiveHeight || this.currentHeight) * this.zoomLevel;

    const maxScrollX = Math.max(0, totalW - vpW);
    const maxScrollY = Math.max(0, totalH - vpH);

    // Horizontal thumb calculation
    const trackW = this.ghostH.clientWidth;
    const thumbW = Math.max(30, Math.min(trackW, (vpW / totalW) * trackW));
    const ratioX = maxScrollX > 0 ? (this.viewport.scrollLeft / maxScrollX) : 0;
    const thumbX = Math.max(0, Math.min(trackW - thumbW, ratioX * (trackW - thumbW)));

    this.ghostThumbH.style.width = `${thumbW}px`;
    this.ghostThumbH.style.transform = `translateX(${thumbX}px)`;

    // Vertical thumb calculation
    const trackH = this.ghostV.clientHeight;
    const thumbH = Math.max(30, Math.min(trackH, (vpH / totalH) * trackH));
    const ratioY = maxScrollY > 0 ? (this.viewport.scrollTop / maxScrollY) : 0;
    const thumbY = Math.max(0, Math.min(trackH - thumbH, ratioY * (trackH - thumbH)));

    this.ghostThumbV.style.height = `${thumbH}px`;
    this.ghostThumbV.style.transform = `translateY(${thumbY}px)`;
  }

  /**
   * Marquee Multi-Box Selection (Rubber-Band Box)
   */
  initMarqueeSelection() {
    let startScreenX = 0;
    let startScreenY = 0;
    let startCanvasPos = null;
    let lastClientX = 0;
    let lastClientY = 0;
    let isTracking = false;
    let edgeScrollRafId = null;

    this.stage.addEventListener('mousedown', (e) => {
      // Only trigger on left-click directly on stage background
      if (e.button !== 0 || e.altKey || e.ctrlKey) return;
      if (e.target.closest('.note-box') || e.target.closest('.crop-modal') || e.target.closest('.ghost-scrollbar')) {
        return;
      }

      this.stopMomentum();
      isTracking = true;
      this.isMarqueeSelecting = false;
      startScreenX = e.clientX;
      startScreenY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      startCanvasPos = this.clientToCanvas(e.clientX, e.clientY);
    });

    const updateMarquee = () => {
      if (!isTracking || !startCanvasPos) return;
      this.isMarqueeSelecting = true;
      if (!this.marqueeBoxEl) {
        this.marqueeBoxEl = document.createElement('div');
        this.marqueeBoxEl.className = 'marquee-selection-box';
        this.stage.appendChild(this.marqueeBoxEl);
      }

      const currentCanvasPos = this.clientToCanvas(lastClientX, lastClientY);

      const left = Math.min(startCanvasPos.x, currentCanvasPos.x);
      const top = Math.min(startCanvasPos.y, currentCanvasPos.y);
      const width = Math.abs(currentCanvasPos.x - startCanvasPos.x);
      const height = Math.abs(currentCanvasPos.y - startCanvasPos.y);

      this.marqueeBoxEl.style.left = `${left}px`;
      this.marqueeBoxEl.style.top = `${top}px`;
      this.marqueeBoxEl.style.width = `${width}px`;
      this.marqueeBoxEl.style.height = `${height}px`;

      // Highlight intersecting note boxes
      if (this.app && this.app.noteBoxes) {
        this.app.noteBoxes.forEach(box => {
          const bX = box.x;
          const bY = box.y;
          const bW = box.element.offsetWidth || box.width;
          const bH = box.element.offsetHeight || 100;

          const intersects = (
            bX < left + width &&
            bX + bW > left &&
            bY < top + height &&
            bY + bH > top
          );

          if (intersects) {
            box.element.classList.add('multi-selected');
          } else {
            box.element.classList.remove('multi-selected');
          }
        });
      }
    };

    const edgeScrollLoop = () => {
      if (!isTracking) return;
      const vel = this.getEdgeScrollVelocity(lastClientX, lastClientY, 60);
      if (vel.vx !== 0 || vel.vy !== 0) {
        const vp = this.viewport;
        if (vp) {
          // Expand stage if scrolling past current boundaries
          if (vel.vx > 0 && vp.scrollLeft + vp.clientWidth + 100 > this.currentWidth) {
            this.currentWidth += 300;
            this.applyDimensions();
          }
          if (vel.vy > 0 && vp.scrollTop + vp.clientHeight + 100 > this.currentHeight) {
            this.currentHeight += 300;
            this.applyDimensions();
          }

          vp.scrollLeft += vel.vx;
          vp.scrollTop += vel.vy;
          this.updateGhostScrollbars();
        }

        updateMarquee();
        edgeScrollRafId = requestAnimationFrame(edgeScrollLoop);
      } else {
        edgeScrollRafId = null;
      }
    };

    window.addEventListener('mousemove', (e) => {
      if (!isTracking) return;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      const dist = Math.hypot(e.clientX - startScreenX, e.clientY - startScreenY);
      if (dist > 5) {
        updateMarquee();

        const vel = this.getEdgeScrollVelocity(lastClientX, lastClientY, 60);
        if ((vel.vx !== 0 || vel.vy !== 0) && !edgeScrollRafId) {
          edgeScrollRafId = requestAnimationFrame(edgeScrollLoop);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (isTracking) {
        isTracking = false;
        if (edgeScrollRafId) {
          cancelAnimationFrame(edgeScrollRafId);
          edgeScrollRafId = null;
        }
        if (this.marqueeBoxEl) {
          this.marqueeBoxEl.remove();
          this.marqueeBoxEl = null;
        }

        // If it was just a quick click (not a marquee drag), clear multi-selection
        if (!this.isMarqueeSelecting) {
          document.querySelectorAll('.note-box.multi-selected').forEach(b => b.classList.remove('multi-selected'));
          document.querySelectorAll('.image-card.active-selected, .table-wrapper.active-selected').forEach(c => c.classList.remove('active-selected'));
          if (this.onCanvasSingleClicked) {
            this.onCanvasSingleClicked();
          }
        }
        this.isMarqueeSelecting = false;
        startCanvasPos = null;
      }
    });
  }

  /**
   * Smart Boundary Edge Auto-Scroll Engine
   * Calculates proportional scrolling velocity when pointer or dragged card is within edgeZone pixels of boundary
   */
  getEdgeScrollVelocity(clientX, clientY, edgeZone = 80, boxRect = null) {
    if (!this.viewport) return { vx: 0, vy: 0 };
    const rect = this.viewport.getBoundingClientRect();

    let vx = 0;
    let vy = 0;

    // Check Left: either pointer is near/past left edge OR box's left edge is near/past left edge
    const isLeftMouse = clientX < rect.left + edgeZone;
    const isLeftBox = boxRect && boxRect.left < rect.left + edgeZone;
    if (isLeftMouse || isLeftBox) {
      const dist = Math.max(0, Math.min(clientX - rect.left, boxRect ? boxRect.left - rect.left : Infinity));
      const ratio = Math.max(0, 1 - (dist / edgeZone));
      vx = -Math.round(ratio * 16 + 4);
    } 
    // Check Right: either pointer is near/past right edge OR box's right edge is near/past right edge
    const isRightMouse = clientX > rect.right - edgeZone;
    const isRightBox = boxRect && boxRect.right > rect.right - edgeZone;
    if (isRightMouse || isRightBox) {
      const dist = Math.max(0, Math.min(rect.right - clientX, boxRect ? rect.right - boxRect.right : Infinity));
      const ratio = Math.max(0, 1 - (dist / edgeZone));
      vx = Math.round(ratio * 16 + 4);
    }

    // Check Top: either pointer is near/past top edge OR box's top edge is near/past top edge
    const isTopMouse = clientY < rect.top + edgeZone;
    const isTopBox = boxRect && boxRect.top < rect.top + edgeZone;
    if (isTopMouse || isTopBox) {
      const dist = Math.max(0, Math.min(clientY - rect.top, boxRect ? boxRect.top - rect.top : Infinity));
      const ratio = Math.max(0, 1 - (dist / edgeZone));
      vy = -Math.round(ratio * 16 + 4);
    }
    // Check Bottom: either pointer is near/past bottom edge OR box's bottom edge is near/past bottom edge
    const isBottomMouse = clientY > rect.bottom - edgeZone;
    const isBottomBox = boxRect && boxRect.bottom > rect.bottom - edgeZone;
    if (isBottomMouse || isBottomBox) {
      const dist = Math.max(0, Math.min(rect.bottom - clientY, boxRect ? rect.bottom - boxRect.bottom : Infinity));
      const ratio = Math.max(0, 1 - (dist / edgeZone));
      vy = Math.round(ratio * 16 + 4);
    }

    return { vx, vy };
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
