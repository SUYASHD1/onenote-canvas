/**
 * OneNote Spatial Canvas — Main Application Coordinator
 * 
 * Responsibilities:
 * - Bootstraps all subsystems (Canvas, Tables, Images, Flow, Shortcuts).
 * - Wires up top ribbon actions and file input listeners.
 * - Seeds default demonstration notes for an immediate, impressive first load.
 */

class OneNoteApp {
  constructor() {
    this.noteBoxes = [];
    this.boxIdCounter = 1;
    this.selectedNoteBox = null;

    this.init();
  }

  init() {
    // 1. Initialize Subsystems
    this.canvas = new OneNoteCanvas('canvas-viewport', 'canvas-stage');
    this.canvas.app = this;
    this.tableModule = new TableModule(this);
    this.imageModule = new ImageModule(this);
    this.mathModule = new MathModule(this);
    this.markdownModule = new MarkdownModule(this);
    this.flowEngine = new ElementFlowEngine(this);
    this.keyboardController = new KeyboardController(this);
    this.history = new HistoryManager(this);
    this.storageVault = new StorageVault(this);
    this.ribbonController = new RibbonController(this);
    this.inkEngine = new InkEngine(this);
    this.sidebar = new SidebarManager(this);

    // 2. Connect Canvas Callbacks
    this.canvas.onCanvasDoubleClicked = (x, y) => {
      this.createNoteBox(x, y);
    };

    this.canvas.onCanvasSingleClicked = () => {
      this.deselectAll();
    };

    // 3. Connect Ribbon Toolbar & Theme
    this.bindRibbonControls();
    this.initTheme();

    // 4. Always seed latest fresh starter notes on launch
    try {
      localStorage.removeItem('onenote_canvas_workspace');
    } catch (_) {}
    this.seedStarterNotes();
    this.history.pushState('initial');
    if (this.sidebar) {
      this.sidebar.saveActivePage();
    }
  }

  createNoteBox(x = 100, y = 100, width = 360, height = null, recordHistory = true) {
    const id = this.boxIdCounter++;
    const box = new NoteBox(this, id, x, y, width, height);
    this.noteBoxes.push(box);
    this.selectNoteBox(box);
    this.canvas.ensureBounds(this.noteBoxes);
    if (recordHistory && this.history) {
      this.history.pushState('create_box');
    }
    return box;
  }

  findNoteBox(id) {
    return this.noteBoxes.find(b => String(b.id) === String(id));
  }

  removeNoteBox(id) {
    this.noteBoxes = this.noteBoxes.filter(b => String(b.id) !== String(id));
    if (this.selectedNoteBox && String(this.selectedNoteBox.id) === String(id)) {
      this.selectedNoteBox = null;
    }
    if (this.history) {
      this.history.pushState('remove_box');
    }
  }

  selectNoteBox(box, visuallyHighlight = true) {
    this.noteBoxes.forEach(b => b.setSelected(false));
    document.querySelectorAll('.image-card.active-selected, .table-wrapper.active-selected').forEach(el => el.classList.remove('active-selected'));
    this.selectedNoteBox = box;
    this.activeSelection = box ? { element: box, type: 'note-box' } : null;
    if (visuallyHighlight && box) {
      box.setSelected(true);
      window.getSelection()?.removeAllRanges();
      if (document.activeElement && document.activeElement.isContentEditable) {
        document.activeElement.blur();
      }
    }
  }

  selectObject(element, type) {
    document.querySelectorAll('.image-card.active-selected, .table-wrapper.active-selected').forEach(el => el.classList.remove('active-selected'));
    if (this.selectedNoteBox && type !== 'note-box') {
      this.selectedNoteBox.setSelected(false);
    }
    this.activeSelection = { element, type };
    if (element) {
      if (type === 'note-box') {
        element.setSelected(true);
        this.selectedNoteBox = element;
      } else {
        element.classList.add('active-selected');
        const parentBoxEl = element.closest('.note-box');
        if (parentBoxEl) {
          const box = this.findNoteBox(parentBoxEl.dataset.boxId);
          if (box) this.selectedNoteBox = box;
        }
      }
    }
  }

  deselectAll() {
    this.noteBoxes.forEach(b => {
      b.setSelected(false);
      b.element.classList.remove('multi-selected');
    });
    this.selectedNoteBox = null;
    this.activeSelection = null;
    document.querySelectorAll('.image-card.active-selected, .table-wrapper.active-selected').forEach(el => {
      el.classList.remove('active-selected');
    });
    window.getSelection()?.removeAllRanges();
  }

