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
    header.addEventListener('mousedown', (e) => {
      if (e.target !== closeBtn) {
        this.app.selectNoteBox(this);
      }
    });

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

    content.addEventListener('input', () => {
      this.upgradeStrayImages();
      this.upgradeStrayTables();
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
    let startBoxX = 0;
    let startBoxY = 0;

    this.header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('note-close-btn')) return;
      isDragging = true;
      startClientX = e.clientX;
      startClientY = e.clientY;
      startBoxX = this.x;
      startBoxY = this.y;
      e.preventDefault();

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const zoom = this.app.canvas.zoomLevel;
        const dx = (ev.clientX - startClientX) / zoom;
        const dy = (ev.clientY - startClientY) / zoom;

        // Origin (0,0) protection: prevent dragging past top or left boundary
        this.x = Math.max(10, Math.round(startBoxX + dx));
        this.y = Math.max(10, Math.round(startBoxY + dy));

        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;

        // Check if canvas stage needs to grow down or right
        this.app.canvas.ensureBounds(this.app.noteBoxes);
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          if (this.app.history) {
            this.app.history.pushState('move_box');
          }
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * 8-Point Perimeter Resizing
   */
  bindPerimeterResize() {
    const handles = this.element.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const pos = handle.dataset.position;

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startX = this.x;
        const startY = this.y;
        const startW = this.element.offsetWidth;
        const startH = this.element.offsetHeight;

        const onMouseMove = (ev) => {
          const zoom = this.app.canvas.zoomLevel;
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

        const onMouseUp = () => {
          if (this.app.history) {
            this.app.history.pushState('resize_box');
          }
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
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
