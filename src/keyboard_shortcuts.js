/**
 * OneNote Spatial Canvas — Universal 3-Tier Keyboard Shortcut Engine
 * 
 * Responsibilities:
 * - Tier 1: Typing text (letters delete only, container is 100% immune to deletion).
 * - Tier 2: Item Selected (table or image highlighted -> Delete removes only that item,
 *           Ctrl+C copies item, Ctrl+X cuts item).
 * - Tier 3: Container Selected (header clicked -> Delete removes container,
 *           Ctrl+C copies entire container, Ctrl+X cuts entire container).
 * - Canvas Paste (Ctrl+V): Pastes copied card or item at mouse position on the canvas.
 * - Outline navigation: Alt+Shift+Up/Down (reorder), Tab/Shift+Tab (indent).
 * - Ctrl+A selection ladder: Line -> Container Content -> Whole Container.
 */

class KeyboardController {
  constructor(app) {
    this.app = app;
    this.ctrlACounter = 0;
    this.mouseCanvasPos = { x: 200, y: 150 };
    this.internalClipboard = null; // Internal lossless clipboard

    this.bindEvents();
  }

  bindEvents() {
    // Track mouse position on canvas for accurate Ctrl+V paste positioning
    window.addEventListener('mousemove', (e) => {
      this.mouseCanvasPos = this.app.canvas.clientToCanvas(e.clientX, e.clientY);
    });

    // Reset Ctrl+A ladder when clicking anywhere
    window.addEventListener('mousedown', () => {
      this.ctrlACounter = 0;
    });

    window.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
  }

  /**
   * Universal keyboard shortcut dispatcher
   */
  handleGlobalKeyDown(e) {
    const activeEl = document.activeElement;
    const isTyping = (activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) ||
                     (e.target && (e.target.isContentEditable || e.target.closest?.('[contenteditable="true"]')));
    const selectedBox = this.app.selectedNoteBox;
    const selectedItem = document.querySelector('.image-card.active-selected, .table-wrapper.active-selected');
    const isModifierKey = e.ctrlKey || e.metaKey;

    // =========================================================================
    // 1. Outline Shortcuts: Alt + Shift + Up / Down (Move block up or down)
    // =========================================================================
    if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const selection = window.getSelection();
      const block = selection.anchorNode?.parentElement?.closest('.canvas-block');
      if (block) {
        e.preventDefault();
        this.moveBlockUpDown(block, e.key === 'ArrowUp' ? -1 : 1);
        return;
      }
    }

    // =========================================================================
    // 2. Outline Shortcuts: Tab / Shift + Tab for Indentation
    // =========================================================================
    if (e.key === 'Tab' && isTyping) {
      const selection = window.getSelection();
      const block = selection.anchorNode?.parentElement?.closest('.canvas-block');
      if (block && !block.closest('.table-wrapper')) {
        const text = block.innerText.trim();
        if (text.length === 0 || e.shiftKey) {
          e.preventDefault();
          this.indentBlock(block, e.shiftKey ? -24 : 24);
          return;
        }
      }
    }

    // =========================================================================
    // 3. Selection Ladder: Ctrl + A (Line -> Container Content -> Container)
    // =========================================================================
    if (isModifierKey && (e.key === 'a' || e.key === 'A')) {
      if (isTyping) {
        this.ctrlACounter++;
        if (this.ctrlACounter === 1) {
          const selection = window.getSelection();
          const block = selection.anchorNode?.parentElement?.closest('.canvas-block');
          if (block) {
            e.preventDefault();
            const range = document.createRange();
            range.selectNodeContents(block);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
          }
        } else if (this.ctrlACounter === 2) {
          const contentArea = activeEl.closest('.note-content');
          if (contentArea) {
            e.preventDefault();
            const range = document.createRange();
            range.selectNodeContents(contentArea);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            return;
          }
        } else if (this.ctrlACounter >= 3) {
          if (selectedBox) {
            e.preventDefault();
            selectedBox.setSelected(true);
            document.activeElement.blur();
            return;
          }
        }
      }
    }

