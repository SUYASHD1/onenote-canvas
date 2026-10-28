/**
 * OneNote Spatial Canvas — Smart Ribbon & Color Intelligence Controller
 * 
 * Responsibilities:
 * - "Two-Way Mirror": inspects computed style under cursor in real time.
 * - Auto-updates Bold, Italic, Underline, Strikethrough, Heading, Font Size, and Font Family.
 * - 2-in-1 Split Color & Highlighter buttons with illuminated status indicators.
 * - Selection Lock: snapshots and restores text range so formatting never drops selection.
 * - Theme-adaptive high-contrast color swatches.
 */

class RibbonController {
  constructor(app) {
    this.app = app;
    this.savedRange = null;
    this.activeFontColor = '#242424';
    this.activeHighlightColor = '#fff59d';

    // Curated high-contrast Font Color Palette
    this.fontColors = [
      { name: 'Pitch Black', value: '#111111' },
      { name: 'Charcoal Gray', value: '#505050' },
      { name: 'OneNote Purple', value: '#7719aa' },
      { name: 'Royal Blue', value: '#0078d4' },
      { name: 'Teal Blue', value: '#008272' },
      { name: 'Emerald Green', value: '#107c41' },
      { name: 'Coral Red', value: '#d13438' },
      { name: 'Dark Orange', value: '#d83b01' },
      { name: 'Berry Magenta', value: '#b4009e' },
      { name: 'Gold Bronze', value: '#8f7034' }
    ];

    // Authentic OneNote Chisel Highlighter Palette
    this.highlightColors = [
      { name: 'Bright Yellow', value: '#fff59d' },
      { name: 'Pastel Green', value: '#c8e6c9' },
      { name: 'Sky Cyan', value: '#b3e5fc' },
      { name: 'Soft Pink', value: '#f8bbd0' },
      { name: 'Lavender Purple', value: '#e1bee7' },
      { name: 'Peach Orange', value: '#ffe0b2' },
      { name: 'No Color / Clear', value: 'transparent' }
    ];

    this.init();
  }

  init() {
    this.bindElements();
    this.buildPalettes();
    this.bindTwoWayMirror();
  }