  /**
   * Universal 8-point perimeter resize handle attachment for any object
   */
  attachUniversalBoundaryHandles(containerEl, onResize, onResizeEnd) {
    const handlePositions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handlePositions.forEach(pos => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${pos}`;
      handle.dataset.position = pos;
      handle.contentEditable = 'false';
      containerEl.appendChild(handle);

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startW = containerEl.offsetWidth;
        const startH = containerEl.offsetHeight;

        const onMouseMove = (ev) => {
          const zoom = this.canvas.zoomLevel || 1;
          const dx = (ev.clientX - startClientX) / zoom;
          const dy = (ev.clientY - startClientY) / zoom;
          if (onResize) onResize(pos, dx, dy, startW, startH);
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          if (onResizeEnd) onResizeEnd();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  /**
   * Bind all ribbon buttons and keyboard helpers
   */
  bindRibbonControls() {
    // New Note
    const btnNew = document.getElementById('btn-new-note');
    if (btnNew) {
      btnNew.onclick = () => {
        const vp = this.canvas.viewport;
        const x = (vp.scrollLeft + 120) / this.canvas.zoomLevel;
        const y = (vp.scrollTop + 120) / this.canvas.zoomLevel;
        const box = this.createNoteBox(Math.round(x), Math.round(y));
        box.addTextBlock('');
      };
    }

    // Insert Paragraph Block
    const btnPara = document.getElementById('btn-insert-paragraph');
    if (btnPara) {
      btnPara.onclick = () => {
        let targetBox = this.selectedNoteBox;
        if (!targetBox) {
          const vp = this.canvas.viewport;
          targetBox = this.createNoteBox((vp.scrollLeft + 140) / this.canvas.zoomLevel, (vp.scrollTop + 140) / this.canvas.zoomLevel, 360);
        }
        const block = targetBox.addTextBlock('', false, true);
        const editable = block.querySelector('[contenteditable="true"]');
        if (editable) editable.focus();
        if (this.history) this.history.pushState('add_paragraph_block');
      };
    }

    // Insert Table
    const btnTable = document.getElementById('btn-insert-table');
    if (btnTable) {
      btnTable.onclick = () => {
        let targetBox = this.selectedNoteBox;
        if (!targetBox) {
          const vp = this.canvas.viewport;
          targetBox = this.createNoteBox((vp.scrollLeft + 140) / this.canvas.zoomLevel, (vp.scrollTop + 140) / this.canvas.zoomLevel, 440);
        }
        const tableBlock = this.tableModule.createTableElement(3, 3, 'layout-classic-grid');
        targetBox.contentArea.appendChild(tableBlock);
        this.flowEngine.attachGripDrag(tableBlock, targetBox);
      };
    }

    // Insert Image
    const btnImage = document.getElementById('btn-insert-image');
    const fileInput = document.getElementById('image-file-input');
    if (btnImage && fileInput) {
      btnImage.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const targetCell = this.tableModule && this.tableModule.lastFocusedCell && document.contains(this.tableModule.lastFocusedCell)
              ? this.tableModule.lastFocusedCell
              : null;
            if (targetCell) {
              this.tableModule.insertImageIntoCell(targetCell, ev.target.result);
              return;
            }

            let targetBox = this.selectedNoteBox;
            if (!targetBox) {
              const vp = this.canvas.viewport;
              targetBox = this.createNoteBox((vp.scrollLeft + 160) / this.canvas.zoomLevel, (vp.scrollTop + 160) / this.canvas.zoomLevel, 400);
            }
            const imgBlock = this.imageModule.createImageBlock(ev.target.result, file.name);
            targetBox.contentArea.appendChild(imgBlock);
            this.flowEngine.attachGripDrag(imgBlock, targetBox);
          };
          reader.readAsDataURL(file);
        }
      };
    }

    // Insert Math Equation Block (Alt+=)
    const btnMath = document.getElementById('btn-insert-math');
    if (btnMath) {
      btnMath.onclick = () => {
        let targetBox = this.selectedNoteBox;
        if (!targetBox) {
          const vp = this.canvas.viewport;
          targetBox = this.createNoteBox((vp.scrollLeft + 140) / this.canvas.zoomLevel, (vp.scrollTop + 140) / this.canvas.zoomLevel, 380);
        }
        const mathBlock = this.mathModule.createMathBlock('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
        targetBox.contentArea.appendChild(mathBlock);
        this.flowEngine.attachGripDrag(mathBlock, targetBox);
        if (this.history) this.history.pushState('insert_math');
      };
    }

    // Text formatting
    const bindFormat = (id, command) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.onclick = () => {
          if (this.ribbonController) this.ribbonController.restoreSelection();
          document.execCommand(command, false, null);
          if (this.ribbonController) this.ribbonController.inspectCursor();
          if (this.history) this.history.debouncePush(command);
        };
      }
    };
    bindFormat('btn-bold', 'bold');
    bindFormat('btn-italic', 'italic');
    bindFormat('btn-underline', 'underline');
    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.onclick = () => this.history.undo();
    const btnRedo = document.getElementById('btn-redo');
    if (btnRedo) btnRedo.onclick = () => this.history.redo();

    // To-do Checkbox button
    const btnTodo = document.getElementById('btn-todo');
    if (btnTodo) {
      btnTodo.onclick = () => {
        let targetBox = this.selectedNoteBox;
        if (!targetBox) {
          const vp = this.canvas.viewport;
          targetBox = this.createNoteBox((vp.scrollLeft + 100) / this.canvas.zoomLevel, (vp.scrollTop + 100) / this.canvas.zoomLevel);
        }
        targetBox.addTodoBlock('New to-do item');
      };
    }

    // Zoom controls
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnToggleGrid = document.getElementById('btn-toggle-grid');

    if (btnZoomIn) btnZoomIn.onclick = () => this.canvas.adjustZoom(0.1);
    if (btnZoomOut) btnZoomOut.onclick = () => this.canvas.adjustZoom(-0.1);
    if (btnToggleGrid) btnToggleGrid.onclick = () => this.canvas.toggleGrid();
  }

  /**
   * Executive Dark Mode & Light Theme Manager
   */
  initTheme() {
    let savedTheme = 'light';
    try {
      savedTheme = localStorage.getItem('onenote_theme') || 'light';
    } catch (_) {}
    this.setTheme(savedTheme);

    const btnToggleTheme = document.getElementById('btn-toggle-theme');
    if (btnToggleTheme) {
      btnToggleTheme.onclick = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
      };
    }
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('onenote_theme', theme);
    } catch (_) {}

    const iconSpan = document.getElementById('theme-toggle-icon');
    const toggleBtn = document.getElementById('btn-toggle-theme');
    if (iconSpan) {
      iconSpan.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    if (toggleBtn) {
      toggleBtn.title = theme === 'dark' 
        ? 'Switch to Daylight Light Mode (☀️)' 
        : 'Switch to Executive Dark Mode (🌙)';
    }

    // Adapt ink engine pen swatches and smart inverted vector strokes
    if (this.inkEngine && typeof this.inkEngine.onThemeChanged === 'function') {
      this.inkEngine.onThemeChanged(theme);
    }
  }

  /**
   * Seed rich starter notes showcasing all features on launch
   */
  seedStarterNotes() {
    // --- Note 1: OneNote Overview & Core Controls ---
    const note1 = this.createNoteBox(60, 50, 420);
    note1.addTextBlock('OneNote Spatial Canvas', true);
    note1.addTextBlock('Welcome to your open spatial desk! Here is how to use it:');
    note1.addTextBlock('• <b>Double-Click anywhere</b> on blank space to create a new note box.');
    note1.addTextBlock('• Hover on the left of any line to see the <b>grip (:::)</b>.');
    note1.addTextBlock('• <b>Pop-Out:</b> Drag the grip outside this box to detach it into its own card.');
    note1.addTextBlock('• <b>Pop-In:</b> Drag an item over another card to see the radiant blue line and drop.');
    note1.addTodoBlock('Try dragging this checklist item to the canvas', false);
    note1.addTodoBlock('Type text and hit Tab to instantly make a table', true);

    // --- Note 2: Table Auto-Detection & 4 Layout Styles ---
    const note2 = this.createNoteBox(520, 50, 520);
    note2.addTextBlock('Productivity & Metrics Table', true);
    note2.addTextBlock('Auto-detects tables when you type a word and press <b>Tab</b>. Try switching layout styles below:');
    
    const tableData = [
      ['Sprint Phase', 'Deliverable', 'Status', 'Owner'],
      ['Phase 1', 'Canvas Engine & Elastic Bounds', 'Completed', 'Engineering'],
      ['Phase 2', 'Table Auto-Detection & 4 Styles', 'Active', 'UI / UX Team'],
      ['Phase 3', 'In-Place Image Cropping & Sizing', 'Testing', 'QA Lead']
    ];
    const tableBlock = this.tableModule.createTableFromData(tableData, 'layout-modern-accent');
    note2.contentArea.appendChild(tableBlock);
    this.flowEngine.attachGripDrag(tableBlock, note2);

    // --- Note 3: Image Sizing, Cropping & Locked Captions ---
    const note3 = this.createNoteBox(1080, 50, 420);
    note3.addTextBlock('Visual Assets & In-Place Crop', true);
    note3.addTextBlock('Images resize seamlessly and have a built-in crop tool:');

    // Create a crisp SVG diagram data URI for instant visual demonstration
    const sampleSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><rect width="400" height="240" fill="%232b223a"/><circle cx="200" cy="120" r="70" fill="%237719aa" opacity="0.8"/><rect x="80" y="80" width="240" height="80" rx="10" fill="%23ffffff" opacity="0.15"/><text x="200" y="115" font-family="sans-serif" font-size="18" font-weight="bold" fill="%23ffffff" text-anchor="middle">OneNote Spatial Engine</text><text x="200" y="140" font-family="sans-serif" font-size="12" fill="%23d8b4fe" text-anchor="middle">Hover &amp; Click "✂ Crop" to Test</text></svg>`;
    const imgBlock = this.imageModule.createImageBlock(sampleSvg, 'Figure 1: Spatial Architecture Vector (Caption Locked)');
    note3.contentArea.appendChild(imgBlock);
    this.flowEngine.attachGripDrag(imgBlock, note3);

    this.deselectAll();
  }

  /**
   * OneNote AI Markdown Parser: Converts chatbot output (ChatGPT, Claude, etc.) to outline units
   */
  parseMarkdownToOutlineUnits(mdString) {
    if (!this.markdownModule) return [];
    return this.markdownModule.parseMarkdownToOutlineUnits(mdString);
  }

  /**
   * OneNote Outline Parser: Extracts text paragraphs, tables, and standalone images/figures
   */
  parseHTMLToOutlineUnits(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const units = [];

    const normalizeSrc = (src) => {
      if (!src) return '';
      if (src.startsWith('//')) return 'https:' + src;
      return src;
    };

    const findCaption = (container, imgEl) => {
      const figcap = container && container.querySelector ? container.querySelector('figcaption, .thumbcaption') : null;
      if (figcap) {
        let text = figcap.textContent.trim().replace(/\[\d+\]/g, '').replace(/\[edit\]/gi, '');
        text = text.replace(/Enlarge/gi, '').trim();
        if (text) return text;
      }
      const alt = (imgEl && imgEl.getAttribute('alt')) || '';
      if (alt && alt.length > 2 && !alt.toLowerCase().endsWith('.jpg') && !alt.toLowerCase().endsWith('.png') && !alt.toLowerCase().endsWith('.svg')) {
        return alt.trim();
      }
      const title = (imgEl && imgEl.getAttribute('title')) || '';
      if (title) return title.trim();
      return '';
    };

    // 1. Clean out scripts, styles, meta, noscript
    doc.querySelectorAll('script, style, meta, link, noscript').forEach(el => el.remove());

    // 2. Remove footnote citations, superscripts, and wiki editorial markers ([1], [edit], etc.)
    doc.querySelectorAll('sup, .reference, .mw-editsection, .noprint, .citation').forEach(el => el.remove());

    // 3. Unwrap all hyperlinks: keep the readable text, strip away blue URLs and underlines
    doc.querySelectorAll('a').forEach(a => {
      const parent = a.parentNode;
      if (!parent) return;
      while (a.firstChild) {
        parent.insertBefore(a.firstChild, a);
      }
      a.remove();
    });

    // 4. Strip inline colors, text-decorations, and extraneous website styles
    doc.querySelectorAll('*').forEach(el => {
      if (el.style) {
        el.style.color = '';
        el.style.textDecoration = '';
        el.style.backgroundColor = '';
        el.style.fontFamily = '';
        el.style.fontSize = '';
        if (el.getAttribute('style') === '') el.removeAttribute('style');
      }
      const isProtected = el.closest('table, figure, math, .mwe-math-element, .katex, .MathJax') !== null ||
                          el.tagName === 'TABLE' || el.tagName === 'FIGURE' || el.tagName === 'MATH' ||
                          el.classList?.contains('mwe-math-element') || el.classList?.contains('katex');
      if (!isProtected) {
        el.removeAttribute('class');
      }
    });

    // Universal Web Math Extractor: pulls clean formulas from KaTeX, MathJax, Wikipedia, and Academic Journals
    const extractMathInfo = (mathNode) => {
      if (!mathNode) return null;

      const domMath = mathNode.tagName === 'MATH' ? mathNode : (mathNode.querySelector ? mathNode.querySelector('math') : null);
      let latex = '';

      // 1. Wikipedia / MediaWiki source data: data-mw='{"body":{"extsrc":"..."}}'
      const dataMw = mathNode.getAttribute ? mathNode.getAttribute('data-mw') : null;
      if (dataMw) {
        try {
          const parsed = JSON.parse(dataMw);
          if (parsed?.body?.extsrc) latex = parsed.body.extsrc.trim();
        } catch (_) {}
      }

      // 2. Wikipedia & W3C MathML alttext attribute: <math alttext="..."> or container alttext
      if (!latex) {
        const altText = (domMath && domMath.getAttribute('alttext')) ||
                        (mathNode.getAttribute && mathNode.getAttribute('alttext'));
        if (altText) latex = altText.trim();
      }

      // 3. KaTeX & MathJax TeX annotation: <annotation encoding="application/x-tex">
      if (!latex && mathNode.querySelector) {
        const annotation = mathNode.querySelector('annotation[encoding*="tex" i], annotation[encoding*="TeX" i], annotation');
        if (annotation) latex = annotation.textContent.trim();
      }

      // 4. MathJax 2 & WordPress script tags: <script type="math/tex">
      if (!latex && mathNode.querySelector) {
        const scriptTex = mathNode.querySelector('script[type*="math/tex"]');
        if (scriptTex) latex = scriptTex.textContent.trim();
      }

      // 5. Custom HTML5 data attributes: data-latex, data-tex, data-formula
      if (!latex && mathNode.getAttribute) {
        latex = mathNode.getAttribute('data-latex') ||
                mathNode.getAttribute('data-tex') ||
                mathNode.getAttribute('data-formula') ||
                (domMath && (domMath.getAttribute('data-latex') || domMath.getAttribute('data-tex'))) ||
                '';
      }

      // 6. Image fallback: <img class="mwe-math-fallback-..." alt="..."> or <img alt="...">
      if (!latex) {
        const img = mathNode.querySelector ? mathNode.querySelector('img[alt]') : (mathNode.tagName === 'IMG' ? mathNode : null);
        if (img) latex = (img.getAttribute('alt') || '').trim();
      }

      // 7. Aria label / title fallback
      if (!latex && mathNode.getAttribute) {
        const aria = mathNode.getAttribute('aria-label') || mathNode.getAttribute('title');
        if (aria && (aria.includes('\\') || aria.includes('=') || aria.includes('_') || aria.includes('^'))) {
          latex = aria.trim();
        }
      }

      // Clean extracted LaTeX if found
      if (latex) {
        // Strip wrapper commands: {\displaystyle ...}, {\textstyle ...}
        latex = latex.replace(/^{\\displaystyle\s*([\s\S]*)}$/, '$1');
        latex = latex.replace(/^{\\textstyle\s*([\s\S]*)}$/, '$1');
        latex = latex.replace(/\\displaystyle\s*/g, '').replace(/\\textstyle\s*/g, '').trim();
        // Replace HTML entities
        latex = latex.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      }

      const rawMathML = domMath ? domMath.outerHTML : null;

      // If no LaTeX string was found, but authentic MathML is present (Nature, IEEE, Springer journals)
      if (!latex && !rawMathML) return null;

      return { latex: latex || '', rawMathML };
    };

    // Robust citation regex covering [1], [1, 2], [1,2,3], [1-4], [1–4], [note 1], [edit], etc.
    const citationRegex = /\[\s*(?:\d+|note\s*\d+|[a-z])(?:\s*[,;–-]\s*(?:\d+|note\s*\d+|[a-z]))*\s*\]|\[edit\]|\[citation needed\]/gi;

    const processElement = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent.replace(citationRegex, '').trim();
        if (text.length > 0) {
          units.push({ type: 'text', content: text });
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();

      // 1. Direct or Nested Tables (extract tables as first-class objects)
      const tables = Array.from(node.querySelectorAll('table'));
      if (tag === 'table') {
        units.push({ type: 'table', domElement: node });
        return;
      }
      if (tables.length > 0) {
        Array.from(node.childNodes).forEach(child => processElement(child));
        return;
      }

      // 2. Direct Standalone Math Elements (<math> or .mwe-math-element)
      const isDirectMath = tag === 'math' || (node.classList && node.classList.contains('mwe-math-element'));
      if (isDirectMath) {
        const mathInfo = extractMathInfo(node);
        if (mathInfo && mathInfo.latex) {
          units.push({ type: 'math', latex: mathInfo.latex, rawMathML: mathInfo.rawMathML });
          return;
        }
      }

      // 3. Multi-block or multi-child container (div, section, article, main, dl)
      const isContainer = ['div', 'section', 'article', 'main', 'dl'].includes(tag);
      const hasBlockChildren = node.children && Array.from(node.children).some(c =>
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'figure', 'div', 'dl', 'dd', 'blockquote'].includes(c.tagName.toLowerCase())
      );
      const imgs = Array.from(node.querySelectorAll('img'));
      const mathElements = Array.from(node.querySelectorAll('math, .mwe-math-element'));

      if ((isContainer && hasBlockChildren) || (isContainer && node.children.length > 1) || (isContainer && (imgs.length > 0 || mathElements.length > 0))) {
        Array.from(node.childNodes).forEach(child => processElement(child));
        return;
      }

      // 4. Standalone media figure, thumbnail or image
      const isMedia = tag === 'figure' || tag === 'img' || 
        node.classList.contains('thumb') || node.classList.contains('thumbinner');

      if (isMedia) {
        const img = tag === 'img' ? node : imgs[0];
        if (img) {
          const src = normalizeSrc(img.getAttribute('src'));
          if (src && !src.includes('spacer.gif')) {
            const caption = findCaption(node, img);
            units.push({ type: 'image', src, caption });
            return;
          }
        }
      }

      // 5. Standalone Definition List Item (<dd>) containing a display equation (Wikipedia style)
      if (tag === 'dd') {
        if (mathElements.length > 0) {
          const mathInfo = extractMathInfo(mathElements[0]);
          if (mathInfo && mathInfo.latex) {
            units.push({ type: 'math', latex: mathInfo.latex, rawMathML: mathInfo.rawMathML });
            return;
          }
        }
      }

      // 6. Blockquotes
      if (tag === 'blockquote') {
        let cleanHtml = node.innerHTML.replace(citationRegex, '').trim();
        if (cleanHtml.length > 0) {
          units.push({ type: 'callout', content: cleanHtml });
          return;
        }
      }

      // 7. Horizontal Divider
      if (tag === 'hr') {
        units.push({ type: 'divider' });
        return;
      }

      // 8. Headings (h1 - h6)
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        let cleanHtml = node.innerHTML.replace(citationRegex, '').trim();
        if (cleanHtml.length > 0) {
          units.push({ type: 'heading', tag, content: cleanHtml });
          return;
        }
      }

      // 9. Bullet & Numbered Lists (ul, ol)
      if (tag === 'ul' || tag === 'ol') {
        let cleanHtml = node.innerHTML.replace(citationRegex, '').trim();
        if (cleanHtml.length > 0) {
          units.push({ type: 'list', tag, content: `<${tag}>${cleanHtml}</${tag}>` });
          return;
        }
      }

      // 10. Text containers (p, pre, div, span, etc.)
      let plainText = node.textContent.replace(citationRegex, '').trim();

      // Check for standalone display math formula wrapped in <p> or <div> (Wikipedia style)
      if (mathElements.length === 1) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('math, .mwe-math-element').forEach(m => m.remove());
        const remainingText = clone.textContent.replace(citationRegex, '').trim();
        if (remainingText.length === 0) {
          const mathInfo = extractMathInfo(mathElements[0]);
          if (mathInfo && mathInfo.latex) {
            units.push({ type: 'math', latex: mathInfo.latex, rawMathML: mathInfo.rawMathML });
            return;
          }
        }
      }

