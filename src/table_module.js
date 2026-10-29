/**
 * OneNote Spatial Canvas — Table & Auto-Detection Module
 * 
 * Responsibilities:
 * - Auto-detects table intent: typing a word + pressing Tab turns it into a table!
 * - Auto-detects pasted tabular/spreadsheet data (TSV, CSV, or HTML tables).
 * - Up to 4 distinct visual layout formats (Classic Grid, Zebra Banded, Modern Accent, Compact Matrix).
 * - Inline controls for adding rows, columns, and layout switching.
 */

class TableModule {
  constructor(app) {
    this.app = app;
    this.lastFocusedCell = null;
    this.layouts = [
      { id: 'layout-classic-grid', name: 'Classic Grid' },
      { id: 'layout-zebra-banded', name: 'Zebra Banded' },
      { id: 'layout-modern-accent', name: 'Modern Accent' },
      { id: 'layout-compact-matrix', name: 'Compact Matrix' }
    ];
  }

  /**
   * Check if keyboard event is a Table Trigger: word + Tab key
   */
  handleKeyDown(e, blockEl) {
    if (e.key === 'Tab' && !e.shiftKey) {
      // If cursor is inside a normal text block and user pressed Tab
      if (blockEl && !blockEl.closest('.table-wrapper')) {
        const text = blockEl.innerText.trim();
        // If there's text on this line, convert to table!
        if (text.length > 0) {
          e.preventDefault();
          this.convertBlockToTable(blockEl, text);
          return true;
        }
      }

      // If cursor is inside an existing table cell
      const td = document.getSelection().anchorNode?.parentElement?.closest('td, th');
      if (td) {
        const table = td.closest('table');
        const allCells = Array.from(table.querySelectorAll('td, th'));
        const idx = allCells.indexOf(td);
        if (idx === allCells.length - 1) {
          // Tab on last cell -> append new row!
          e.preventDefault();
          this.addRow(table);
          const newCells = table.querySelectorAll('td');
          newCells[newCells.length - table.rows[0].cells.length]?.focus();
          return true;
        }
      }
    }

    // Enter inside table cell -> moves to next row or adds row
    if (e.key === 'Enter' && !e.shiftKey) {
      const td = document.getSelection().anchorNode?.parentElement?.closest('td, th');
      if (td) {
        const tr = td.closest('tr');
        const table = td.closest('table');
        if (tr === table.rows[table.rows.length - 1]) {
          e.preventDefault();
          this.addRow(table);
          const cellIndex = td.cellIndex;
          const nextRow = table.rows[table.rows.length - 1];
          nextRow.cells[cellIndex]?.focus();
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Handle pasting tabular data (Excel, Google Sheets, TSV, CSV)
   */
  handlePaste(e, targetBlock) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return false;

    const htmlData = clipboardData.getData('text/html');
    const textData = clipboardData.getData('text/plain');

    // Case 1: Copied HTML Table
    if (htmlData && htmlData.includes('<table')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlData, 'text/html');
      const pastedTable = doc.querySelector('table');
      if (pastedTable) {
        e.preventDefault();
        const wrapper = this.createTableFromDOM(pastedTable);
        this.insertTableWrapper(wrapper, targetBlock);
        return true;
      }
    }

    // Case 2: Plain text with Tabs or CSV
    if (textData && (textData.includes('\t') || (textData.includes(',') && textData.includes('\n')))) {
      const rows = textData.trim().split(/\r?\n/).map(r => textData.includes('\t') ? r.split('\t') : r.split(','));
      if (rows.length >= 1 && rows[0].length >= 2) {
        e.preventDefault();
        const wrapper = this.createTableFromData(rows);
        this.insertTableWrapper(wrapper, targetBlock);
        return true;
      }
    }

    return false;
  }

  /**
   * Convert a single text block into a 2-column table
   */
  convertBlockToTable(blockEl, initialText) {
    const data = [
      [initialText, ''],
      ['', '']
    ];
    const wrapper = this.createTableFromData(data, 'layout-classic-grid');
    blockEl.parentNode.replaceChild(wrapper, blockEl);
    
    // Focus the second cell
    const secondCell = wrapper.querySelectorAll('td')[1];
    if (secondCell) {
      secondCell.focus();
    }
  }

  /**
   * Insert table wrapper replacing or after target block
   */
  insertTableWrapper(wrapper, targetBlock) {
    if (targetBlock && targetBlock.parentNode) {
      targetBlock.parentNode.insertBefore(wrapper, targetBlock.nextSibling);
    }
  }

  /**
   * Create a structured table wrapper with toolbar and layout switcher
   */
  createTableElement(rows = 3, cols = 3, layoutClass = 'layout-classic-grid') {
    const data = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(r === 0 ? `Header ${c + 1}` : `Item ${r},${c + 1}`);
      }
      data.push(row);
    }
    return this.createTableFromData(data, layoutClass);
  }