  bindElements() {
    this.selectFontFamily = document.getElementById('select-font-family');
    this.selectFontSize = document.getElementById('select-font-size');
    this.selectHeading = document.getElementById('select-heading');

    this.btnBold = document.getElementById('btn-bold');
    this.btnItalic = document.getElementById('btn-italic');
    this.btnUnderline = document.getElementById('btn-underline');
    this.btnStrikethrough = document.getElementById('btn-strikethrough');

    // Split Font Color Elements
    this.btnFontColor = document.getElementById('btn-font-color');
    this.fontColorBar = document.getElementById('font-color-bar');
    this.btnFontColorChevron = document.getElementById('btn-font-color-chevron');
    this.paletteFontColor = document.getElementById('palette-font-color');
    this.gridFontColors = document.getElementById('grid-font-colors');

    // Split Highlighter Elements
    this.btnHighlightColor = document.getElementById('btn-highlight-color');
    this.highlightColorBar = document.getElementById('highlight-color-bar');
    this.btnHighlightChevron = document.getElementById('btn-highlight-chevron');
    this.paletteHighlightColor = document.getElementById('palette-highlight-color');
    this.gridHighlightColors = document.getElementById('grid-highlight-colors');

    // Bind Split Font Color Clicks
    if (this.btnFontColor) {
      this.btnFontColor.onmousedown = (e) => e.preventDefault(); // Keep selection
      this.btnFontColor.onclick = () => {
        this.applyFontColor(this.activeFontColor);
        this.closeAllPalettes();
      };
    }
    if (this.btnFontColorChevron) {
      this.btnFontColorChevron.onmousedown = (e) => e.preventDefault();
      this.btnFontColorChevron.onclick = (e) => {
        e.stopPropagation();
        this.togglePalette(this.paletteFontColor);
      };
    }

    // Bind Split Highlighter Clicks
    if (this.btnHighlightColor) {
      this.btnHighlightColor.onmousedown = (e) => e.preventDefault();
      this.btnHighlightColor.onclick = () => {
        this.applyHighlightColor(this.activeHighlightColor);
        this.closeAllPalettes();
      };
    }
    if (this.btnHighlightChevron) {
      this.btnHighlightChevron.onmousedown = (e) => e.preventDefault();
      this.btnHighlightChevron.onclick = (e) => {
        e.stopPropagation();
        this.togglePalette(this.paletteHighlightColor);
      };
    }

    // Typography Dropdowns
    if (this.selectFontFamily) {
      this.selectFontFamily.onchange = () => {
        this.restoreSelection();
        document.execCommand('fontName', false, this.selectFontFamily.value);
        if (this.app.history) this.app.history.debouncePush('font_family');
      };
    }
    if (this.selectFontSize) {
      this.selectFontSize.onchange = () => {
        this.applyFontSize(this.selectFontSize.value);
      };
    }
    if (this.selectHeading) {
      this.selectHeading.onchange = () => {
        this.applyHeading(this.selectHeading.value);
      };
    }

    // Strikethrough
    if (this.btnStrikethrough) {
      this.btnStrikethrough.onclick = () => {
        this.restoreSelection();
        document.execCommand('strikeThrough', false, null);
        this.inspectCursor();
        if (this.app.history) this.app.history.debouncePush('strikethrough');
      };
    }

    // Close palettes on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.split-color-container')) {
        this.closeAllPalettes();
      }
    });
  }

  buildPalettes() {
    // 1. Font Color Palette Swatches
    if (this.gridFontColors) {
      this.gridFontColors.innerHTML = '';
      this.fontColors.forEach(item => {
        const swatch = document.createElement('button');
        swatch.className = 'palette-swatch-item';
        swatch.title = item.name;
        swatch.style.backgroundColor = item.value;
        swatch.onmousedown = (e) => e.preventDefault();
        swatch.onclick = () => {
          this.activeFontColor = item.value;
          if (this.fontColorBar) this.fontColorBar.style.backgroundColor = item.value;
          this.applyFontColor(item.value);
          this.closeAllPalettes();
        };
        this.gridFontColors.appendChild(swatch);
      });
    }

    // 2. Highlighter Palette Swatches
    if (this.gridHighlightColors) {
      this.gridHighlightColors.innerHTML = '';
      this.highlightColors.forEach(item => {
        const swatch = document.createElement('button');
        swatch.className = 'palette-swatch-item highlighter-swatch';
        swatch.title = item.name;
        swatch.style.backgroundColor = item.value === 'transparent' ? '#ffffff' : item.value;
        if (item.value === 'transparent') {
          swatch.innerHTML = '<span style="font-size:11px;color:#999;">✕</span>';
        }
        swatch.onmousedown = (e) => e.preventDefault();
        swatch.onclick = () => {
          this.activeHighlightColor = item.value;
          if (this.highlightColorBar) this.highlightColorBar.style.backgroundColor = item.value === 'transparent' ? '#ccc' : item.value;
          this.applyHighlightColor(item.value);
          this.closeAllPalettes();
        };
        this.gridHighlightColors.appendChild(swatch);
      });
    }
  }

  togglePalette(paletteEl) {
    if (!paletteEl) return;
    const isShowing = paletteEl.classList.contains('active');
    this.closeAllPalettes();
    if (!isShowing) {
      paletteEl.classList.add('active');
    }
  }

  closeAllPalettes() {
    if (this.paletteFontColor) this.paletteFontColor.classList.remove('active');
    if (this.paletteHighlightColor) this.paletteHighlightColor.classList.remove('active');
  }

  // --- Selection Lock: Snapshots & Restorations ---

  snapshotSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Only snapshot if inside a contenteditable note box
      if (this.isInsideNoteBox(range.commonAncestorContainer)) {
        this.savedRange = range.cloneRange();
      }
    }
  }

  restoreSelection() {
    if (!this.savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(this.savedRange);
  }

  isInsideNoteBox(node) {
    if (!node) return false;
    let curr = node.nodeType === 3 ? node.parentElement : node;
    while (curr && curr !== document.body) {
      if (curr.classList && (curr.classList.contains('note-box') || curr.isContentEditable)) {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  // --- Formatting Applicators ---

  applyFontColor(color) {
    this.restoreSelection();
    document.execCommand('foreColor', false, color);
    if (this.app.history) this.app.history.debouncePush('font_color');
  }

  applyHighlightColor(color) {
    this.restoreSelection();
    if (color === 'transparent') {
      document.execCommand('removeFormat', false, null);
    } else {
      // HiliteColor for Chrome/Edge/Firefox
      const success = document.execCommand('hiliteColor', false, color);
      if (!success) {
        document.execCommand('backColor', false, color);
      }
    }
    if (this.app.history) this.app.history.debouncePush('highlight_color');
  }

  applyFontSize(sizeVal) {
    this.restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    // Use span with precise inline font size in px
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = sizeVal;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      // Reselect the new span
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      this.savedRange = newRange.cloneRange();
    } catch (_) {}

    if (this.app.history) this.app.history.debouncePush('font_size');
  }

  applyHeading(headingTag) {
    this.restoreSelection();
    if (headingTag === 'p') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, `<${headingTag}>`);
    }
    if (this.app.history) this.app.history.debouncePush('heading_style');
  }

  // --- Two-Way Mirror (Live Inspection) ---

  bindTwoWayMirror() {
    const handleInspection = () => {
      this.snapshotSelection();
      this.inspectCursor();
    };

    document.addEventListener('selectionchange', handleInspection);
    document.addEventListener('keyup', handleInspection);
    document.addEventListener('pointerup', handleInspection);
  }

  inspectCursor() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const node = sel.anchorNode;
    if (!this.isInsideNoteBox(node)) return;

    const el = node.nodeType === 3 ? node.parentElement : node;
    if (!el) return;

    // 1. Inspect Bold, Italic, Underline, Strikethrough
    try {
      const isBold = document.queryCommandState('bold');
      const isItalic = document.queryCommandState('italic');
      const isUnderline = document.queryCommandState('underline');
      const isStrike = document.queryCommandState('strikeThrough');

      if (this.btnBold) this.btnBold.classList.toggle('active', Boolean(isBold));
      if (this.btnItalic) this.btnItalic.classList.toggle('active', Boolean(isItalic));
      if (this.btnUnderline) this.btnUnderline.classList.toggle('active', Boolean(isUnderline));
      if (this.btnStrikethrough) this.btnStrikethrough.classList.toggle('active', Boolean(isStrike));
    } catch (_) {}

    // 2. Inspect Heading Style
    if (this.selectHeading) {
      let blockParent = el;
      let detectedHeading = 'p';
      while (blockParent && !blockParent.classList.contains('content-area')) {
        const tag = blockParent.tagName.toLowerCase();
        if (['h1', 'h2', 'h3'].includes(tag)) {
          detectedHeading = tag;
          break;
        }
        blockParent = blockParent.parentElement;
      }
      this.selectHeading.value = detectedHeading;
    }

    // 3. Inspect Computed Font Size & Font Family
    const computed = window.getComputedStyle(el);
    if (this.selectFontSize && computed.fontSize) {
      const pxSize = Math.round(parseFloat(computed.fontSize)) + 'px';
      // Match available option or keep closest
      const match = Array.from(this.selectFontSize.options).find(opt => opt.value === pxSize);
      if (match) {
        this.selectFontSize.value = pxSize;
      }
    }

    // 4. Inspect Font Color & Update Illuminated Bar
    if (computed.color && this.fontColorBar) {
      this.fontColorBar.style.backgroundColor = computed.color;
    }
  }
}

// Export for modular usage
window.RibbonController = RibbonController;
