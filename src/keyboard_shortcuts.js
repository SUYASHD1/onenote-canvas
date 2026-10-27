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
    window.addEventListener('paste', (e) => this.handleGlobalPaste(e));
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
    // =========================================================================
    // 4. Universal Copy: Ctrl + C
    // =========================================================================
    if (isModifierKey && (e.key === 'c' || e.key === 'C')) {
      const hasTextSelection = window.getSelection()?.toString()?.length > 0;
      if (hasTextSelection) {
        return; // Allow native text copy
      }

      // 1. Image Selected
      const selectedImg = document.querySelector('.image-card.active-selected');
      if (selectedImg) {
        e.preventDefault();
        const img = selectedImg.querySelector('img');
        const caption = selectedImg.querySelector('.image-caption')?.innerText;
        this.internalClipboard = {
          type: 'image',
          src: img?.src,
          caption: caption || ''
        };
        try { navigator.clipboard?.writeText?.(caption || '[Image]'); } catch (_) {}
        return;
      }

      // 2. Table Selected
      const selectedTable = document.querySelector('.table-wrapper.active-selected') || document.activeElement?.closest?.('.table-wrapper');
      if (selectedTable) {
        e.preventDefault();
        const table = selectedTable.querySelector('table');
        const rows = Array.from(table.rows).map(r => Array.from(r.cells).map(c => c.innerText.trim()));
        const layout = Array.from(table.classList).find(c => c.startsWith('layout-')) || 'layout-classic-grid';
        this.internalClipboard = {
          type: 'table',
          data: rows,
          layout: layout
        };
        try {
          const tsv = rows.map(r => r.join('\t')).join('\n');
          navigator.clipboard?.writeText?.(tsv);
        } catch (_) {}
        return;
      }

      // 3. Container Selected
      if (selectedBox && selectedBox.isSelected) {
        e.preventDefault();
        const summary = selectedBox.contentArea.innerText;
        this.internalClipboard = {
          type: 'note-box',
          width: selectedBox.width,
          html: selectedBox.contentArea.innerHTML,
          summaryText: summary
        };
        try { navigator.clipboard?.writeText?.(summary); } catch (_) {}
        return;
      }
    }

    // =========================================================================
    // 5. Universal Cut: Ctrl + X
    // =========================================================================
    if (isModifierKey && (e.key === 'x' || e.key === 'X')) {
      const hasTextSelection = window.getSelection()?.toString()?.length > 0;
      if (hasTextSelection) {
        return; // Allow native text cut
      }

      const selectedImg = document.querySelector('.image-card.active-selected');
      if (selectedImg) {
        e.preventDefault();
        const img = selectedImg.querySelector('img');
        const caption = selectedImg.querySelector('.image-caption')?.innerText;
        this.internalClipboard = {
          type: 'image',
          src: img?.src,
          caption: caption || ''
        };
        selectedImg.closest('.canvas-block')?.remove();
        if (this.app.history) this.app.history.pushState('cut_image');
        return;
      }

      const selectedTable = document.querySelector('.table-wrapper.active-selected');
      if (selectedTable) {
        e.preventDefault();
        const table = selectedTable.querySelector('table');
        const rows = Array.from(table.rows).map(r => Array.from(r.cells).map(c => c.innerText.trim()));
        const layout = Array.from(table.classList).find(c => c.startsWith('layout-')) || 'layout-classic-grid';
        this.internalClipboard = {
          type: 'table',
          data: rows,
          layout: layout
        };
        selectedTable.closest('.canvas-block')?.remove();
        if (this.app.history) this.app.history.pushState('cut_table');
        return;
      }

      if (selectedBox && selectedBox.isSelected) {
        e.preventDefault();
        this.internalClipboard = {
          type: 'note-box',
          width: selectedBox.width,
          html: selectedBox.contentArea.innerHTML,
          summaryText: selectedBox.contentArea.innerText
        };
        selectedBox.destroy();
        this.app.selectedNoteBox = null;
        if (this.app.history) this.app.history.pushState('cut_box');
        return;
      }
    }

    // =========================================================================
    // 6. Universal Paste Shortcut: Ctrl + V (Works on canvas & inside notes)
    // =========================================================================
    if (isModifierKey && (e.key === 'v' || e.key === 'V')) {
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (!isInput && this.internalClipboard) {
        e.preventDefault();
        this.pasteInternalClipboard();
        return;
      }
    }

    // =========================================================================
    // 7. Universal Delete: Delete Key
    // =========================================================================
    if (e.key === 'Delete') {
      if (selectedItem) {
        e.preventDefault();
        const block = selectedItem.closest('.canvas-block');
        if (block) block.remove();
        return;
      }

      if (selectedBox && selectedBox.isSelected && !isTyping) {
        e.preventDefault();
        selectedBox.destroy();
        this.app.selectedNoteBox = null;
        return;
      }
    }

    // =========================================================================
    // 8. Insert Math Equation: Alt + = (Standard OneNote Equation shortcut)
    // =========================================================================
    if (e.altKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      const btnMath = document.getElementById('btn-insert-math');
      if (btnMath) btnMath.click();
      return;
    }

    // =========================================================================
    // 9. Immune Backspace (Prevents accidental container destruction)
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
   * Helper: Find target table cell if active
   */
  getTargetCell() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const node = sel.getRangeAt(0).startContainer;
      const cell = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest('td, th');
      if (cell) return cell;
    }
    const activeEl = document.activeElement;
    if (activeEl && activeEl.closest('td, th')) {
      return activeEl.closest('td, th');
    }
    if (this.app.tableModule && this.app.tableModule.lastFocusedCell) {
      if (document.contains(this.app.tableModule.lastFocusedCell)) {
        return this.app.tableModule.lastFocusedCell;
      }
    }
    return null;
  }

  /**
   * Universal Internal Clipboard Paste Router
   */
  pasteInternalClipboard() {
    if (!this.internalClipboard) return;

    const targetCell = this.getTargetCell();
    if (targetCell) {
      if (this.internalClipboard.type === 'image') {
        this.app.tableModule.insertImageIntoCell(targetCell, this.internalClipboard.src);
        return;
      }
      if (this.internalClipboard.type === 'table') {
        targetCell.innerText = this.internalClipboard.data.map(r => r.join(' | ')).join('\n');
        return;
      }
    }

    // Target 2: Active Note Box
    if (this.app.selectedNoteBox && !this.app.selectedNoteBox.isSelected) {
      const box = this.app.selectedNoteBox;
      if (this.internalClipboard.type === 'image') {
        const block = this.app.imageModule.createImageBlock(this.internalClipboard.src, this.internalClipboard.caption);
        box.contentArea.appendChild(block);
        this.app.flowEngine.attachGripDrag(block, box);
        if (this.app.history) this.app.history.pushState('paste_image');
        return;
      }
      if (this.internalClipboard.type === 'table') {
        const block = this.app.tableModule.createTableFromData(this.internalClipboard.data, this.internalClipboard.layout);
        box.contentArea.appendChild(block);
        this.app.flowEngine.attachGripDrag(block, box);
        if (this.app.history) this.app.history.pushState('paste_table');
        return;
      }
    }

    // Target 3: Blank Canvas at mouse position
    const posX = Math.round(this.mouseCanvasPos.x || 320);
    const posY = Math.round(this.mouseCanvasPos.y || 220);

    if (this.internalClipboard.type === 'image') {
      const newBox = this.app.createNoteBox(posX, posY, 380);
      newBox.contentArea.innerHTML = '';
      const block = this.app.imageModule.createImageBlock(this.internalClipboard.src, this.internalClipboard.caption);
      newBox.contentArea.appendChild(block);
      this.app.flowEngine.attachGripDrag(block, newBox);
      this.app.selectNoteBox(newBox);
      if (this.app.history) this.app.history.pushState('paste_image');
      return;
    }

    if (this.internalClipboard.type === 'table') {
      const newBox = this.app.createNoteBox(posX, posY, 440);
      newBox.contentArea.innerHTML = '';
      const block = this.app.tableModule.createTableFromData(this.internalClipboard.data, this.internalClipboard.layout);
      newBox.contentArea.appendChild(block);
      this.app.flowEngine.attachGripDrag(block, newBox);
      this.app.selectNoteBox(newBox);
      if (this.app.history) this.app.history.pushState('paste_table');
      return;
    }

    if (this.internalClipboard.type === 'note-box') {
      const newBox = this.app.createNoteBox(posX, posY, this.internalClipboard.width || 360);
      newBox.contentArea.innerHTML = this.internalClipboard.html;
      this.rebindContainerElements(newBox);
      this.app.selectNoteBox(newBox);
      if (this.app.history) this.app.history.pushState('paste_box');
      return;
    }
  }

  /**
   * Universal Native Clipboard Event Handler (external images, HTML tables, plain text)
   */
  handleGlobalPaste(e) {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const targetCell = this.getTargetCell();
    const activeEl = document.activeElement;
    const isTyping = (activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'));

    // 1. External Image (Snipping tool screenshot, web image)
    const items = clipboardData.items || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            if (targetCell) {
              this.app.tableModule.insertImageIntoCell(targetCell, dataUrl);
            } else if (isTyping && this.app.selectedNoteBox) {
              const imgBlock = this.app.imageModule.createImageBlock(dataUrl, null);
              this.app.selectedNoteBox.contentArea.appendChild(imgBlock);
              this.app.flowEngine.attachGripDrag(imgBlock, this.app.selectedNoteBox);
            } else {
              const newBox = this.app.createNoteBox(this.mouseCanvasPos.x, this.mouseCanvasPos.y, 380);
              newBox.contentArea.innerHTML = '';
              const imgBlock = this.app.imageModule.createImageBlock(dataUrl, null);
              newBox.contentArea.appendChild(imgBlock);
              this.app.flowEngine.attachGripDrag(imgBlock, newBox);
            }
            if (this.app.history) this.app.history.pushState('paste_image');
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }

    const textData = clipboardData.getData('text/plain') || '';
    const htmlData = clipboardData.getData('text/html') || '';

    // 2. If internal clipboard has pending item, paste it directly
    if (this.internalClipboard && (!textData || this.internalClipboard.summaryText === textData)) {
      e.preventDefault();
      this.pasteInternalClipboard();
      return;
    }

    // 3. Sequential Universal Paste Pipeline (Preserves 100% natural reading order)
    let units = null;
    let pasteSourceType = 'rich';

    const hasRichHTML = htmlData && (
      htmlData.includes('<img') || htmlData.includes('<figure') || htmlData.includes('<table') || 
      htmlData.includes('<a') || htmlData.includes('<sup') || htmlData.includes('class="reference"') ||
      htmlData.includes('<h1') || htmlData.includes('<h2') || htmlData.includes('<h3') || 
      htmlData.includes('<ul') || htmlData.includes('<ol') || htmlData.includes('<pre') || htmlData.includes('<blockquote')
    );

    // If htmlData is available and contains rich layout (from web or browser mouse copy of AI chats),
    // htmlData preserves the authentic top-to-bottom sequence of headings, text, pictures, and tables!
    if (hasRichHTML) {
      if (targetCell) {
        const doc = new DOMParser().parseFromString(htmlData, 'text/html');
        const firstImg = doc.querySelector('img');
        if (firstImg) {
          let src = firstImg.getAttribute('src');
          if (src && src.startsWith('//')) src = 'https:' + src;
          if (src) {
            e.preventDefault();
            this.app.tableModule.insertImageIntoCell(targetCell, src);
            if (this.app.history) this.app.history.pushState('paste_image');
            return;
          }
        }
      }

      units = this.app.parseHTMLToOutlineUnits(htmlData);
      pasteSourceType = 'web_html';
    } else if (this.app.markdownModule && this.app.markdownModule.isMarkdown(textData)) {
      // If htmlData is absent (e.g. user clicked ChatGPT/Claude "Copy" button which outputs raw Markdown),
      // parse textData line-by-line in exact sequential order!
      if (targetCell) {
        const imgInfo = this.app.markdownModule.extractImageFromText(textData);
        if (imgInfo) {
          e.preventDefault();
          this.app.tableModule.insertImageIntoCell(targetCell, imgInfo.src);
          if (this.app.history) this.app.history.pushState('paste_image');
          return;
        }
      }

      units = this.app.parseMarkdownToOutlineUnits(textData);
      pasteSourceType = 'ai_markdown';
    }

    if (units && units.length > 0) {
      e.preventDefault();

      // If user is actively typing inside an existing text block and pastes a single clean text snippet
      if (isTyping && activeEl && activeEl.isContentEditable && units.length === 1 && units[0].type === 'text') {
        document.execCommand('insertHTML', false, units[0].content);
        if (this.app.history) this.app.history.debouncePush('paste_text');
        return;
      }

      let targetBox = this.app.selectedNoteBox || (activeEl ? this.app.findNoteBox(activeEl.closest('.note-box')?.dataset?.boxId) : null);
      let anchorBlock = null;

      if (isTyping && targetBox) {
        const selection = window.getSelection();
        anchorBlock = selection.anchorNode?.parentElement?.closest('.canvas-block') || activeEl.closest('.canvas-block');
      } else {
        // Canvas paste: spawn new NoteBox at mouse position
        targetBox = this.app.createNoteBox(this.mouseCanvasPos.x, this.mouseCanvasPos.y, 480);
        targetBox.contentArea.innerHTML = '';
      }

      this.app.insertOutlineUnits(units, targetBox, anchorBlock);
      this.app.selectNoteBox(targetBox);
      if (this.app.history) this.app.history.pushState(pasteSourceType === 'ai_markdown' ? 'paste_ai_markdown' : 'paste_rich_content');
      return;
    }

    // 4. Pasting onto Canvas when NOT typing (outside HTML table or plain text)
    if (!isTyping) {
      if (htmlData && htmlData.includes('<table')) {
        e.preventDefault();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');
        const domTable = doc.querySelector('table');
        if (domTable) {
          const newBox = this.app.createNoteBox(this.mouseCanvasPos.x, this.mouseCanvasPos.y, 440);
          newBox.contentArea.innerHTML = '';
          const tableBlock = this.app.tableModule.createTableFromDOM(domTable);
          newBox.contentArea.appendChild(tableBlock);
          this.app.flowEngine.attachGripDrag(tableBlock, newBox);
          if (this.app.history) this.app.history.pushState('paste_table');
          return;
        }
      }

      if (textData.trim().length > 0) {
        e.preventDefault();
        const newBox = this.app.createNoteBox(this.mouseCanvasPos.x, this.mouseCanvasPos.y);
        newBox.contentArea.innerHTML = '';
        const lines = textData.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
        lines.forEach(line => newBox.addTextBlock(line));
        if (lines.length === 0) newBox.addTextBlock(textData);
        if (this.app.history) this.app.history.pushState('paste_outside_text');
        return;
      }
    }

    // 5. If typing inside a note box:
    // Native paste handles plain text insertion cleanly!
    if (this.app.history) {
      this.app.history.debouncePush('paste_text');
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
   * Reconnect interactive handlers to cloned note container
   */
  rebindContainerElements(noteBox) {
    noteBox.contentArea.querySelectorAll('.canvas-block').forEach(block => {
      this.rebindBlockElements(block, noteBox);
    });
  }

  rebindBlockElements(block, noteBox) {
    this.app.flowEngine.attachGripDrag(block, noteBox);

    const tableWrapper = block.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.selectObject(tableWrapper, 'table');
      });
    }

    const card = block.querySelector('.image-card');
    const img = block.querySelector('.image-container img');
    if (img && card) {
      img.draggable = false;
      img.addEventListener('dragstart', (e) => e.preventDefault());
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.selectObject(card, 'image');
      });
      const cropBtn = block.querySelector('.image-tool-btn');
      if (cropBtn) {
        cropBtn.onclick = (e) => {
          e.stopPropagation();
          this.app.imageModule.openCropModal(img);
        };
      }
      const captionBtn = block.querySelector('.caption-toggle-btn');
      if (captionBtn) {
        captionBtn.onclick = (e) => {
          e.stopPropagation();
          this.app.imageModule.toggleCaption(card, captionBtn);
        };
      }
      const removeBtn = block.querySelector('.caption-remove-btn');
      if (removeBtn) {
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