      // Check for AI Chatbot bracket formulas: \[ ... \] or $$ ... $$
      if (plainText.includes('\\[') && plainText.includes('\\]')) {
        const regex = /\\\[([\s\S]+?)\\\]/g;
        let lastIdx = 0;
        let match;
        while ((match = regex.exec(plainText)) !== null) {
          const before = plainText.substring(lastIdx, match.index).trim();
          if (before) units.push({ type: 'text', content: before });
          const latex = match[1].trim();
          if (latex) units.push({ type: 'math', latex });
          lastIdx = match.index + match[0].length;
        }
        const after = plainText.substring(lastIdx).trim();
        if (after) units.push({ type: 'text', content: after });
        return;
      }

      if (plainText.includes('$$')) {
        const regex = /\$\$([\s\S]+?)\$\$/g;
        let lastIdx = 0;
        let match;
        while ((match = regex.exec(plainText)) !== null) {
          const before = plainText.substring(lastIdx, match.index).trim();
          if (before) units.push({ type: 'text', content: before });
          const latex = match[1].trim();
          if (latex) units.push({ type: 'math', latex });
          lastIdx = match.index + match[0].length;
        }
        const after = plainText.substring(lastIdx).trim();
        if (after) units.push({ type: 'text', content: after });
        return;
      }

