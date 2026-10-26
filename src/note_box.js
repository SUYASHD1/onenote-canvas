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

    const moveHandle = document.createElement('div');
    moveHandle.className = 'note-move-handle';
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

    // Content typing watcher for keyboard triggers (Tab table detection)
    content.addEventListener('keydown', (e) => {
      const selection = window.getSelection();
      const currentBlock = selection.anchorNode?.parentElement?.closest('.canvas-block');
      if (this.app.tableModule.handleKeyDown(e, currentBlock)) {
        return;
      }
    });

    // Paste handler for Excel/Tables
    content.addEventListener('paste', (e) => {
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
   * Add a text paragraph block with hover grip
   */
  addTextBlock(text = '', isHeading = false) {
    const block = document.createElement('div');
    block.className = 'canvas-block text-block';
    block.dataset.blockType = 'text';

    const grip = document.createElement('div');
    grip.className = 'block-grip';
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
    return block;
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
    grip.textContent = ':::';
    block.appendChild(grip);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
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
        isDragging = false;
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