    // =========================================================================
    // 4. Universal Copy: Ctrl + C
    // =========================================================================
    if (isModifierKey && (e.key === 'c' || e.key === 'C')) {
      const hasTextSelection = window.getSelection()?.toString()?.length > 0;

      // Tier 2: Item Selected (Image or Table)
      if (selectedItem && !hasTextSelection) {
        e.preventDefault();
        const block = selectedItem.closest('.canvas-block');
        if (block) {
          this.internalClipboard = {
            type: 'item',
            html: block.outerHTML
          };
        }
        return;
      }

      // Tier 3: Container Selected
      if (selectedBox && selectedBox.isSelected && !hasTextSelection) {
        e.preventDefault();
        this.internalClipboard = {
          type: 'note-box',
          width: selectedBox.width,
          html: selectedBox.contentArea.innerHTML
        };
        try {
          navigator.clipboard?.writeText?.(selectedBox.contentArea.innerText);
        } catch (_) {}
        return;
      }

      // Tier 1: Text highlighted -> allow native browser copy
      return;
    }

    // =========================================================================
    // 5. Universal Cut: Ctrl + X
    // =========================================================================
    if (isModifierKey && (e.key === 'x' || e.key === 'X')) {
      const hasTextSelection = window.getSelection()?.toString()?.length > 0;

      // Tier 2: Item Selected
      if (selectedItem && !hasTextSelection) {
        e.preventDefault();
        const block = selectedItem.closest('.canvas-block');
        if (block) {
          this.internalClipboard = {
            type: 'item',
            html: block.outerHTML
          };
          block.remove();
        }
        return;
      }

      // Tier 3: Container Selected
      if (selectedBox && selectedBox.isSelected && !hasTextSelection) {
        e.preventDefault();
        this.internalClipboard = {
          type: 'note-box',
          width: selectedBox.width,
          html: selectedBox.contentArea.innerHTML
        };
        try {
          navigator.clipboard?.writeText?.(selectedBox.contentArea.innerText);
        } catch (_) {}
        selectedBox.destroy();
        this.app.selectedNoteBox = null;
        return;
      }

      // Tier 1: Text highlighted -> allow native browser cut
      return;
    }

    // =========================================================================
    // 6. Universal Paste: Ctrl + V
    // =========================================================================
    if (isModifierKey && (e.key === 'v' || e.key === 'V')) {
      // Case A: Not actively typing text (pasting onto canvas or note header)
      if (!isTyping) {
        e.preventDefault();
        if (this.internalClipboard) {
          if (this.internalClipboard.type === 'note-box') {
            this.pasteNoteBox(this.internalClipboard, this.mouseCanvasPos.x, this.mouseCanvasPos.y);
            return;
          } else if (this.internalClipboard.type === 'item') {
            this.pasteItemToNewBox(this.internalClipboard.html, this.mouseCanvasPos.x, this.mouseCanvasPos.y);
            return;
          }
        }

        // Fallback: system clipboard text
        navigator.clipboard?.readText?.().then(text => {
          if (text) {
            const newBox = this.app.createNoteBox(this.mouseCanvasPos.x, this.mouseCanvasPos.y);
            newBox.contentArea.innerHTML = '';
            newBox.addTextBlock(text);
          }
        }).catch(() => {});
        return;
      }

      // Case B: Typing inside a note box
      if (this.internalClipboard && this.internalClipboard.type === 'item') {
        e.preventDefault();
        this.pasteItemIntoActiveBox(this.internalClipboard.html);
        return;
      }

      // Otherwise allow native text paste
      return;
    }

    // =========================================================================
    // 7. Universal Delete: Delete Key
    // =========================================================================
    if (e.key === 'Delete') {
      // Tier 2: Item Selected (Image or Table)
      if (selectedItem) {
        e.preventDefault();
        const block = selectedItem.closest('.canvas-block');
        if (block) {
          block.remove();
        }
        return;
      }

      // Tier 3: Container Header Selected
      if (selectedBox && selectedBox.isSelected && !isTyping) {
        e.preventDefault();
        selectedBox.destroy();
        this.app.selectedNoteBox = null;
        return;
      }

      // Tier 1: Character deletion while typing (container is 100% immune)
      return;
    }