      // In-place Markdown Heading detection (e.g. ### Title)
      const mdHeadingMatch = plainText.match(/^(#{1,6})\s+(.+)$/);
      if (mdHeadingMatch) {
        const level = mdHeadingMatch[1].length;
        const hTag = `h${Math.min(6, level)}`;
        units.push({
          type: 'heading',
          tag: hTag,
          content: this.markdownModule ? this.markdownModule.formatInline(mdHeadingMatch[2].trim()) : mdHeadingMatch[2].trim()
        });
        return;
      }

      // In-place Markdown Image detection (handles standard, unflagged AI images, and mixed text)
      if (this.markdownModule) {
        const segments = this.markdownModule.segmentTextAndImages(plainText);
        if (segments && segments.some(s => s.type === 'image')) {
          segments.forEach(seg => {
            if (seg.type === 'image') {
              units.push({
                type: 'image',
                src: seg.src,
                caption: seg.caption
              });
            } else if (seg.content && seg.content.trim().length > 0) {
              units.push({
                type: 'text',
                content: this.markdownModule.formatInline(seg.content.trim())
              });
            }
          });
          return;
        }
      }

      // Inline Math Replacement for paragraphs (turns embedded Wikipedia math into inline badges)
      if (mathElements.length > 0) {
        mathElements.forEach(mEl => {
          const mInfo = extractMathInfo(mEl);
          if (mInfo && mInfo.latex) {
            const mathSpan = document.createElement('span');
            mathSpan.className = 'inline-math';
            mathSpan.contentEditable = 'false';
            mathSpan.dataset.latex = mInfo.latex;
            mathSpan.innerHTML = this.mathModule ? this.mathModule.renderFormulaHTML(mInfo.latex, false, mInfo.rawMathML) : mInfo.latex;
            mEl.parentNode?.replaceChild(mathSpan, mEl);
          }
        });
      }

      let cleanHtml = node.innerHTML.replace(citationRegex, '').trim();
      if (plainText.length > 0) {
        units.push({ type: 'text', content: cleanHtml });
      }
    };

    Array.from(doc.body.childNodes).forEach(node => processElement(node));
    return units;
  }

