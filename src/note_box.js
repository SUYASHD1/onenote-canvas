/**
 * OneNote Spatial Canvas — Universal Note Container Engine
 * 
 * Responsibilities:
 * - Represents a OneNote note container on the canvas.
 * - Top move header bar with move handle (:::) and close button (×).
 * - 8-point perimeter resize handles (all corners and edges).
 * - Smooth dragging and dynamic canvas bounds expansion.
 * - Manages content blocks (paragraphs, checklists, tables, images).
 */

class NoteBox {
  constructor(app, id, x, y, width = 340, height = null) {
    this.app = app;
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.isSelected = false;

    this.element = null;
    this.header = null;
    this.contentArea = null;

    this.createElement();
    this.bindHeaderDrag();
    this.bindPerimeterResize();
  }

  createElement() {
    const box = document.createElement('div');
    box.className = 'note-box';
    box.id = `note-${this.id}`;
    box.dataset.boxId = this.id;
    box.style.left = `${this.x}px`;
    box.style.top = `${this.y}px`;
    box.style.width = `${this.width}px`;
    if (this.height) {
      box.style.height = `${this.height}px`;
    }

    // Top Move Header Bar
    const header = document.createElement('div');
    header.className = 'note-header';
    header.contentEditable = 'false';

    const moveHandle = document.createElement('div');
    moveHandle.className = 'note-move-handle';
    moveHandle.contentEditable = 'false';
    moveHandle.title = 'Drag to move note container';
    moveHandle.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
        <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
      </svg>
      <span>:::</span>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'note-close-btn';
    closeBtn.contentEditable = 'false';
    closeBtn.title = 'Delete Note Box';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.destroy();
    };

    header.appendChild(moveHandle);
    header.appendChild(closeBtn);
    box.appendChild(header);

    // Content Area
    const content = document.createElement('div');
    content.className = 'note-content';
    content.contentEditable = 'true';
    content.spellcheck = true;
    box.appendChild(content);