    // =========================================================================
    // 8. Immune Backspace (Prevents accidental container destruction)
    // =========================================================================
    if (e.key === 'Backspace' && isTyping) {
      const selection = window.getSelection();
      if (selection.isCollapsed && selection.anchorOffset === 0) {
        const currentBlock = selection.anchorNode?.parentElement?.closest('.canvas-block');
        if (currentBlock) {
          const prevBlock = currentBlock.previousElementSibling;
          if (!prevBlock && currentBlock.innerText.trim().length === 0) {
            const allBlocks = currentBlock.parentNode.querySelectorAll('.canvas-block');
            if (allBlocks.length > 1) {
              e.preventDefault();
              currentBlock.remove();
            } else {
              e.preventDefault();
            }
          }
        }
      }
    }
  }

  /**
   * Paste cloned Note Box from clipboard
   */
  pasteNoteBox(clipboardData, x, y) {
    const newBox = this.app.createNoteBox(x, y, clipboardData.width || 360);
    newBox.contentArea.innerHTML = clipboardData.html;
    this.rebindContainerElements(newBox);
    this.app.selectNoteBox(newBox);
  }

  /**
   * Paste single item as a brand new Note Box
   */
  pasteItemToNewBox(itemHtml, x, y) {
    const newBox = this.app.createNoteBox(x, y, 360);
    newBox.contentArea.innerHTML = itemHtml;
    this.rebindContainerElements(newBox);
    this.app.selectNoteBox(newBox);
  }

  /**
   * Paste single item directly into the active Note Box
   */
  pasteItemIntoActiveBox(itemHtml) {
    const targetBox = this.app.selectedNoteBox;
    if (!targetBox) return;

    const temp = document.createElement('div');
    temp.innerHTML = itemHtml;
    const block = temp.firstElementChild;
    if (block) {
      targetBox.contentArea.appendChild(block);
      this.rebindBlockElements(block, targetBox);
    }
  }

  /**
   * Reconnect all interactive handlers (grips, crop tools, tables) to newly pasted elements
   */
  rebindContainerElements(noteBox) {
    noteBox.contentArea.querySelectorAll('.canvas-block').forEach(block => {
      this.rebindBlockElements(block, noteBox);
    });
  }

  rebindBlockElements(block, noteBox) {
    this.app.flowEngine.attachGripDrag(block, noteBox);

    // Rebind table click
    const tableWrapper = block.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.image-card.active-selected, .table-wrapper.active-selected').forEach(el => el.classList.remove('active-selected'));
        tableWrapper.classList.add('active-selected');
      });
    }

    // Rebind image click & crop
    const img = block.querySelector('.image-container img');
    if (img) {
      img.draggable = false;
      img.addEventListener('dragstart', (e) => e.preventDefault());
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.image-card.active-selected, .table-wrapper.active-selected').forEach(el => el.classList.remove('active-selected'));
        block.querySelector('.image-card')?.classList.add('active-selected');
      });
      const cropBtn = block.querySelector('.image-tool-btn');
      if (cropBtn) {
        cropBtn.onclick = (e) => {
          e.stopPropagation();
          this.app.imageModule.openCropModal(img);
        };
      }
      const captionBtn = block.querySelector('.caption-toggle-btn');
      const card = block.querySelector('.image-card');
      if (captionBtn && card) {
        captionBtn.onclick = (e) => {
          e.stopPropagation();
          this.app.imageModule.toggleCaption(card, captionBtn);
        };
      }
      const removeBtn = block.querySelector('.caption-remove-btn');
      if (removeBtn && card) {
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          card.querySelector('.image-caption-wrapper')?.remove();
          if (captionBtn) captionBtn.textContent = '💬 + Caption';
          if (this.app.history) this.app.history.pushState('remove_caption');
        };
      }
    }
  }

  /**
   * Move block up or down inside container (Alt + Shift + Up/Down)
   */
  moveBlockUpDown(block, direction) {
    const parent = block.parentNode;
    if (!parent) return;

    if (direction === -1) {
      const prev = block.previousElementSibling;
      if (prev) {
        parent.insertBefore(block, prev);
        this.focusBlock(block);
      }
    } else {
      const next = block.nextElementSibling;
      if (next) {
        parent.insertBefore(next, block);
        this.focusBlock(block);
      }
    }
  }

  /**
   * Indent or outdent block
   */
  indentBlock(block, deltaPx) {
    const currentIndent = parseInt(block.style.marginLeft || '0', 10);
    const newIndent = Math.max(0, currentIndent + deltaPx);
    block.style.marginLeft = `${newIndent}px`;
  }

  focusBlock(block) {
    const editable = block.querySelector('[contenteditable="true"]') || block;
    editable.focus();
  }
}

// Export for modular usage
window.KeyboardController = KeyboardController;
