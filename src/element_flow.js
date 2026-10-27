/**
 * OneNote Spatial Canvas — Element Flow Engine (Pop-In & Pop-Out)
 * 
 * Responsibilities:
 * - Left-margin hover grips (:::) for every block (text, image, table, todo).
 * - Dragging inside: reorders items between lines.
 * - Pop-Out (Detach): dragging outside note box bounds detaches item into a fresh note box.
 * - Pop-In (Merge): dragging over another note box displays the glowing blue guideline
 *   and inserts the element between paragraphs on drop.
 * - Robust cleanup: Prevents sticky or orphaned drag ghost elements on screen.
 */

class ElementFlowEngine {
  constructor(app) {
    this.app = app;
    this.guideline = document.getElementById('drop-guideline');
    this.activeDragElement = null;
    this.dragSourceBox = null;
    this.isDragging = false;
    this.pendingDrag = null;
    this.dragThreshold = 5; // pixels before drag starts
    this.ghost = null;
    this.targetBox = null;
    this.targetAfterBlock = null;

    this.initGlobalEvents();
  }

  /**
   * Attach drag behavior to a block's left grip (:::)
   */
  attachGripDrag(blockEl, parentNoteBox) {
    const grip = blockEl.querySelector('.block-grip');
    if (!grip) return;

    grip.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      // Store pending drag; do NOT spawn ghost immediately on mousedown
      this.pendingDrag = {
        blockEl,
        noteBox: parentNoteBox,
        startX: e.clientX,
        startY: e.clientY
      };
    });
  }

  initGlobalEvents() {
    window.addEventListener('mousemove', (e) => {
      // 1. Check if pending drag crosses threshold
      if (this.pendingDrag && !this.isDragging) {
        const dx = Math.abs(e.clientX - this.pendingDrag.startX);
        const dy = Math.abs(e.clientY - this.pendingDrag.startY);
        if (dx > this.dragThreshold || dy > this.dragThreshold) {
          this.startBlockDrag(this.pendingDrag.blockEl, this.pendingDrag.noteBox, e);
          this.pendingDrag = null;
        }
      }

      if (!this.isDragging || !this.activeDragElement) return;

      this.updateGhostPosition(e.clientX, e.clientY);

      // Check if mouse is hovering over any note-box content
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      const noteBoxEl = elementsUnder.find(el => el.classList?.contains('note-box'));

      if (noteBoxEl) {
        this.handleHoverOverNoteBox(noteBoxEl, e.clientX, e.clientY);
      } else {
        this.hideGuideline();
      }
    });

    // Mouseup triggers drop or selection on click
    window.addEventListener('mouseup', (e) => {
      if (this.pendingDrag) {
        const clickedBlock = this.pendingDrag.blockEl;
        this.selectBlock(clickedBlock);
        this.pendingDrag = null;
      }
      if (this.isDragging) {
        this.finalizeDrop(e);
      } else {
        this.cleanAllGhosts();
      }
    });

    // Safety net: cancel drag if window loses focus
    window.addEventListener('blur', () => this.cancelDrag());
  }

  /**
   * Start dragging a block via its left-margin grip
   */
  startBlockDrag(blockEl, noteBox, e) {
    this.cleanAllGhosts();
    this.isDragging = true;
    this.activeDragElement = blockEl;
    this.dragSourceBox = noteBox;
    blockEl.classList.add('is-dragging-origin');

    // Create a compact, clean visual drag indicator that follows cursor
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.position = 'fixed';
    ghost.style.zIndex = '99999';
    ghost.style.pointerEvents = 'none';
    ghost.style.padding = '6px 12px';
    ghost.style.borderRadius = '4px';
    ghost.style.background = '#7719aa';
    ghost.style.color = '#ffffff';
    ghost.style.fontSize = '12px';
    ghost.style.fontWeight = '600';
    ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
    ghost.innerHTML = `::: Moving ${blockEl.dataset.blockType || 'item'}`;
    
    document.body.appendChild(ghost);
    this.ghost = ghost;

    this.updateGhostPosition(e.clientX, e.clientY);
  }

  updateGhostPosition(clientX, clientY) {
    if (this.ghost) {
      this.ghost.style.left = `${clientX + 14}px`;
      this.ghost.style.top = `${clientY + 14}px`;
    }
  }

  cleanAllGhosts() {
    document.querySelectorAll('.drag-ghost').forEach(el => el.remove());
    if (this.ghost) {
      this.ghost.remove();
      this.ghost = null;
    }
  }

  cancelDrag() {
    this.cleanAllGhosts();
    if (this.activeDragElement) {
      this.activeDragElement.classList.remove('is-dragging-origin');
    }
    this.hideGuideline();
    this.isDragging = false;
    this.pendingDrag = null;
    this.activeDragElement = null;
    this.dragSourceBox = null;
  }

  /**
   * Hovering over a note box: calculate nearest paragraph gap and show radiant blue guideline
   */
  handleHoverOverNoteBox(noteBoxEl, clientX, clientY) {
    this.targetBox = noteBoxEl;
    const contentArea = noteBoxEl.querySelector('.note-content');
    if (!contentArea) return;

    const blocks = Array.from(contentArea.querySelectorAll('.canvas-block'))
      .filter(b => b !== this.activeDragElement);

    let closestBlock = null;
    let insertPosition = 'after';
    let bestDist = Infinity;

    blocks.forEach(block => {
      const rect = block.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const dist = Math.abs(clientY - midY);

      if (dist < bestDist) {
        bestDist = dist;
        closestBlock = block;
        insertPosition = clientY < midY ? 'before' : 'after';
      }
    });

    if (closestBlock) {
      this.targetAfterBlock = insertPosition === 'after' ? closestBlock : closestBlock.previousElementSibling;
      const bRect = closestBlock.getBoundingClientRect();
      const stageRect = this.app.canvas.stage.getBoundingClientRect();
      const zoom = this.app.canvas.zoomLevel;

      const lineY = insertPosition === 'before' ? bRect.top : bRect.bottom;
      const stageX = (bRect.left - stageRect.left) / zoom;
      const stageY = (lineY - stageRect.top) / zoom;

      this.showGuideline(stageX, stageY, bRect.width / zoom);
    } else {
      this.targetAfterBlock = null;
      const cRect = contentArea.getBoundingClientRect();
      const stageRect = this.app.canvas.stage.getBoundingClientRect();
      const zoom = this.app.canvas.zoomLevel;
      const stageX = (cRect.left - stageRect.left) / zoom;
      const stageY = (cRect.top + 8 - stageRect.top) / zoom;
      this.showGuideline(stageX, stageY, cRect.width / zoom);
    }
  }

  showGuideline(x, y, width) {
    if (!this.guideline) return;
    this.guideline.style.left = `${x}px`;
    this.guideline.style.top = `${y}px`;
    this.guideline.style.width = `${Math.max(160, width)}px`;
    this.guideline.classList.add('active');
  }

  hideGuideline() {
    if (this.guideline) {
      this.guideline.classList.remove('active');
    }
    this.targetBox = null;
    this.targetAfterBlock = null;
  }

  /**
   * Finalize the drag & drop: Pop-In (Merge) or Pop-Out (Detach to new Note Box)
   */
  finalizeDrop(e) {
    this.cleanAllGhosts();

    if (this.activeDragElement) {
      this.activeDragElement.classList.remove('is-dragging-origin');
    }

    const draggedElement = this.activeDragElement;
    const sourceBox = this.dragSourceBox;
    const targetBoxEl = this.targetBox;
    const targetAfter = this.targetAfterBlock;

    this.hideGuideline();
    this.isDragging = false;
    this.pendingDrag = null;
    this.activeDragElement = null;
    this.dragSourceBox = null;

    if (!draggedElement) return;

    // SCENARIO 1: Pop-In / Merge into a note container
    if (targetBoxEl) {
      const targetContent = targetBoxEl.querySelector('.note-content');
      if (targetContent) {
        if (targetAfter && targetAfter.parentNode === targetContent) {
          targetContent.insertBefore(draggedElement, targetAfter.nextSibling);
        } else if (targetContent.firstChild) {
          targetContent.insertBefore(draggedElement, targetContent.firstChild);
        } else {
          targetContent.appendChild(draggedElement);
        }

        const targetBoxInstance = this.app.findNoteBox(targetBoxEl.dataset.boxId);
        if (targetBoxInstance) {
          this.attachGripDrag(draggedElement, targetBoxInstance);
        }

        if (sourceBox && sourceBox.element !== targetBoxEl) {
          sourceBox.checkIfEmpty();
        }
        if (this.app.history) {
          this.app.history.pushState('merge_item');
        }
        return;
      }
    }

    // SCENARIO 2: Dropped outside on empty canvas -> Pop Out to new Note Box
    const dropCoords = this.app.canvas.clientToCanvas(e.clientX, e.clientY);
    const newBox = this.app.createNoteBox(dropCoords.x - 20, dropCoords.y - 20, Math.max(280, draggedElement.offsetWidth + 40));
    
    newBox.contentArea.innerHTML = '';
    newBox.contentArea.appendChild(draggedElement);
    this.attachGripDrag(draggedElement, newBox);

    if (sourceBox) {
      sourceBox.checkIfEmpty();
    }
    if (this.app.history) {
      this.app.history.pushState('pop_out_item');
    }
  }

  /**
   * Select entire paragraph or object when user clicks on its margin grab handle (:::)
   */
  selectBlock(blockEl) {
    if (!blockEl) return;
    const parentBoxEl = blockEl.closest('.note-box');
    if (parentBoxEl) {
      const box = this.app.findNoteBox(parentBoxEl.dataset.boxId);
      if (box) this.app.selectNoteBox(box, false);
    }

    // 1. Text or Heading or List Block: Select entire paragraph text
    const editable = blockEl.querySelector('[contenteditable="true"]');
    if (editable) {
      editable.focus();
      const range = document.createRange();
      range.selectNodeContents(editable);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

    // 2. Image Card
    const imgCard = blockEl.querySelector('.image-card');
    if (imgCard) {
      this.app.selectObject(imgCard, 'image');
      return;
    }

    // 3. Table Wrapper
    const tableWrapper = blockEl.querySelector('.table-wrapper');
    if (tableWrapper) {
      this.app.selectObject(tableWrapper, 'table');
      return;
    }

    // 4. Math Card
    const mathCard = blockEl.querySelector('.math-card');
    if (mathCard) {
      this.app.selectObject(mathCard, 'math');
      return;
    }
  }
}

// Export for modular usage
window.ElementFlowEngine = ElementFlowEngine;