  /**
   * Helper to construct a single OneNote canvas block from an outline unit
   */
  createBlockFromOutlineUnit(unit) {
    if (!unit) return null;
    let newBlock = null;

    if (unit.type === 'image') {
      newBlock = this.imageModule.createImageBlock(unit.src, unit.caption || null);
    } else if (unit.type === 'table') {
      newBlock = this.tableModule.createTableFromDOM(unit.domElement);
    } else if (unit.type === 'math') {
      newBlock = this.mathModule.createMathBlock(unit.latex, unit.rawMathML || null);
    } else if (unit.type === 'callout') {
      newBlock = document.createElement('div');
      newBlock.className = 'canvas-block callout-block';
      newBlock.dataset.blockType = 'callout';

      const grip = document.createElement('div');
      grip.className = 'block-grip';
      grip.contentEditable = 'false';
      grip.textContent = ':::';
      grip.title = 'Drag to rearrange or drag out to detach';
      newBlock.appendChild(grip);

      const card = document.createElement('div');
      card.className = 'callout-card';
      card.innerHTML = `<span class="callout-icon" contenteditable="false">💡</span><div class="callout-content" contenteditable="true">${unit.content || ''}</div>`;
      if (this.mathModule) this.mathModule.renderInlineMath(card.querySelector('.callout-content'));
      newBlock.appendChild(card);
    } else if (unit.type === 'divider') {
      newBlock = document.createElement('div');
      newBlock.className = 'canvas-block divider-block';
      newBlock.dataset.blockType = 'divider';
      newBlock.contentEditable = 'false';

      const grip = document.createElement('div');
      grip.className = 'block-grip';
      grip.contentEditable = 'false';
      grip.textContent = ':::';
      grip.title = 'Drag to rearrange or drag out to detach';
      newBlock.appendChild(grip);

      const hr = document.createElement('hr');
      hr.className = 'canvas-divider';
      newBlock.appendChild(hr);
    } else if (unit.type === 'task-list') {
      newBlock = document.createElement('div');
      newBlock.className = 'canvas-block task-list-block';
      newBlock.dataset.blockType = 'task-list';

      const grip = document.createElement('div');
      grip.className = 'block-grip';
      grip.contentEditable = 'false';
      grip.textContent = ':::';
      grip.title = 'Drag to rearrange or drag out to detach';
      newBlock.appendChild(grip);

      const container = document.createElement('div');
      container.className = 'task-items-container';
      (unit.items || []).forEach(item => {
        const row = document.createElement('div');
        row.className = `task-row ${item.checked ? 'completed' : ''}`;
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'task-chk';
        chk.checked = !!item.checked;
        chk.contentEditable = 'false';
        chk.onchange = () => {
          row.classList.toggle('completed', chk.checked);
          if (this.history) this.history.debouncePush('toggle_task');
        };

        const textSpan = document.createElement('span');
        textSpan.className = 'task-text';
        textSpan.contentEditable = 'true';
        textSpan.innerHTML = item.text || '';
        if (this.mathModule) this.mathModule.renderInlineMath(textSpan);

        row.appendChild(chk);
        row.appendChild(textSpan);
        container.appendChild(row);
      });
      newBlock.appendChild(container);
    } else if (unit.type === 'heading') {
      newBlock = document.createElement('div');
      newBlock.className = 'canvas-block text-block heading-block';
      newBlock.dataset.blockType = 'heading';

      const grip = document.createElement('div');
      grip.className = 'block-grip';
      grip.contentEditable = 'false';
      grip.textContent = ':::';
      grip.title = 'Drag to rearrange or drag out to detach';
      newBlock.appendChild(grip);

      const span = document.createElement(unit.tag || 'h2');
      span.contentEditable = 'true';
      span.className = `note-heading ${unit.tag || 'h2'}`;
      span.innerHTML = unit.content;
      if (this.mathModule) this.mathModule.renderInlineMath(span);
      newBlock.appendChild(span);
    } else if (unit.type === 'list') {
      newBlock = document.createElement('div');
      newBlock.className = 'canvas-block text-block list-block';
      newBlock.dataset.blockType = 'list';

      const grip = document.createElement('div');
      grip.className = 'block-grip';
      grip.contentEditable = 'false';
      grip.textContent = ':::';
      grip.title = 'Drag to rearrange or drag out to detach';
      newBlock.appendChild(grip);

      const span = document.createElement('div');
      span.contentEditable = 'true';
      span.innerHTML = unit.content;
      if (this.mathModule) this.mathModule.renderInlineMath(span);
      newBlock.appendChild(span);
    } else if (unit.type === 'text') {
      newBlock = document.createElement('div');
      newBlock.className = 'canvas-block text-block';
      newBlock.dataset.blockType = 'text';

      const grip = document.createElement('div');
      grip.className = 'block-grip';
      grip.contentEditable = 'false';
      grip.textContent = ':::';
      grip.title = 'Drag to rearrange or drag out to detach';
      newBlock.appendChild(grip);

      const span = document.createElement('div');
      span.contentEditable = 'true';
      span.innerHTML = unit.content || '<br>';
      if (this.mathModule) this.mathModule.renderInlineMath(span);
      newBlock.appendChild(span);
    }

    return newBlock;
  }

