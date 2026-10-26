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

    // Left hover grip
    const grip = document.createElement('div');
    grip.className = 'block-grip';
    grip.title = 'Drag to rearrange or drag out to detach';
    grip.textContent = ':::';
    block.appendChild(grip);

    // Wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    // Toolbar with layout switcher and row/col actions
    const toolbar = document.createElement('div');
    toolbar.className = 'table-toolbar';

    // 4-Layout Format Dropdown
    const select = document.createElement('select');
    select.className = 'table-layout-select';
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

    select.addEventListener('change', () => {
      this.layouts.forEach(l => table.classList.remove(l.id));
      table.classList.add(select.value);
    });

    // Add Row Button
    const addRowBtn = document.createElement('button');
    addRowBtn.className = 'table-tool-btn';
    addRowBtn.textContent = '+ Row';
    addRowBtn.title = 'Insert row at bottom';
    addRowBtn.onclick = (e) => { e.preventDefault(); this.addRow(table); };

    // Add Column Button
    const addColBtn = document.createElement('button');
    addColBtn.className = 'table-tool-btn';
    addColBtn.textContent = '+ Col';
    addColBtn.title = 'Insert column on right';
    addColBtn.onclick = (e) => { e.preventDefault(); this.addColumn(table); };

    // Delete Table Button
    const delBtn = document.createElement('button');
    delBtn.className = 'table-tool-btn danger';
    delBtn.textContent = '×';
    delBtn.title = 'Delete Table';
    delBtn.onclick = (e) => {
      e.preventDefault();
      block.remove();
    };

    toolbar.appendChild(select);
    toolbar.appendChild(addRowBtn);
    toolbar.appendChild(addColBtn);
    toolbar.appendChild(delBtn);

    // Build Table Rows & Cells
    data.forEach((row, rIdx) => {
      const tr = document.createElement('tr');
      row.forEach(val => {
        const cell = rIdx === 0 ? document.createElement('th') : document.createElement('td');
        cell.contentEditable = 'true';
        cell.textContent = val || '';
        tr.appendChild(cell);
      });
      table.appendChild(tr);
    });

    wrapper.appendChild(toolbar);
    wrapper.appendChild(table);
    block.appendChild(wrapper);

    return block;
  }

  createTableFromDOM(domTable) {
    const rows = Array.from(domTable.querySelectorAll('tr'));
    const data = rows.map(tr => {
      return Array.from(tr.querySelectorAll('th, td')).map(cell => cell.innerText.trim());
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
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  addColumn(table) {
    Array.from(table.rows).forEach((tr, rIdx) => {
      const cell = rIdx === 0 ? document.createElement('th') : document.createElement('td');
      cell.contentEditable = 'true';
      cell.textContent = rIdx === 0 ? `Col ${tr.cells.length + 1}` : '';
      tr.appendChild(cell);
    });
  }
}

// Export for modular usage
window.TableModule = TableModule;