  /**
   * Build complete table block DOM element from 2D data array
   */
  createTableFromData(data, layoutClass = 'layout-classic-grid') {
    const block = document.createElement('div');
    block.className = 'canvas-block table-block';
    block.dataset.blockType = 'table';
    block.contentEditable = 'false';

    // Left hover grip
    const grip = document.createElement('div');
    grip.className = 'block-grip';
    grip.contentEditable = 'false';
    grip.title = 'Drag to rearrange or drag out to detach';
    grip.textContent = ':::';
    block.appendChild(grip);

    // Wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.contentEditable = 'false';
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      this.app.selectObject(wrapper, 'table');
    });

    // Toolbar with layout switcher and row/col actions
    const toolbar = document.createElement('div');
    toolbar.className = 'table-toolbar';
    toolbar.contentEditable = 'false';

    // 4-Layout Format Dropdown
    const select = document.createElement('select');
    select.className = 'table-layout-select';
    select.contentEditable = 'false';
    select.title = 'Change Table Layout Style';
    this.layouts.forEach(layout => {
      const opt = document.createElement('option');
      opt.value = layout.id;
      opt.textContent = layout.name;
      if (layout.id === layoutClass) opt.selected = true;
      select.appendChild(opt);
    });

    const table = document.createElement('table');
    table.className = `canvas-table ${layoutClass}`;
    table.contentEditable = 'false';

    select.addEventListener('change', () => {
      this.layouts.forEach(l => table.classList.remove(l.id));
      table.classList.add(select.value);
    });

    // Add Row Button
    const addRowBtn = document.createElement('button');
    addRowBtn.className = 'table-tool-btn';
    addRowBtn.contentEditable = 'false';
    addRowBtn.textContent = '+ Row';
    addRowBtn.title = 'Insert row at bottom';
    addRowBtn.onclick = (e) => { e.preventDefault(); this.addRow(table); };

    // Remove Row Button
    const delRowBtn = document.createElement('button');
    delRowBtn.className = 'table-tool-btn danger';
    delRowBtn.contentEditable = 'false';
    delRowBtn.textContent = '- Row';
    delRowBtn.title = 'Remove selected or bottom row';
    delRowBtn.onclick = (e) => { e.preventDefault(); this.removeRow(table); };

    // Add Column Button
    const addColBtn = document.createElement('button');
    addColBtn.className = 'table-tool-btn';
    addColBtn.contentEditable = 'false';
    addColBtn.textContent = '+ Col';
    addColBtn.title = 'Insert column on right';
    addColBtn.onclick = (e) => { e.preventDefault(); this.addColumn(table); };

    // Remove Column Button
    const delColBtn = document.createElement('button');
    delColBtn.className = 'table-tool-btn danger';
    delColBtn.contentEditable = 'false';
    delColBtn.textContent = '- Col';
    delColBtn.title = 'Remove selected or rightmost column';
    delColBtn.onclick = (e) => { e.preventDefault(); this.removeColumn(table); };

    // Delete Table Button
    const delBtn = document.createElement('button');
    delBtn.className = 'table-tool-btn danger';
    delBtn.contentEditable = 'false';
    delBtn.textContent = '× Table';
    delBtn.title = 'Delete Entire Table';
    delBtn.onclick = (e) => {
      e.preventDefault();
      block.remove();
    };

    toolbar.appendChild(select);
    toolbar.appendChild(addRowBtn);
    toolbar.appendChild(delRowBtn);
    toolbar.appendChild(addColBtn);
    toolbar.appendChild(delColBtn);
    toolbar.appendChild(delBtn);

    // Build Table Rows & Cells
    data.forEach((row, rIdx) => {
      const tr = document.createElement('tr');
      row.forEach(val => {
        const cell = rIdx === 0 ? document.createElement('th') : document.createElement('td');
        cell.contentEditable = 'true';
        cell.textContent = val || '';
        cell.addEventListener('focus', () => {
          this.lastFocusedCell = cell;
        });
        this.attachCellResizers(cell, table);
        tr.appendChild(cell);
      });
      table.appendChild(tr);
    });

    wrapper.appendChild(toolbar);
    wrapper.appendChild(table);

    // Universal 8-Point Perimeter Resize Handles for the entire table
    this.app.attachUniversalBoundaryHandles(
      wrapper,
      (pos, dx, dy, startW, startH) => {
        let newW = startW;
        if (pos.includes('e')) newW = Math.max(160, startW + dx);
        if (pos.includes('w')) newW = Math.max(160, startW - dx);
        if (pos === 'se' || pos === 'sw' || pos === 'ne' || pos === 'nw') {
          const scale = Math.max(0.3, (startW + dx) / startW);
          newW = Math.max(160, startW * scale);
        }
        table.style.width = `${Math.round(newW)}px`;

        if (pos.includes('s')) {
          const rowCount = table.rows.length;
          const targetTotalH = Math.max(rowCount * 24, startH + dy);
          const perRowH = Math.max(24, Math.round(targetTotalH / rowCount));
          Array.from(table.rows).forEach(tr => {
            tr.style.height = `${perRowH}px`;
          });
        }
      },
      () => {
        if (this.app.history) this.app.history.pushState('resize_table');
      }
    );

    block.appendChild(wrapper);

    return block;
  }

  createTableFromDOM(domTable) {
    const rows = Array.from(domTable.querySelectorAll('tr'));
    const data = rows.map(tr => {
      return Array.from(tr.querySelectorAll('th, td')).map(cell => (cell.textContent || cell.innerText || '').trim());
    });
    return this.createTableFromData(data);
  }

  addRow(table) {
    const colCount = table.rows[0] ? table.rows[0].cells.length : 2;
    const tr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.textContent = '';
      td.addEventListener('focus', () => {
        this.lastFocusedCell = td;
      });
      this.attachCellResizers(td, table);
      tr.appendChild(td);
    }
    table.appendChild(tr);
    if (this.app && this.app.history) this.app.history.pushState('add_table_row');
  }

  removeRow(table) {
    if (table.rows.length <= 1) return; // Keep at least 1 row
    let targetTr = null;
    if (this.lastFocusedCell && table.contains(this.lastFocusedCell)) {
      targetTr = this.lastFocusedCell.closest('tr');
    }
    if (!targetTr || !table.contains(targetTr)) {
      targetTr = table.rows[table.rows.length - 1];
    }
    if (targetTr) {
      targetTr.remove();
      this.lastFocusedCell = null;
      if (this.app && this.app.history) this.app.history.pushState('remove_table_row');
    }
  }

  addColumn(table) {
    Array.from(table.rows).forEach((tr, rIdx) => {
      const cell = rIdx === 0 ? document.createElement('th') : document.createElement('td');
      cell.contentEditable = 'true';
      cell.textContent = rIdx === 0 ? `Col ${tr.cells.length + 1}` : '';
      cell.addEventListener('focus', () => {
        this.lastFocusedCell = cell;
      });
      this.attachCellResizers(cell, table);
      tr.appendChild(cell);
    });
    if (this.app && this.app.history) this.app.history.pushState('add_table_col');
  }

  removeColumn(table) {
    if (!table.rows[0] || table.rows[0].cells.length <= 1) return; // Keep at least 1 col
    let targetColIdx = -1;
    if (this.lastFocusedCell && table.contains(this.lastFocusedCell)) {
      targetColIdx = this.lastFocusedCell.cellIndex;
    }
    if (targetColIdx < 0 || targetColIdx >= table.rows[0].cells.length) {
      targetColIdx = table.rows[0].cells.length - 1;
    }
    Array.from(table.rows).forEach(tr => {
      if (tr.cells[targetColIdx]) {
        tr.cells[targetColIdx].remove();
      }
    });
    this.lastFocusedCell = null;
    if (this.app && this.app.history) this.app.history.pushState('remove_table_col');
  }

  /**
   * Attach interactive column width & row height drag resizers to cell
   */
  attachCellResizers(cell, table) {
    // 1. Column Width Resizer (Right edge)
    const colResizer = document.createElement('div');
    colResizer.className = 'col-resizer';
    colResizer.contentEditable = 'false';
    colResizer.title = 'Drag to adjust column width';
    colResizer.style.touchAction = 'none';

    const onColResizeStart = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (e.pointerId !== undefined && colResizer.setPointerCapture) {
        try { colResizer.setPointerCapture(e.pointerId); } catch (_) {}
      }
      colResizer.classList.add('resizing');
      const startX = e.clientX;
      const startW = cell.offsetWidth;
      const colIdx = cell.cellIndex;

      const onColMouseMove = (ev) => {
        const dx = ev.clientX - startX;
        const newW = Math.max(45, startW + dx);
        Array.from(table.rows).forEach(r => {
          if (r.cells[colIdx]) {
            r.cells[colIdx].style.width = `${newW}px`;
            r.cells[colIdx].style.minWidth = `${newW}px`;
          }
        });
      };

      const onColMouseUp = (ev) => {
        if (ev && ev.pointerId !== undefined && colResizer.releasePointerCapture) {
          try { colResizer.releasePointerCapture(ev.pointerId); } catch (_) {}
        }
        window.removeEventListener('mousemove', onColMouseMove);
        window.removeEventListener('mouseup', onColMouseUp);
        window.removeEventListener('pointermove', onColMouseMove);
        window.removeEventListener('pointerup', onColMouseUp);
        window.removeEventListener('pointercancel', onColMouseUp);
        colResizer.classList.remove('resizing');
        if (this.app && this.app.history) {
          this.app.history.pushState('resize_table_col');
        }
      };

      window.addEventListener('mousemove', onColMouseMove);
      window.addEventListener('mouseup', onColMouseUp);
      window.addEventListener('pointermove', onColMouseMove);
      window.addEventListener('pointerup', onColMouseUp);
      window.addEventListener('pointercancel', onColMouseUp);
    };

    colResizer.addEventListener('pointerdown', onColResizeStart);
    colResizer.addEventListener('mousedown', onColResizeStart);

    // 2. Row Height Resizer (Bottom edge)
    const rowResizer = document.createElement('div');
    rowResizer.className = 'row-resizer';
    rowResizer.contentEditable = 'false';
    rowResizer.title = 'Drag to adjust row height';
    rowResizer.style.touchAction = 'none';

    const onRowResizeStart = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (e.pointerId !== undefined && rowResizer.setPointerCapture) {
        try { rowResizer.setPointerCapture(e.pointerId); } catch (_) {}
      }
      rowResizer.classList.add('resizing');
      const startY = e.clientY;
      const tr = cell.closest('tr');
      const startH = tr.offsetHeight;

      const onRowMouseMove = (ev) => {
        const dy = ev.clientY - startY;
        const newH = Math.max(26, startH + dy);
        tr.style.height = `${newH}px`;
        Array.from(tr.cells).forEach(c => {
          c.style.height = `${newH}px`;
        });
      };

      const onRowMouseUp = (ev) => {
        if (ev && ev.pointerId !== undefined && rowResizer.releasePointerCapture) {
          try { rowResizer.releasePointerCapture(ev.pointerId); } catch (_) {}
        }
        window.removeEventListener('mousemove', onRowMouseMove);
        window.removeEventListener('mouseup', onRowMouseUp);
        window.removeEventListener('pointermove', onRowMouseMove);
        window.removeEventListener('pointerup', onRowMouseUp);
        window.removeEventListener('pointercancel', onRowMouseUp);
        rowResizer.classList.remove('resizing');
        if (this.app && this.app.history) {
          this.app.history.pushState('resize_table_row');
        }
      };

      window.addEventListener('mousemove', onRowMouseMove);
      window.addEventListener('mouseup', onRowMouseUp);
      window.addEventListener('pointermove', onRowMouseMove);
      window.addEventListener('pointerup', onRowMouseUp);
      window.addEventListener('pointercancel', onRowMouseUp);
    };

    rowResizer.addEventListener('pointerdown', onRowResizeStart);
    rowResizer.addEventListener('mousedown', onRowResizeStart);

    cell.appendChild(colResizer);
    cell.appendChild(rowResizer);
  }

  /**
   * Insert an image directly into a specific table cell
   */
  insertImageIntoCell(cell, imageSrc) {
    if (!cell) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'cell-image-wrapper';
    wrapper.contentEditable = 'false';

    const img = document.createElement('img');
    img.src = imageSrc;
    img.draggable = false;
    img.alt = 'Table cell image';

    const delBtn = document.createElement('button');
    delBtn.className = 'cell-image-del-btn';
    delBtn.contentEditable = 'false';
    delBtn.title = 'Remove Image';
    delBtn.innerHTML = '×';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      wrapper.remove();
      if (this.app && this.app.history) this.app.history.pushState('remove_cell_image');
    };

    wrapper.appendChild(img);
    wrapper.appendChild(delBtn);

    // If cell contains only default placeholder text or spaces, clear it
    if (!cell.textContent.trim()) {
      cell.innerHTML = '';
    }
    cell.appendChild(wrapper);

    // Append trailing space so typing after image remains effortless
    const spacer = document.createTextNode(' ');
    cell.appendChild(spacer);

    if (this.app && this.app.history) {
      this.app.history.pushState('insert_cell_image');
    }
    return wrapper;
  }
}

// Export for modular usage
window.TableModule = TableModule;