  /**
   * Insert OneNote outline units into a target note box
   * Uses DocumentFragment batching and requestAnimationFrame streaming
   * to guarantee locked 60-120 FPS smoothness without freezing on iPad/mobile.
   */
  insertOutlineUnits(units, targetBox, anchorBlock = null, onComplete = null) {
    if (!units || units.length === 0 || !targetBox) {
      if (onComplete) onComplete();
      return;
    }

    let insertAfter = anchorBlock;
    const CHUNK_SIZE = 12; // 12 blocks per frame keeps iPad main-thread latency <4ms

    // If small payload (<= 12 items), insert in 1 shot via DocumentFragment
    if (units.length <= CHUNK_SIZE) {
      const fragment = document.createDocumentFragment();
      const createdBlocks = [];

      units.forEach(unit => {
        const block = this.createBlockFromOutlineUnit(unit);
        if (block) {
          fragment.appendChild(block);
          createdBlocks.push(block);
        }
      });

      if (insertAfter && insertAfter.nextSibling) {
        targetBox.contentArea.insertBefore(fragment, insertAfter.nextSibling);
      } else {
        targetBox.contentArea.appendChild(fragment);
      }

      createdBlocks.forEach(block => {
        this.flowEngine.attachGripDrag(block, targetBox);
      });

      if (anchorBlock && anchorBlock.dataset.blockType === 'text') {
        const span = anchorBlock.querySelector('[contenteditable="true"]');
        if (span && span.textContent.trim().length === 0) {
          anchorBlock.remove();
        }
      }

      this.canvas.ensureBounds(this.noteBoxes);
      if (onComplete) onComplete();
      return;
    }

    // Large payload (> 12 items): Stream in micro-batches across animation frames
    let index = 0;

    const streamNextBatch = () => {
      const fragment = document.createDocumentFragment();
      const createdBlocks = [];
      const end = Math.min(index + CHUNK_SIZE, units.length);

      for (let i = index; i < end; i++) {
        const block = this.createBlockFromOutlineUnit(units[i]);
        if (block) {
          fragment.appendChild(block);
          createdBlocks.push(block);
        }
      }

      if (insertAfter && insertAfter.nextSibling) {
        targetBox.contentArea.insertBefore(fragment, insertAfter.nextSibling);
      } else {
        targetBox.contentArea.appendChild(fragment);
      }

      createdBlocks.forEach(block => {
        this.flowEngine.attachGripDrag(block, targetBox);
        insertAfter = block;
      });

      index = end;

      if (index < units.length) {
        requestAnimationFrame(streamNextBatch);
      } else {
        if (anchorBlock && anchorBlock.dataset.blockType === 'text') {
          const span = anchorBlock.querySelector('[contenteditable="true"]');
          if (span && span.textContent.trim().length === 0) {
            anchorBlock.remove();
          }
        }
        this.canvas.ensureBounds(this.noteBoxes);
        if (onComplete) onComplete();
      }
    };

    // Kick off first batch immediately so top of document renders instantaneously
    streamNextBatch();
  }
}

// Instantiate application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new OneNoteApp();
});