    // 8-Point Perimeter Resize Handles
    const handlePositions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handlePositions.forEach(pos => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${pos}`;
      handle.dataset.position = pos;
      handle.contentEditable = 'false';
      box.appendChild(handle);
    });

    this.element = box;
    this.header = header;
    this.contentArea = content;

    // Selection behavior
    const onHeaderSelect = (e) => {
      if (e.target !== closeBtn) {
        this.app.selectNoteBox(this);
      }
    };
    header.addEventListener('pointerdown', onHeaderSelect);
    header.addEventListener('mousedown', onHeaderSelect);

    content.addEventListener('focus', () => {
      this.app.selectNoteBox(this, false); // select without border outline to type freely
    });

    // 3-Click Rapid Paragraph Selection (Triple-click selects entire paragraph block)
    content.addEventListener('click', (e) => {
      if (e.detail === 3) {
        const editable = e.target.closest('.canvas-block [contenteditable="true"]');
        if (editable) {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(editable);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });

    // Fast 0ms typing listener (DOM image & table scans are decoupled and executed strictly on paste/drop)
    content.addEventListener('input', () => {
      if (this.app.history) {
        this.app.history.debouncePush('edit_text');
      }
    });

    // Content typing watcher for keyboard triggers (Tab table detection & Ctrl+Enter paragraph block split)
    content.addEventListener('keydown', (e) => {
      const selection = window.getSelection();
      let currentBlock = selection.anchorNode?.parentElement?.closest('.canvas-block');
      if (!currentBlock && e.target && e.target.closest) {
        currentBlock = e.target.closest('.canvas-block');
      }

      // Ctrl + Enter: Split / create a brand-new draggable paragraph block with its own ::: handle!
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const newBlock = this.insertTextBlockAfter(currentBlock, '');
        const editable = newBlock.querySelector('[contenteditable="true"]');
        if (editable) {
          editable.focus();
        }
        if (this.app.history) {
          this.app.history.pushState('split_paragraph');
        }
        return;
      }

      if (this.app.tableModule.handleKeyDown(e, currentBlock)) {
        return;
      }
    });

    // Paste handler for Excel/Tables & safety check
    content.addEventListener('paste', (e) => {
      setTimeout(() => {
        this.upgradeStrayImages();
        this.upgradeStrayTables();
      }, 0);
      const selection = window.getSelection();
      const currentBlock = selection.anchorNode?.parentElement?.closest('.canvas-block');
      if (this.app.tableModule.handlePaste(e, currentBlock)) {
        return;
      }
    });

    // Append to canvas stage
    this.app.canvas.stage.appendChild(box);
  }

  /**
   * Trigger a gentle visual pulse animation on a block
   */
  pulseBlock(block) {
    if (!block) return;
    block.classList.remove('block-spawn-pulse');
    void block.offsetWidth; // Force reflow
    block.classList.add('block-spawn-pulse');
    setTimeout(() => block.classList.remove('block-spawn-pulse'), 600);
  }

  /**
   * Insert a text paragraph block after a specific block
   */
  insertTextBlockAfter(afterBlock, text = '', pulse = true) {
    const block = document.createElement('div');
    block.className = 'canvas-block text-block';
    block.dataset.blockType = 'text';

    const grip = document.createElement('div');
    grip.className = 'block-grip';
    grip.contentEditable = 'false';
    grip.textContent = ':::';
    grip.title = 'Drag to rearrange or drag out to detach';
    block.appendChild(grip);

    const span = document.createElement('div');
    span.contentEditable = 'true';
    span.innerHTML = text || '<br>';
    block.appendChild(span);

    if (afterBlock && afterBlock.nextSibling) {
      this.contentArea.insertBefore(block, afterBlock.nextSibling);
    } else {
      this.contentArea.appendChild(block);
    }

    this.app.flowEngine.attachGripDrag(block, this);

    if (pulse) {
      this.pulseBlock(block);
    }

    return block;
  }

  /**
   * Promotes any unmanaged, naked <img> elements pasted into text blocks into full App Image Cards
   */
  upgradeStrayImages() {
    const strayImgs = this.contentArea.querySelectorAll('.text-block [contenteditable="true"] img:not(.canvas-image):not(.cell-image-preview)');
    if (strayImgs.length === 0) return;

    strayImgs.forEach(img => {
      const parentBlock = img.closest('.canvas-block');
      let src = img.getAttribute('src');
      if (src && src.startsWith('//')) src = 'https:' + src;
      const caption = img.getAttribute('alt') || img.getAttribute('title') || '';
      if (src && !src.includes('spacer.gif')) {
        const imgBlock = this.app.imageModule.createImageBlock(src, caption);
        if (parentBlock && parentBlock.nextSibling) {
          this.contentArea.insertBefore(imgBlock, parentBlock.nextSibling);
        } else {
          this.contentArea.appendChild(imgBlock);
        }
        this.app.flowEngine.attachGripDrag(imgBlock, this);
      }
      img.remove();
    });
  }

  /**
   * Promotes any unmanaged, naked <table> elements pasted into text blocks into full App Table Objects
   */
  upgradeStrayTables() {
    const strayTables = this.contentArea.querySelectorAll('.text-block [contenteditable="true"] table:not(.onenote-table)');
    if (strayTables.length === 0) return;

    strayTables.forEach(table => {
      const parentBlock = table.closest('.canvas-block');
      const tableBlock = this.app.tableModule.createTableFromDOM(table);
      if (parentBlock && parentBlock.nextSibling) {
        this.contentArea.insertBefore(tableBlock, parentBlock.nextSibling);
      } else {
        this.contentArea.appendChild(tableBlock);
      }
      this.app.flowEngine.attachGripDrag(tableBlock, this);
      table.remove();
    });
  }

  /**
   * Add a text paragraph block with hover grip
   */
  addTextBlock(text = '', isHeading = false, pulse = false) {
    const block = document.createElement('div');
    block.className = 'canvas-block text-block';
    block.dataset.blockType = 'text';

    const grip = document.createElement('div');
    grip.className = 'block-grip';
    grip.contentEditable = 'false';
    grip.textContent = ':::';
    grip.title = 'Drag to rearrange or drag out to detach';
    block.appendChild(grip);

    const span = document.createElement('div');
    span.contentEditable = 'true';
    if (isHeading) {
      span.style.fontSize = '18px';
      span.style.fontWeight = '700';
      span.style.color = '#7719aa';
      span.style.marginBottom = '4px';
    }
    span.innerHTML = text || '<br>';
    block.appendChild(span);

    this.contentArea.appendChild(block);
    this.app.flowEngine.attachGripDrag(block, this);

    if (pulse) {
      this.pulseBlock(block);
    }

    return block;
  }

  addParagraphBlock(text = '', pulse = false) {
    return this.addTextBlock(text, false, pulse);
  }

  /**
   * Add a Todo Checklist block with checkbox and hover grip
   */
  addTodoBlock(text = '', checked = false) {
    const block = document.createElement('div');
    block.className = 'canvas-block todo-item';
    block.dataset.blockType = 'todo';

    const grip = document.createElement('div');
    grip.className = 'block-grip';
    grip.contentEditable = 'false';
    grip.textContent = ':::';
    block.appendChild(grip);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.contentEditable = 'false';
    checkbox.checked = checked;
    block.appendChild(checkbox);

    const label = document.createElement('div');
    label.contentEditable = 'true';
    label.style.flex = '1';
    label.innerHTML = text || 'To-do item';
    block.appendChild(label);

    checkbox.addEventListener('change', () => {
      label.style.textDecoration = checkbox.checked ? 'line-through' : 'none';
      label.style.color = checkbox.checked ? '#888' : 'inherit';
    });

    this.contentArea.appendChild(block);
    this.app.flowEngine.attachGripDrag(block, this);
    return block;
  }

  /**
   * Dragging note container by top move bar
   */
  bindHeaderDrag() {
    let isDragging = false;
    let startClientX = 0;
    let startClientY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let curDx = 0;
    let curDy = 0;
    let rafId = null;
    let edgeScrollRafId = null;

    const onStart = (e) => {
      if (e.target.classList.contains('note-close-btn')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isDragging) return;
      isDragging = true;
      startClientX = e.clientX;
      startClientY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      startScrollLeft = this.app.canvas.viewport ? this.app.canvas.viewport.scrollLeft : 0;
      startScrollTop = this.app.canvas.viewport ? this.app.canvas.viewport.scrollTop : 0;
      curDx = 0;
      curDy = 0;

      if (e.pointerId !== undefined && this.header.setPointerCapture) {
        try { this.header.setPointerCapture(e.pointerId); } catch (_) {}
      }

      const isMulti = this.element.classList.contains('multi-selected');
      const boxesToMove = isMulti
        ? this.app.noteBoxes.filter(b => b.element.classList.contains('multi-selected') || b === this)
        : [this];

      const startPositions = boxesToMove.map(b => ({
        box: b,
        startX: b.x,
        startY: b.y
      }));

      // Activate hardware acceleration compositor layer
      boxesToMove.forEach(b => {
        b.element.classList.add('dragging-active');
      });

      if (e.cancelable) e.preventDefault();

      const applyGpuTransform = () => {
        if (!isDragging) return;
        startPositions.forEach(item => {
          const moveX = item.box.x - item.startX;
          const moveY = item.box.y - item.startY;
          item.box.element.style.transform = `translate3d(${moveX}px, ${moveY}px, 0px)`;
        });
        rafId = null;
      };

      const updateCardPositions = () => {
        const zoom = this.app.canvas.zoomLevel || 1.0;
        const curScrollLeft = this.app.canvas.viewport ? this.app.canvas.viewport.scrollLeft : 0;
        const curScrollTop = this.app.canvas.viewport ? this.app.canvas.viewport.scrollTop : 0;
        const scrollDeltaX = curScrollLeft - startScrollLeft;
        const scrollDeltaY = curScrollTop - startScrollTop;

        curDx = (lastClientX - startClientX + scrollDeltaX) / zoom;
        curDy = (lastClientY - startClientY + scrollDeltaY) / zoom;

        startPositions.forEach(item => {
          item.box.x = Math.max(10, Math.round(item.startX + curDx));
          item.box.y = Math.max(10, Math.round(item.startY + curDy));
        });

        // Run smooth visual translation on GPU display frame
        if (!rafId) {
          rafId = requestAnimationFrame(applyGpuTransform);
        } else {
          applyGpuTransform();
        }
      };

      const edgeScrollLoop = () => {
        if (!isDragging) return;
        const boxRect = this.element.getBoundingClientRect();
        const vel = this.app.canvas.getEdgeScrollVelocity(lastClientX, lastClientY, 80, boxRect);
        if (vel.vx !== 0 || vel.vy !== 0) {
          const vp = this.app.canvas.viewport;
          if (vp) {
            // Expand stage if scrolling past current boundaries
            if (vel.vx > 0 && vp.scrollLeft + vp.clientWidth + 100 > this.app.canvas.currentWidth) {
              this.app.canvas.currentWidth += 300;
              this.app.canvas.applyDimensions();
            }
            if (vel.vy > 0 && vp.scrollTop + vp.clientHeight + 100 > this.app.canvas.currentHeight) {
              this.app.canvas.currentHeight += 300;
              this.app.canvas.applyDimensions();
            }

            vp.scrollLeft += vel.vx;
            vp.scrollTop += vel.vy;
            this.app.canvas.updateGhostScrollbars();
          }

          updateCardPositions();
          edgeScrollRafId = requestAnimationFrame(edgeScrollLoop);
        } else {
          edgeScrollRafId = null;
        }
      };

      const onMove = (ev) => {
        if (!isDragging) return;
        lastClientX = ev.clientX;
        lastClientY = ev.clientY;
        updateCardPositions();

        const boxRect = this.element.getBoundingClientRect();
        const vel = this.app.canvas.getEdgeScrollVelocity(lastClientX, lastClientY, 80, boxRect);
        if ((vel.vx !== 0 || vel.vy !== 0) && !edgeScrollRafId) {
          edgeScrollRafId = requestAnimationFrame(edgeScrollLoop);
        }
      };

      const onEnd = (ev) => {
        if (ev && ev.pointerId !== undefined && this.header.releasePointerCapture) {
          try { this.header.releasePointerCapture(ev.pointerId); } catch (_) {}
        }
        if (isDragging) {
          isDragging = false;
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          if (edgeScrollRafId) {
            cancelAnimationFrame(edgeScrollRafId);
            edgeScrollRafId = null;
          }

          // Commit final positions to left/top and release GPU transform
          startPositions.forEach(item => {
            item.box.element.style.transform = '';
            item.box.element.style.left = `${item.box.x}px`;
            item.box.element.style.top = `${item.box.y}px`;
            item.box.element.classList.remove('dragging-active');
          });

          // Perform bounds expansion once at release point
          this.app.canvas.ensureBounds(this.app.noteBoxes);

          if (this.app.history) {
            this.app.history.pushState('move_box');
          }
        }
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    };

    this.header.addEventListener('pointerdown', onStart);
    this.header.addEventListener('mousedown', onStart);
  }

  /**
   * 8-Point Perimeter Resizing
   */
  bindPerimeterResize() {
    const handles = this.element.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
      let isResizing = false;

      const onResizeStart = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (isResizing) return;
        isResizing = true;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        if (e.pointerId !== undefined && handle.setPointerCapture) {
          try { handle.setPointerCapture(e.pointerId); } catch (_) {}
        }

        const pos = handle.dataset.position;
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startX = this.x;
        const startY = this.y;
        const startW = this.element.offsetWidth;
        const startH = this.element.offsetHeight;

        const onResizeMove = (ev) => {
          if (!isResizing) return;
          const zoom = this.app.canvas.zoomLevel || 1.0;
          const dx = (ev.clientX - startClientX) / zoom;
          const dy = (ev.clientY - startClientY) / zoom;

          let newW = startW;
          let newH = startH;
          let newX = startX;
          let newY = startY;

          // Horizontal adjustment
          if (pos.includes('e')) {
            newW = Math.max(200, startW + dx);
          }
          if (pos.includes('w')) {
            const proposedW = startW - dx;
            if (proposedW > 200) {
              newX = startX + dx;
              newW = proposedW;
            }
          }

          // Vertical adjustment
          if (pos.includes('s')) {
            newH = Math.max(80, startH + dy);
          }
          if (pos.includes('n')) {
            const proposedH = startH - dy;
            if (proposedH > 80) {
              newY = startY + dy;
              newH = proposedH;
            }
          }

          this.x = Math.max(10, Math.round(newX));
          this.y = Math.max(10, Math.round(newY));
          this.width = Math.round(newW);
          this.height = Math.round(newH);

          this.element.style.left = `${this.x}px`;
          this.element.style.top = `${this.y}px`;
          this.element.style.width = `${this.width}px`;
          this.element.style.height = `${this.height}px`;

          this.app.canvas.ensureBounds(this.app.noteBoxes);
        };

        const onResizeEnd = (ev) => {
          if (ev && ev.pointerId !== undefined && handle.releasePointerCapture) {
            try { handle.releasePointerCapture(ev.pointerId); } catch (_) {}
          }
          if (isResizing) {
            isResizing = false;
            if (this.app.history) {
              this.app.history.pushState('resize_box');
            }
          }
          window.removeEventListener('mousemove', onResizeMove);
          window.removeEventListener('mouseup', onResizeEnd);
          window.removeEventListener('pointermove', onResizeMove);
          window.removeEventListener('pointerup', onResizeEnd);
          window.removeEventListener('pointercancel', onResizeEnd);
        };

        window.addEventListener('mousemove', onResizeMove);
        window.addEventListener('mouseup', onResizeEnd);
        window.addEventListener('pointermove', onResizeMove);
        window.addEventListener('pointerup', onResizeEnd);
        window.addEventListener('pointercancel', onResizeEnd);
      };

      handle.addEventListener('pointerdown', onResizeStart);
      handle.addEventListener('mousedown', onResizeStart);
    });
  }

  setSelected(selected) {
    this.isSelected = selected;
    if (selected) {
      this.element.classList.add('selected');
    } else {
      this.element.classList.remove('selected');
    }
  }

  checkIfEmpty() {
    const blocks = this.contentArea.querySelectorAll('.canvas-block');
    if (blocks.length === 0) {
      // Add empty default paragraph
      this.addTextBlock('');
    }
  }

  destroy() {
    this.element.remove();
    this.app.removeNoteBox(this.id);
  }
}

// Export for modular usage
window.NoteBox = NoteBox;
