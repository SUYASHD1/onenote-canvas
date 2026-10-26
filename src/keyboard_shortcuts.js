/**
 * OneNote Spatial Canvas — 3-Tier Keyboard Shortcut Engine
 * 
 * Responsibilities:
 * - Tier 1: Typing text (letters delete only, container is 100% immune to deletion).
 * - Tier 2: Item Selected (table or image highlighted -> Delete removes only that item).
 * - Tier 3: Container Selected (header clicked -> Delete removes container).
 * - Outline navigation: Alt+Shift+Up/Down (reorder), Tab/Shift+Tab (indent).
 * - Ctrl+A selection ladder: Line -> Container Content -> Whole Container.
 * - Ctrl+V on canvas: spawns new note box at mouse position.
 */

class KeyboardController {
  constructor(app) {
    this.app = app;
    this.ctrlACounter = 0;
    this.lastSelection = null;
    this.mouseCanvasPos = { x: 200, y: 150 };

    this.bindEvents();
  }

  bindEvents() {
    // Track mouse position on canvas for Ctrl+V paste positioning
    window.addEventListener('mousemove', (e) => {
      this.mouseCanvasPos = this.app.canvas.clientToCanvas(e.clientX, e.clientY);
    });

    // Reset Ctrl+A ladder when clicking
    window.addEventListener('mousedown', () => {
      this.ctrlACounter = 0;
    });

    window.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
  }

  handleGlobalKeyDown(e) {
    const activeEl = document.activeElement;
    const isTyping = (activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) ||
                     (e.target && (e.target.isContentEditable || e.target.closest?.('[contenteditable="true"]')));
    const selectedBox = this.app.selectedNoteBox;

    // Outline shortcut: Alt + Shift + Up / Down (Move block up or down)
    if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const selection = window.getSelection();
      const block = selection.anchorNode?.parentElement?.closest('.canvas-block');
      if (block) {
        e.preventDefault();
        this.moveBlockUpDown(block, e.key === 'ArrowUp' ? -1 : 1);
        return;
      }
    }

    // Outline shortcut: Tab / Shift + Tab for indentation (when not creating a table)
    if (e.key === 'Tab' && isTyping) {
      const selection = window.getSelection();
      const block = selection.anchorNode?.parentElement?.closest('.canvas-block');
      // If block is a text or todo block, adjust indentation
      if (block && !block.closest('.table-wrapper')) {
        const text = block.innerText.trim();
        if (text.length === 0 || e.shiftKey) {
          e.preventDefault();
          this.indentBlock(block, e.shiftKey ? -24 : 24);
          return;
        }
      }
    }

    // Ctrl + A ladder (Line -> Container Content -> Entire Container)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      if (isTyping) {
        this.ctrlACounter++;
        if (this.ctrlACounter === 1) {
          // Select current line/block
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
          // Select entire container content
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
          // Select entire container (Tier 3)
          if (selectedBox) {
            e.preventDefault();
            selectedBox.setSelected(true);
            document.activeElement.blur();
            return;
          }
        }
      }
    }

    // Tier 3: Delete key when container header is selected
    if (e.key === 'Delete' && !isTyping) {
      if (selectedBox && selectedBox.isSelected) {
        e.preventDefault();
        selectedBox.destroy();
        this.app.selectedNoteBox = null;
        return;
      }
    }

    // Tier 1: Typing text -> prevent backspace from accidentally destroying container
    if (e.key === 'Backspace' && isTyping) {
      const selection = window.getSelection();
      if (selection.isCollapsed && selection.anchorOffset === 0) {
        const currentBlock = selection.anchorNode?.parentElement?.closest('.canvas-block');
        if (currentBlock) {
          const prevBlock = currentBlock.previousElementSibling;
          // If at start of first block, do not delete container
          if (!prevBlock && currentBlock.innerText.trim().length === 0) {
            const allBlocks = currentBlock.parentNode.querySelectorAll('.canvas-block');
            if (allBlocks.length > 1) {
              e.preventDefault();
              currentBlock.remove();
            } else {
              // Only 1 empty block left: keep container intact with empty prompt
              e.preventDefault();
            }
          }
        }
      }
    }

    // Ctrl + V when clicking empty canvas: paste new note box at mouse position
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      if (!isTyping) {
        navigator.clipboard?.readText?.().then(text => {
          if (text) {
            const newBox = this.app.createNoteBox(this.mouseCanvasPos.x, this.mouseCanvasPos.y);
            newBox.contentArea.innerHTML = '';
            newBox.addTextBlock(text);
          }
        }).catch(() => {});
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
