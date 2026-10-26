/**
 * OneNote Spatial Canvas — Element Flow Engine (Pop-In & Pop-Out)
 * 
 * Responsibilities:
 * - Left-margin hover grips (:::) for every block (text, image, table, todo).
 * - Dragging inside: reorders items between lines.
 * - Pop-Out (Detach): dragging outside note box bounds detaches item into a fresh note box.
 * - Pop-In (Merge): dragging over another note box displays the glowing blue guideline
 *   and inserts the element between paragraphs on drop.
 */

class ElementFlowEngine {
  constructor(app) {
    this.app = app;
    this.guideline = document.getElementById('drop-guideline');
    this.activeDragElement = null;
    this.dragSourceBox = null;
    this.isDragging = false;
    this.targetBox = null;
    this.insertIndex = -1;
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
      this.startBlockDrag(blockEl, parentNoteBox, e);
    });
  }

  /**
   * Start dragging a block via its left-margin grip
   */
  startBlockDrag(blockEl, noteBox, e) {
    this.isDragging = true;
    this.activeDragElement = blockEl;
    this.dragSourceBox = noteBox;
    blockEl.classList.add('is-dragging-origin');

    // Create a visual drag ghost that follows the cursor
    const ghost = blockEl.cloneNode(true);
    ghost.id = 'drag-ghost';
    ghost.style.position = 'fixed';
    ghost.style.zIndex = '99999';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.75';
    ghost.style.transform = 'scale(0.95)';
    ghost.style.width = `${blockEl.offsetWidth}px`;
    ghost.style.background = '#ffffff';
    ghost.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
    ghost.style.border = '1px solid #7719aa';
    document.body.appendChild(ghost);
    this.ghost = ghost;

    this.updateGhostPosition(e.clientX, e.clientY);
  }

  updateGhostPosition(clientX, clientY) {
    if (this.ghost) {
      this.ghost.style.left = `${clientX + 10}px`;
      this.ghost.style.top = `${clientY + 10}px`;
    }
  }

  initGlobalEvents() {
    window.addEventListener('mousemove', (e) => {
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

    window.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      this.finalizeDrop(e);
    });
  }

  /**
   * Hovering over a note box: calculate the nearest paragraph gap and show blue guideline
   */
  handleHoverOverNoteBox(noteBoxEl, clientX, clientY) {
    this.targetBox = noteBoxEl;
    const contentArea = noteBoxEl.querySelector('.note-content');
    if (!contentArea) return;

    const blocks = Array.from(contentArea.querySelectorAll('.canvas-block'))
      .filter(b => b !== this.activeDragElement);

    let closestBlock = null;
    let insertPosition = 'after'; // 'before' or 'after'
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

    // Position the Radiant Blue Drop Guideline
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
      // Empty container or hovering at top
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
    if (this.ghost) {
      this.ghost.remove();
      this.ghost = null;
    }

    if (this.activeDragElement) {
      this.activeDragElement.classList.remove('is-dragging-origin');
    }

    const draggedElement = this.activeDragElement;
    const sourceBox = this.dragSourceBox;
    const targetBoxEl = this.targetBox;
    const targetAfter = this.targetAfterBlock;

    this.hideGuideline();
    this.isDragging = false;
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

        // Reattach hover grip listener to the target box
        const targetBoxInstance = this.app.findNoteBox(targetBoxEl.dataset.boxId);
        if (targetBoxInstance) {
          this.attachGripDrag(draggedElement, targetBoxInstance);
        }

        // Check if source box became completely empty, clean up if needed
        if (sourceBox && sourceBox.element !== targetBoxEl) {
          sourceBox.checkIfEmpty();
        }
        return;
      }
    }

    // SCENARIO 2: Pop-Out (Detach into a brand new standalone Note Box)
    const dropCoords = this.app.canvas.clientToCanvas(e.clientX, e.clientY);
    const newBox = this.app.createNoteBox(dropCoords.x - 20, dropCoords.y - 20, Math.max(280, draggedElement.offsetWidth + 40));
    
    // Clear default empty paragraph in new box and insert detached item
    newBox.contentArea.innerHTML = '';
    newBox.contentArea.appendChild(draggedElement);
    this.attachGripDrag(draggedElement, newBox);

    // Clean up source box
    if (sourceBox) {
      sourceBox.checkIfEmpty();
    }
  }
}

// Export for modular usage
window.ElementFlowEngine = ElementFlowEngine;
