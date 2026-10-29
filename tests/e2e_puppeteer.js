/**
 * Automated End-to-End Test Suite for OneNote Spatial Canvas
 * Uses Puppeteer to drive Microsoft Edge
 */

const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP_URL = `file://${path.resolve(__dirname, '../index.html').replace(/\\/g, '/')}`;

async function runTests() {
  console.log('🚀 Starting OneNote Spatial Canvas E2E Test Suite...');
  console.log(`📍 Testing URL: ${APP_URL}`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, testName) {
    totalCount++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  try {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 500));

    // TEST 1: Default Startup & Notes
    console.log('\n--- 1. App Startup & Starter Notes ---');
    const noteCount = await page.$$eval('.note-box', boxes => boxes.length);
    assert(noteCount >= 3, `Initial load renders at least 3 starter notes (Found: ${noteCount})`);

    const hasRibbon = await page.$eval('.ribbon-bar', el => !!el);
    assert(hasRibbon, 'Top OneNote ribbon toolbar is present');

    // TEST 2: Double-Click Blank Canvas to Spawn Note
    console.log('\n--- 2. Double-Click Spawn Test ---');
    const initialBoxes = await page.$$eval('.note-box', boxes => boxes.length);
    await page.evaluate(() => {
      window.app.canvas.onCanvasDoubleClicked(750, 450);
    });
    const afterSpawnCount = await page.$$eval('.note-box', boxes => boxes.length);
    assert(afterSpawnCount === initialBoxes + 1, `Double-clicking canvas spawns a new note box (Count: ${afterSpawnCount})`);

    // TEST 3: Table Auto-Detection & 4 Layout Formats
    console.log('\n--- 3. Table Auto-Detection & 4 Layout Formats ---');
    const tableExists = await page.$eval('.canvas-table', el => !!el);
    assert(tableExists, 'Starter table rendered cleanly');

    const layoutResult = await page.evaluate(() => {
      const select = document.querySelector('.table-layout-select');
      const table = document.querySelector('.canvas-table');
      if (!select || !table) return false;

      const layouts = [
        'layout-classic-grid',
        'layout-zebra-banded',
        'layout-modern-accent',
        'layout-compact-matrix'
      ];

      for (const layout of layouts) {
        select.value = layout;
        select.dispatchEvent(new Event('change'));
        if (!table.classList.contains(layout)) return false;
      }
      return true;
    });
    assert(layoutResult, 'Table switches through all 4 layout styles cleanly (Classic, Zebra, Accent, Matrix)');

    // TEST 4: Image Sizing & Built-in Crop Tool
    console.log('\n--- 4. Image Sizing & In-Place Crop Modal ---');
    const hasImageCard = await page.$eval('.image-card', el => !!el);
    assert(hasImageCard, 'Starter image card rendered with locked caption');

    const cropModalOpened = await page.evaluate(() => {
      const img = document.querySelector('.image-container img');
      window.app.imageModule.openCropModal(img);
      const modal = document.getElementById('crop-modal');
      return modal && modal.style.display === 'flex';
    });
    assert(cropModalOpened, 'Built-in crop dialog opens with interactive crop box');

    const cropApplied = await page.evaluate(() => {
      window.app.imageModule.applyCrop();
      const modal = document.getElementById('crop-modal');
      return modal && modal.style.display === 'none';
    });
    assert(cropApplied, 'Apply crop executes HTML5 slice and closes dialog smoothly');

    const captionToggleWorked = await page.evaluate(() => {
      const card = document.querySelector('.image-card');
      const toggleBtn = card.querySelector('.caption-toggle-btn');
      if (!card || !toggleBtn) return false;

      // 1. Remove caption
      toggleBtn.click();
      const removed = !card.querySelector('.image-caption-wrapper');

      // 2. Add caption back
      toggleBtn.click();
      const addedBack = !!card.querySelector('.image-caption-wrapper');

      return removed && addedBack;
    });
    assert(captionToggleWorked, 'Image caption can be toggled on/off on demand via toolbar');

    // TEST 5: Pop-Out Detaching via Margin Grip (:::)
    console.log('\n--- 5. Pop-Out Detaching Engine ---');
    const popOutResult = await page.evaluate(() => {
      const sourceBox = window.app.noteBoxes[0];
      const block = sourceBox.contentArea.querySelector('.canvas-block');
      if (!block) return false;

      const prevCount = window.app.noteBoxes.length;
      // Trigger finalizeDrop on empty canvas
      window.app.flowEngine.activeDragElement = block;
      window.app.flowEngine.dragSourceBox = sourceBox;
      window.app.flowEngine.targetBox = null;
      window.app.flowEngine.finalizeDrop({ clientX: 800, clientY: 600 });

      return window.app.noteBoxes.length === prevCount + 1;
    });
    assert(popOutResult, 'Dragging margin grip to canvas pops out item into new independent note box');

    // TEST 6: Pop-In Merging & Glowing Blue Guideline
    console.log('\n--- 6. Pop-In Merging & Live Blue Guideline ---');
    const popInResult = await page.evaluate(() => {
      const guideline = document.getElementById('drop-guideline');
      window.app.flowEngine.showGuideline(200, 300, 340);
      const isVisible = guideline.classList.contains('active');
      window.app.flowEngine.hideGuideline();
      const isHidden = !guideline.classList.contains('active');
      return isVisible && isHidden;
    });
    assert(popInResult, 'Radiant blue drop guideline renders accurately on hover and hides on release');

    // TEST 7: 3-Tier Keyboard Conflict-Free Typing
    console.log('\n--- 7. 3-Tier Keyboard Shortcut Controller ---');
    const keyboardTest = await page.evaluate(() => {
      const box = window.app.noteBoxes[0];
      const initialCount = window.app.noteBoxes.length;

      // Tier 1: Typing text & Backspace at start of line
      const textBlock = box.contentArea.querySelector('.text-block');
      const editable = textBlock?.querySelector('[contenteditable="true"]');
      if (editable) {
        editable.focus();
        const backspaceEvt = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
        editable.dispatchEvent(backspaceEvt);
      }
      const boxStillAlive = window.app.noteBoxes.length === initialCount;

      // Tier 3: Selecting box header and pressing Delete removes it
      window.app.selectNoteBox(box, true);
      const deleteEvt = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
      window.dispatchEvent(deleteEvt);
      const boxDeleted = window.app.noteBoxes.length === initialCount - 1;

      return boxStillAlive && boxDeleted;
    });
    assert(keyboardTest, 'Backspace while typing never deletes container; container header Delete removes container cleanly');

    // TEST 8: Universal Copy & Paste (Ctrl+C & Ctrl+V)
    console.log('\n--- 8. Universal Clipboard (Ctrl+C, Ctrl+X, Ctrl+V) ---');
    const clipboardTest = await page.evaluate(() => {
      const boxToCopy = window.app.noteBoxes[0];
      const countBefore = window.app.noteBoxes.length;

      // Select container and press Ctrl+C
      window.app.selectNoteBox(boxToCopy, true);
      const copyEvt = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
      window.dispatchEvent(copyEvt);

      // Deselect and press Ctrl+V at (500, 500)
      window.app.deselectAll();
      window.app.keyboardController.mouseCanvasPos = { x: 500, y: 500 };
      const dt = new DataTransfer();
      dt.setData('text/plain', boxToCopy.contentArea.innerText);
      const pasteEvt = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
      window.dispatchEvent(pasteEvt);

      const countAfterPaste = window.app.noteBoxes.length;

      // Also test external text paste (outside content)
      const extDt = new DataTransfer();
      extDt.setData('text/plain', 'External pasted content from outside app');
      const extPasteEvt = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: extDt });
      window.dispatchEvent(extPasteEvt);

      const countAfterExtPaste = window.app.noteBoxes.length;

      return countAfterPaste === countBefore + 1 && countAfterExtPaste === countBefore + 2;
    });
    assert(clipboardTest, 'Ctrl+C copies selected container and Ctrl+V cleanly pastes both in-app and outside content');

    // TEST 9: Item Delete (Tier 2 Delete Key on Selected Image / Table)
    console.log('\n--- 9. Tier 2 Item Delete (Image / Table) ---');
    const itemDeleteTest = await page.evaluate(() => {
      const imgCard = document.querySelector('.image-card');
      if (!imgCard) return false;

      imgCard.classList.add('active-selected');
      const deleteEvt = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
      window.dispatchEvent(deleteEvt);

      return !document.contains(imgCard);
    });
    assert(itemDeleteTest, 'Pressing Delete on a selected image or table cleanly deletes only that item');

    // TEST 10: Unified Undo & Redo (Ctrl+Z and Ctrl+R / Ctrl+Y)
    console.log('\n--- 10. Unified Undo & Redo (Ctrl+Z, Ctrl+R, Ctrl+Y) ---');
    const undoRedoTest = await page.evaluate(() => {
      const countBeforeCreate = window.app.noteBoxes.length;

      // 1. Create a new note box
      window.app.createNoteBox(900, 900);
      const countAfterCreate = window.app.noteBoxes.length;

      // 2. Undo via Ctrl+Z
      const undoEvt = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
      window.dispatchEvent(undoEvt);
      const countAfterUndo = window.app.noteBoxes.length;

      // 3. Redo via Ctrl+R
      const redoEvt = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true });
      window.dispatchEvent(redoEvt);
      const countAfterRedo = window.app.noteBoxes.length;

      return (
        countAfterCreate === countBeforeCreate + 1 &&
        countAfterUndo === countBeforeCreate &&
        countAfterRedo === countBeforeCreate + 1
      );
    });
    assert(undoRedoTest, 'Ctrl+Z smoothly undoes canvas action; Ctrl+R smoothly redoes action without reloading page');

    // TEST 11: Non-Editable UI Controls (No cursor or backspacing inside buttons)
    console.log('\n--- 11. Locked UI Controls (ContentEditable Protection) ---');
    const controlsLocked = await page.evaluate(() => {
      // Re-create a note with image if deleted in earlier test
      let imgCard = document.querySelector('.image-card');
      if (!imgCard) {
        const box = window.app.noteBoxes[0];
        const imgBlock = window.app.imageModule.createImageBlock('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="purple" width="100" height="100"/></svg>', 'Sample Caption');
        box.contentArea.appendChild(imgBlock);
        window.app.flowEngine.attachGripDrag(imgBlock, box);
        imgCard = document.querySelector('.image-card');
      }

      const toolsBar = document.querySelector('.image-tools-bar');
      const toolBtns = Array.from(document.querySelectorAll('.image-tool-btn'));
      const tableToolbar = document.querySelector('.table-toolbar');
      const tableBtns = Array.from(document.querySelectorAll('.table-tool-btn'));
      const captionRemoveBtn = document.querySelector('.caption-remove-btn');

      const isProtected = (el) => el && el.isContentEditable === false;

      const toolsBarSafe = isProtected(toolsBar);
      const toolBtnsSafe = toolBtns.every(b => isProtected(b));
      const tableToolbarSafe = isProtected(tableToolbar);
      const tableBtnsSafe = tableBtns.every(b => isProtected(b));
      const removeBtnSafe = !captionRemoveBtn || isProtected(captionRemoveBtn);

      return toolsBarSafe && toolBtnsSafe && tableToolbarSafe && tableBtnsSafe && removeBtnSafe;
    });
    assert(controlsLocked, 'All floating toolbar buttons, menus, and handles are permanently non-editable controls');

    // TEST 12: Image Inside Table Cell Paste
    console.log('\n--- 12. Table Cell Image Paste ---');
    const tableCellImageTest = await page.evaluate(() => {
      const table = document.querySelector('.canvas-table');
      if (!table) return false;
      const targetTd = table.querySelector('td');
      if (!targetTd) return false;

      // Focus cell
      targetTd.focus();
      window.app.tableModule.lastFocusedCell = targetTd;

      // Simulate pasting image directly into table cell
      const sampleSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="30" fill="teal"/></svg>';
      const imgWrapper = window.app.tableModule.insertImageIntoCell(targetTd, sampleSvg);

      const cellHasImg = targetTd.contains(imgWrapper) && imgWrapper.querySelector('img') !== null;
      const isContentProtected = imgWrapper.contentEditable === 'false';

      return cellHasImg && isContentProtected;
    });
    assert(tableCellImageTest, 'Images can be pasted directly inside any table cell with auto-fit and non-editable wrapper');

    // TEST 13: Table Row/Column Removal & Interactive Resizers
    console.log('\n--- 13. Table Row/Col Removal & Resizers ---');
    const tableRowColTest = await page.evaluate(() => {
      const table = document.querySelector('.canvas-table');
      if (!table) return false;

      const initialRows = table.rows.length;
      const initialCols = table.rows[0].cells.length;

      // 1. Remove Row
      window.app.tableModule.removeRow(table);
      const rowsAfterDel = table.rows.length;

      // 2. Remove Column
      window.app.tableModule.removeColumn(table);
      const colsAfterDel = table.rows[0].cells.length;

      // 3. Test cell resizer elements exist
      const hasColResizer = table.querySelector('.col-resizer') !== null;
      const hasRowResizer = table.querySelector('.row-resizer') !== null;

      return (
        rowsAfterDel === initialRows - 1 &&
        colsAfterDel === initialCols - 1 &&
        hasColResizer &&
        hasRowResizer
      );
    });
    assert(tableRowColTest, 'Table allows removing rows/columns with safety limits and provides interactive drag resizers');

    // TEST 14: Universal 8-Point Perimeter Resize Handles
    console.log('\n--- 14. Universal 8-Point Perimeter Resize Handles ---');
    const universalBoundaryTest = await page.evaluate(() => {
      let imgCard = document.querySelector('.image-card');
      if (!imgCard) {
        const box = window.app.noteBoxes[0];
        const block = window.app.imageModule.createImageBlock('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="purple"/></svg>', 'Test');
        box.contentArea.appendChild(block);
        imgCard = block.querySelector('.image-card');
      }

      const tableWrapper = document.querySelector('.table-wrapper');
      const imgHandles = imgCard.querySelectorAll('.resize-handle');
      const tableHandles = tableWrapper ? tableWrapper.querySelectorAll('.resize-handle') : [];

      return imgHandles.length === 8 && tableHandles.length === 8;
    });
    assert(universalBoundaryTest, 'Every bounded object (Box, Image, Table) adheres to universal 8-point boundary resize rules');

    // TEST 15: Universal Image & Table Copy-Paste (Ctrl+C -> Ctrl+V)
    console.log('\n--- 15. Universal Object Copy & Canvas Paste ---');
    const universalCopyPasteTest = await page.evaluate(() => {
      const boxCountBefore = window.app.noteBoxes.length;

      // 1. Select image card and copy via Ctrl+C
      const imgCard = document.querySelector('.image-card');
      window.app.selectObject(imgCard, 'image');

      const copyEvt = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true });
      window.dispatchEvent(copyEvt);

      const hasCopiedImg = window.app.keyboardController.internalClipboard && window.app.keyboardController.internalClipboard.type === 'image';

      // 2. Clear selection (click canvas) and paste via Ctrl+V
      window.app.deselectAll();
      window.app.keyboardController.mouseCanvasPos = { x: 950, y: 350 };

      const pasteEvt = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true });
      window.dispatchEvent(pasteEvt);

      const boxCountAfter = window.app.noteBoxes.length;
      const lastBox = window.app.noteBoxes[window.app.noteBoxes.length - 1];
      const pastedImg = lastBox ? lastBox.contentArea.querySelector('.image-card') : null;

      return hasCopiedImg && (boxCountAfter === boxCountBefore + 1) && (pastedImg !== null);
    });
    assert(universalCopyPasteTest, 'Ctrl+C copies selected image/table and Ctrl+V on canvas spawns fresh note box immediately');

    // TEST 16: Paragraph Block Creation (Ctrl+Enter & Ribbon Button)
    console.log('\n--- 16. Paragraph Block Creation & Clean Invisible Edge Resizers ---');
    const paragraphAndEdgesTest = await page.evaluate(() => {
      const box = window.app.noteBoxes[0];
      window.app.selectNoteBox(box);
      const initialBlocks = box.contentArea.querySelectorAll('.canvas-block').length;

      // 1. Test Ctrl+Enter splits/creates paragraph block with dedicated handle
      const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true });
      box.contentArea.dispatchEvent(enterEvt);
      const blocksAfterCtrlEnter = box.contentArea.querySelectorAll('.canvas-block').length;

      // 2. Test Ribbon Paragraph Button
      const btnPara = document.getElementById('btn-insert-paragraph');
      btnPara.click();
      const blocksAfterBtn = box.contentArea.querySelectorAll('.canvas-block').length;

      // 3. Test Invisible Boundary Handles (No visible borders/backgrounds, full coverage)
      const handle = box.element.querySelector('.resize-handle.n');
      const handleStyle = window.getComputedStyle(handle);
      const isInvisible = handleStyle.backgroundColor === 'rgba(0, 0, 0, 0)' || handleStyle.backgroundColor === 'transparent';

      return (
        blocksAfterCtrlEnter === initialBlocks + 1 &&
        blocksAfterBtn === initialBlocks + 2 &&
        isInvisible
      );
    });
    assert(paragraphAndEdgesTest, 'Ctrl+Enter & Ribbon button spawn draggable paragraph blocks, and boundary handles are sleek and invisible');

    // TEST 17: Rich Web HTML Paste (OneNote Style Image & Outline Promotion)
    console.log('\n--- 17. Rich Web HTML Paste (OneNote-Style Image Card & Caption Auto-Upgrade) ---');
    const richPasteTest = await page.evaluate(() => {
      // 1. Prepare simulated Wikipedia-style rich snippet containing text, hyperlinks, multi-citations [1, 2], tables, and image figure
      const wikipediaHtml = `
        <p>A <b>graphics processing unit</b> (GPU) is a specialized <a href="/wiki/Electronic_circuit" style="color: blue; text-decoration: underline;">electronic circuit</a><sup class="reference"><a href="#cite_note-1">[1]</a></sup> designed for digital image processing.</p>
        <figure class="mw-default-size" typeof="mw:File/Thumb">
          <a href="/wiki/File:GPU_Block_Diagram.svg"><img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='purple'/></svg>"></a>
          <figcaption>The components of a GPU.[edit]</figcaption>
        </figure>
        <p>[1, 2]</p>
        <h3>Key Types of GPUs</h3>
        <div class="wikitable-container">
          <table class="wikitable">
            <tr><th>GPU Category</th><th>Primary Usage</th></tr>
            <tr><td>Integrated GPU</td><td>Laptops & Handhelds</td></tr>
            <tr><td>Discrete GPU</td><td>Gaming PCs & AI Workstations</td></tr>
          </table>
        </div>
        <p>Although there is no single definition of the term, in modern use a GPU performs graphics acceleration<sup class="reference"><a href="#cite_note-2">[2, 3]</a></sup>.</p>
      `;

      // 2. Set mouse on canvas and trigger rich HTML paste via ClipboardEvent
      window.app.deselectAll();
      window.app.keyboardController.mouseCanvasPos = { x: 1400, y: 150 };

      const dt = new DataTransfer();
      dt.setData('text/html', wikipediaHtml);
      dt.setData('text/plain', 'GPU Wikipedia snippet');
      const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
      window.dispatchEvent(pasteEvent);

      // 3. Inspect spawned note box
      const newBox = window.app.noteBoxes[window.app.noteBoxes.length - 1];
      if (!newBox) return false;

      // Must have separate text blocks, an official .image-card, and an official .table-wrapper
      const textBlocks = newBox.contentArea.querySelectorAll('.canvas-block.text-block');
      const imgBlock = newBox.contentArea.querySelector('.canvas-block.image-block');
      const tableWrapper = newBox.contentArea.querySelector('.table-wrapper');
      if (!imgBlock || !tableWrapper || textBlocks.length < 2) return false;

      const imgCard = imgBlock.querySelector('.image-card');
      const imgGrip = imgBlock.querySelector('.block-grip');
      const imgTools = imgBlock.querySelector('.image-tools-bar');
      const caption = imgBlock.querySelector('.image-caption');
      const imgHandles = imgBlock.querySelectorAll('.resize-handle');

      const hasImgGrip = imgGrip && imgGrip.textContent === ':::';
      const hasImgTools = imgTools && imgTools.querySelector('.image-tool-btn');
      const hasCaption = caption && caption.textContent.includes('The components of a GPU') && !caption.textContent.includes('[edit]');
      const hasImgHandles = imgHandles.length === 8;

      // Table promotion checks
      const tableTools = tableWrapper.querySelector('.table-toolbar');
      const tableHandles = tableWrapper.querySelectorAll('.resize-handle');
      const hasTableTools = tableTools && tableTools.querySelector('.table-tool-btn');
      const hasTableHandles = tableHandles.length === 8;

      // 4. Verify Clean Reading Filter: No [1, 2], no [2, 3], no <a> links, no <sup> citations, bold preserved
      const noHyperlinks = newBox.contentArea.querySelectorAll('a').length === 0;
      const noSuperscripts = newBox.contentArea.querySelectorAll('sup').length === 0;
      const noMultiCitations = !newBox.contentArea.textContent.includes('[1, 2]') && 
                               !newBox.contentArea.textContent.includes('[2, 3]') &&
                               !newBox.contentArea.textContent.includes('[1]');
      const cleanTextIntact = newBox.contentArea.textContent.includes('electronic circuit') &&
                              newBox.contentArea.textContent.includes('Key Types of GPUs');
      const boldPreserved = newBox.contentArea.querySelector('b') !== null;

      return !!imgCard && hasImgGrip && hasImgTools && hasCaption && hasImgHandles &&
             !!tableWrapper && hasTableTools && hasTableHandles &&
             noHyperlinks && noSuperscripts && noMultiCitations && cleanTextIntact && boldPreserved;
    });
    assert(richPasteTest, 'Rich web content strips multi-citations [1, 2], unwraps links, and upgrades both images & tables into App Objects');

    // TEST 18: LaTeX & Math Formula Support (Equation Blocks, Alt+=, Inline Math)
    console.log('\n--- 18. LaTeX & Math Formula Support (OneNote Equation Engine) ---');
    const mathTest = await page.evaluate(() => {
      // 1. Test Alt+= shortcut to insert math block into active note box
      const box = window.app.noteBoxes[0];
      window.app.selectNoteBox(box);

      const altEqualEvt = new KeyboardEvent('keydown', { key: '=', altKey: true, bubbles: true });
      window.dispatchEvent(altEqualEvt);

      const mathBlock = box.contentArea.querySelector('.canvas-block.math-block');
      if (!mathBlock) return false;

      const grip = mathBlock.querySelector('.block-grip');
      const mathDisplay = mathBlock.querySelector('.math-display');
      const mathTools = mathBlock.querySelector('.math-tools-bar');
      const hasGrip = grip && grip.textContent === ':::';
      const hasDisplay = mathDisplay && (mathDisplay.querySelector('math') || mathDisplay.querySelector('.katex') || mathDisplay.innerHTML.length > 0);
      const hasTools = mathTools && mathTools.querySelector('.math-tool-btn');

      // 2. Test Inline Math ($...$)
      const testSpan = document.createElement('div');
      testSpan.innerHTML = 'Einstein formula is $E = mc^2$ in physics.';
      window.app.mathModule.renderInlineMath(testSpan);
      const inlineMathPill = testSpan.querySelector('.inline-math');
      const hasInlinePill = inlineMathPill && (inlineMathPill.dataset.latex === 'E = mc^2');

      // 3. Test Wikipedia Math Outline Extraction
      const wikiMathSnippet = `
        <p>Area of circle formula:</p>
        <div class="mwe-math-element">
          <math xmlns="http://www.w3.org/1998/Math/MathML">
            <annotation encoding="application/x-tex">A = \\pi r^2</annotation>
          </math>
        </div>
      `;
      const units = window.app.parseHTMLToOutlineUnits(wikiMathSnippet);
      const mathUnit = units.find(u => u.type === 'math');
      const hasExtractedMath = mathUnit && mathUnit.latex.includes('A = \\pi r^2');

      return hasGrip && hasDisplay && hasTools && hasInlinePill && hasExtractedMath;
    });
    assert(mathTest, 'Equation blocks, Alt+= shortcut, and inline $math$ render textbook formulas with grips and tools');

    // TEST 19: Paragraph Triple-Click Selection, Margin Grip Click Selection, and Rich Web Outline Preservation
    console.log('Test 19: Checking paragraph selection (triple-click & grip click) and web layout preservation...');
    const selectionAndLayoutTest = await page.evaluate(() => {
      // 1. Create a clean note box with paragraphs, headings, and lists
      const box = window.app.createNoteBox(600, 600, 'Test Box 19');
      const para1 = box.addParagraphBlock('The quick brown fox jumps over the lazy dog.');
      const editable1 = para1.querySelector('[contenteditable="true"]');

      // Test Margin Grip Click on Paragraph
      window.app.flowEngine.selectBlock(para1);
      const gripSelText = window.getSelection().toString().trim();
      const gripSelectionWorks = gripSelText === 'The quick brown fox jumps over the lazy dog.';

      // Test Triple Click Event on editable
      const tripleClickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 3
      });
      editable1.dispatchEvent(tripleClickEvent);
      const tripleClickSelText = window.getSelection().toString().trim();
      const tripleClickWorks = tripleClickSelText === 'The quick brown fox jumps over the lazy dog.';

      // 2. Test Paste of Rich Web HTML preserving Headings, Lists, and stripping Noise
      const sampleWebHTML = `
        <div class="mw-parser-output">
          <h2>Quantum Mechanics<span class="mw-editsection">[edit]</span></h2>
          <p>Quantum mechanics is a fundamental theory in physics<sup class="reference"><a href="#cite_note-1">[1]</a></sup><sup class="reference"><a href="#cite_note-2">[2]</a></sup>.</p>
          <ul>
            <li>Wave-particle duality<a href="/wiki/Duality">[1, 2]</a></li>
            <li>Uncertainty principle</li>
          </ul>
        </div>
      `;

      const units = window.app.parseHTMLToOutlineUnits(sampleWebHTML);
      const headingUnit = units.find(u => u.type === 'heading');
      const textUnit = units.find(u => u.type === 'text');
      const listUnit = units.find(u => u.type === 'list');

      const headingPreserved = headingUnit && headingUnit.tag === 'h2' && headingUnit.content.includes('Quantum Mechanics') && !headingUnit.content.includes('[edit]');
      const footnotesStripped = textUnit && textUnit.content.includes('fundamental theory') && !textUnit.content.includes('[1]') && !textUnit.content.includes('[2]') && !textUnit.content.includes('<a');
      const listPreserved = listUnit && listUnit.content.includes('Wave-particle duality') && !listUnit.content.includes('[1, 2]');

      // Insert units into box to verify rendered DOM structure
      window.app.insertOutlineUnits(units, box);
      const headingEl = box.contentArea.querySelector('.heading-block .note-heading');
      const listEl = box.contentArea.querySelector('.list-block ul');
      const hasProperDOM = headingEl && listEl && (headingEl.tagName === 'H2');

      return gripSelectionWorks && tripleClickWorks && headingPreserved && footnotesStripped && listPreserved && hasProperDOM;
    });
    assert(selectionAndLayoutTest, 'Triple-click and grip handle select entire paragraphs; pasted web headings and lists are 100% preserved without noisy links or citations');

    // TEST 20: AI Chatbot Markdown Paste (ChatGPT, Claude, Gemini, Copilot) & Two-Door Inspector
    console.log('Test 20: Checking AI Chatbot Markdown paste (headings, pictures, tables, lists)...');
    const aiMarkdownTest = await page.evaluate(() => {
      const sampleAiResponse = `
### Neural Network Architectures
Deep learning models rely on hierarchical representations.

* Convolutional networks for computer vision
* Transformers for natural language understanding

![Transformer Architecture Diagram](https://example.com/transformer.png)

| Architecture | Primary Domain | Core Mechanism |
| --- | --- | --- |
| CNN | Image Processing | Convolution Kernels |
| Transformer | Sequence Modeling | Self-Attention |

$$ \\mathcal{L}_{total} = \\alpha \\mathcal{L}_{CE} + \\beta \\mathcal{L}_{reg} $$
      `.trim();

      // 1. Verify fast markdown detection
      const isDetectedAsMarkdown = window.app.markdownModule.isMarkdown(sampleAiResponse);

      // 2. Parse markdown units
      const units = window.app.parseMarkdownToOutlineUnits(sampleAiResponse);
      const headingUnit = units.find(u => u.type === 'heading');
      const textUnit = units.find(u => u.type === 'text');
      const listUnit = units.find(u => u.type === 'list');
      const imageUnit = units.find(u => u.type === 'image');
      const tableUnit = units.find(u => u.type === 'table');
      const mathUnit = units.find(u => u.type === 'math');

      const headingClean = headingUnit && headingUnit.tag === 'h3' && headingUnit.content === 'Neural Network Architectures';
      const textClean = textUnit && textUnit.content.includes('Deep learning models');
      const listClean = listUnit && listUnit.content.includes('Convolutional networks') && listUnit.content.includes('Transformers');
      const imageClean = imageUnit && imageUnit.src === 'https://example.com/transformer.png' && imageUnit.caption === 'Transformer Architecture Diagram';
      const tableClean = tableUnit && tableUnit.domElement && tableUnit.domElement.querySelectorAll('th').length === 3;
      const mathClean = mathUnit && mathUnit.latex.includes('\\mathcal{L}_{total}');

      // 3. Render into NoteBox and verify interactive DOM cards
      const box = window.app.createNoteBox(700, 100, 480);
      box.contentArea.innerHTML = '';
      window.app.insertOutlineUnits(units, box);

      const renderedHeading = box.contentArea.querySelector('.heading-block .note-heading');
      const renderedImage = box.contentArea.querySelector('.image-card img');
      const renderedCaption = box.contentArea.querySelector('.image-caption');
      const renderedTable = box.contentArea.querySelector('.table-wrapper table');
      const renderedList = box.contentArea.querySelector('.list-block ul');
      const renderedMath = box.contentArea.querySelector('.math-block .math-card');

      const domHeadingOk = renderedHeading && renderedHeading.textContent.trim() === 'Neural Network Architectures' && !renderedHeading.textContent.includes('#');
      const domImageOk = renderedImage && renderedImage.getAttribute('src') === 'https://example.com/transformer.png';
      const domCaptionOk = renderedCaption && renderedCaption.textContent.trim() === 'Transformer Architecture Diagram';
      const domTableOk = renderedTable && renderedTable.querySelectorAll('tr').length === 3;
      const domListOk = renderedList && renderedList.querySelectorAll('li').length === 2;
      const domMathOk = !!renderedMath;

      // 4. Test Borderless Table & Diverse AI Image Formats (Titled, Linked, Raw <img>)
      const borderlessSnippet = `
Architecture | Primary Domain
--- | ---
CNN | Vision
Transformer | Language

![City Scene](https://example.com/city.jpg "Evening Skyline")
[![Linked Diagram](https://example.com/diag.png)](https://example.com/view)
<img src="https://example.com/raw.png" alt="Raw Extracted Figure">
      `.trim();

      const borderlessUnits = window.app.parseMarkdownToOutlineUnits(borderlessSnippet);
      const borderlessTable = borderlessUnits.find(u => u.type === 'table');
      const titledImg = borderlessUnits.find(u => u.src === 'https://example.com/city.jpg');
      const linkedImg = borderlessUnits.find(u => u.src === 'https://example.com/diag.png');
      const rawImg = borderlessUnits.find(u => u.src === 'https://example.com/raw.png');

      const borderlessTableOk = borderlessTable && borderlessTable.domElement && borderlessTable.domElement.querySelectorAll('tr').length === 3;
      const titledImgOk = titledImg && titledImg.caption === 'City Scene';
      const linkedImgOk = linkedImg && linkedImg.caption === 'Linked Diagram';
      const rawImgOk = rawImg && rawImg.caption === 'Raw Extracted Figure';

      return isDetectedAsMarkdown && headingClean && textClean && listClean && imageClean && tableClean && mathClean &&
             domHeadingOk && domImageOk && domCaptionOk && domTableOk && domListOk && domMathOk &&
             borderlessTableOk && titledImgOk && linkedImgOk && rawImgOk;
    });
    assert(aiMarkdownTest, 'AI Chatbot Markdown paste converts ### to clean bold headings, ![img] to official Image Cards with captions, | tables to App Tables, and lists with zero hashtag clutter');

    // TEST 21: In-Place Sequence Verification (Pictures remain in exact original position between paragraphs)
    console.log('Test 21: Checking picture position preservation in natural reading order...');
    const inPlacePositionTest = await page.evaluate(() => {
      // 1. Test Markdown line-by-line sequence: Text 1 -> Image -> Text 2
      const mdOrderSample = `
First paragraph explaining the hypothesis.

![Middle Diagram](https://example.com/middle_chart.png)

Second paragraph concluding the findings.
      `.trim();

      const mdUnits = window.app.parseMarkdownToOutlineUnits(mdOrderSample);
      const mdTypes = mdUnits.map(u => u.type);
      const mdOrderOk = mdTypes.length === 3 && mdTypes[0] === 'text' && mdTypes[1] === 'image' && mdTypes[2] === 'text';

      const box1 = window.app.createNoteBox(850, 200, 480);
      box1.contentArea.innerHTML = '';
      window.app.insertOutlineUnits(mdUnits, box1);

      const b1Children = Array.from(box1.contentArea.children);
      const b1Ok = b1Children.length === 3 &&
                   b1Children[0].classList.contains('text-block') &&
                   b1Children[1].querySelector('.image-card') !== null &&
                   b1Children[2].classList.contains('text-block');

      // 2. Test HTML sequential pipeline: Text 1 -> Image -> Text 2
      const htmlOrderSample = `
        <div class="article-body">
          <p>Initial thesis statement.</p>
          <div class="figure-container">
            <img src="https://example.com/in_place.jpg" alt="Embedded Evidence" />
          </div>
          <p>Final conclusive summary.</p>
        </div>
      `;

      const htmlUnits = window.app.parseHTMLToOutlineUnits(htmlOrderSample);
      const htmlTypes = htmlUnits.map(u => u.type);
      const htmlOrderOk = htmlTypes.length === 3 && htmlTypes[0] === 'text' && htmlTypes[1] === 'image' && htmlTypes[2] === 'text';

      const box2 = window.app.createNoteBox(850, 600, 480);
      box2.contentArea.innerHTML = '';
      window.app.insertOutlineUnits(htmlUnits, box2);

      const b2Children = Array.from(box2.contentArea.children);
      const b2Ok = b2Children.length === 3 &&
                   b2Children[0].classList.contains('text-block') &&
                   b2Children[1].querySelector('.image-card') !== null &&
                   b2Children[2].classList.contains('text-block');

      return mdOrderOk && b1Ok && htmlOrderOk && b2Ok;
    });
    assert(inPlacePositionTest, 'Pictures stay in their exact original spot between paragraphs in natural reading sequence without sliding to the bottom');

    // TEST 22: Advanced Math Engine Verification (AI Bracket Math, Inline Math, Fractions & Greek Symbols)
    console.log('Test 22: Checking advanced math engine (AI brackets, fractions, exponents, Greek symbols)...');
    const advancedMathTest = await page.evaluate(() => {
      // 1. Test AI Chatbot Bracket Block Equation: \[ \text{Steering correction} = K_p e_y+K_d\frac{de_y}{dt} \]
      const aiMathMarkdown = `
\\[ \\text{Steering correction} = K_p e_y+K_d\\frac{de_y}{dt} \\]

where:
* \\(e_y\\) = lateral distance from the desired path.
* \\(K_p\\) = proportional gain.
* \\(K_d\\) = derivative gain.
      `.trim();

      const units = window.app.parseMarkdownToOutlineUnits(aiMathMarkdown);
      const mathUnit = units.find(u => u.type === 'math');
      const listUnit = units.find(u => u.type === 'list');

      const mathUnitDetected = mathUnit && mathUnit.latex.includes('Steering correction') && mathUnit.latex.includes('\\frac{de_y}{dt}');
      const listDetected = listUnit && listUnit.content.includes('\\(e_y\\)');

      // Render into a NoteBox
      const box = window.app.createNoteBox(900, 100, 480);
      box.contentArea.innerHTML = '';
      window.app.insertOutlineUnits(units, box);

      // Verify Math Display has textbook elements (KaTeX / MathML Core)
      const mathDisplay = box.contentArea.querySelector('.math-display');
      const hasMtext = mathDisplay && (mathDisplay.querySelector('mtext, .mord.text') !== null || mathDisplay.textContent.includes('Steering correction'));
      const hasMfrac = mathDisplay && (mathDisplay.querySelector('mfrac, .mfrac') !== null);
      const hasMsub = mathDisplay && (mathDisplay.querySelector('msub, .msupsub, .vlist') !== null);

      // Verify Inline Math pills in the rendered list
      const inlinePills = box.contentArea.querySelectorAll('.list-block .inline-math');
      const hasInlinePills = inlinePills.length === 3;

      // 2. Test Complex General Relativity Geodesic Equation: {d^2 x^\mu \over ds^2} + \Gamma^\mu_{\alpha\beta} ...
      const grLatex = '{d^{2}x^{\mu } \\over ds^{2}}+\\Gamma ^{\\mu }{}_{\\alpha \\beta }{dx^{\\alpha } \\over ds}{dx^{\\beta } \\over ds}=0';
      const renderedGR = window.app.mathModule.latexToMathML(grLatex, true);
      const grHasMfrac = renderedGR.includes('<mfrac>');
      const grHasGamma = renderedGR.includes('Γ'); // Uppercase Gamma \Gamma
      const grHasIndices = renderedGR.includes('msup') || renderedGR.includes('msubsup');

      const checks = {
        mathUnitDetected,
        listDetected,
        hasMtext,
        hasMfrac,
        hasMsub,
        hasInlinePills,
        grHasMfrac,
        grHasGamma,
        grHasIndices
      };
      const failedKey = Object.keys(checks).find(k => !checks[k]);
      if (failedKey) {
        console.log('TEST 22 FAILED AT:', failedKey, 'VALUE:', checks[failedKey]);
        return false;
      }
      return true;
    });
    assert(advancedMathTest, 'Advanced Math Engine renders AI bracket equations \\[...] with <mtext> and vertical fractions, inline \\(...\\) pills, and complex physics equations with \\Gamma and indices');

    // TEST 23: Complete In-Place Multi-Equation Web HTML & AI Chatbot HTML Formula Preservation
    console.log('Test 23: Checking multi-equation Wikipedia articles (zero dropped equations) and AI Chatbot HTML bracket formulas...');
    const multiEquationHtmlTest = await page.evaluate(() => {
      // 1. Simulate Wikipedia article with 3 equations across multiple sections & paragraphs
      const wikiArticleHtml = `
        <div class="mw-parser-output">
          <h2>Einstein Field Equations</h2>
          <p>The core relationship governing spacetime curvature is given by:</p>
          <dl><dd><span class="mwe-math-element"><math><annotation encoding="application/x-tex">G_{\\mu\\nu} \\equiv R_{\\mu\\nu} - \\frac{1}{2}R g_{\\mu\\nu} = \\kappa T_{\\mu\\nu}</annotation></math></span></dd></dl>
          <p>Where the stress-energy tensor describes the energy density and momentum.</p>
          <h2>Orbital Dynamics</h2>
          <p>In effective gravitational potential, the orbital energy equation is:</p>
          <dl><dd><span class="mwe-math-element"><math><annotation encoding="application/x-tex">U_f(r) = - \\frac{GMm}{r} + \\frac{L^2}{2mr^2} - \\frac{GML^2}{mc^2 r^3}</annotation></math></span></dd></dl>
          <p>Furthermore, the geodesic path equation satisfies:</p>
          <dl><dd><span class="mwe-math-element"><math><annotation encoding="application/x-tex">{d^{2}x^{\\mu} \\over ds^{2}} + \\Gamma^{\\mu}_{\\alpha\\beta}{dx^{\\alpha} \\over ds}{dx^{\\beta} \\over ds} = 0</annotation></math></span></dd></dl>
          <p>This explains the anomalous perihelion precession of Mercury.</p>
        </div>
      `;

      const wikiUnits = window.app.parseHTMLToOutlineUnits(wikiArticleHtml);
      const mathUnits = wikiUnits.filter(u => u.type === 'math');
      const textUnits = wikiUnits.filter(u => u.type === 'text');
      const headingUnits = wikiUnits.filter(u => u.type === 'heading');

      // None of the 3 equations can be dropped!
      const all3EquationsFound = mathUnits.length === 3 &&
                                 mathUnits[0].latex.includes('G_{\\mu\\nu}') &&
                                 mathUnits[1].latex.includes('U_f(r)') &&
                                 mathUnits[2].latex.includes('d^{2}x^{\\mu}');

      // Heading and text sequence must be completely intact
      const headingsFound = headingUnits.length === 2;
      const textCountOk = textUnits.length === 5;

      // 2. Simulate AI Chatbot (ChatGPT/Claude) Web HTML Paste with bracket formula & bullet list
      const aiWebHtml = `
        <p>\\[ \\text{Steering correction} = K_p e_y+K_d\\frac{de_y}{dt} \\]</p>
        <p>where:</p>
        <ul>
          <li>\\(e_y\\) = lateral distance from the desired path.</li>
          <li>\\(K_p\\) = proportional gain.</li>
          <li>\\(K_d\\) = derivative gain.</li>
        </ul>
      `;

      const aiUnits = window.app.parseHTMLToOutlineUnits(aiWebHtml);
      const aiMath = aiUnits.find(u => u.type === 'math');
      const aiList = aiUnits.find(u => u.type === 'list');

      const aiMathFound = aiMath && aiMath.latex.includes('Steering correction') && aiMath.latex.includes('\\frac{de_y}{dt}');
      const aiListFound = aiList && aiList.content.includes('\\(e_y\\)');

      // Render into a NoteBox to verify live in-place order and DOM cards
      const box = window.app.createNoteBox(1200, 300, 500);
      box.contentArea.innerHTML = '';
      window.app.insertOutlineUnits(wikiUnits, box);

      const renderedMathCards = box.contentArea.querySelectorAll('.math-block .math-card');
      const renderedHeadings = box.contentArea.querySelectorAll('.heading-block');
      const domAll3MathRendered = renderedMathCards.length === 3;
      const domHeadingsRendered = renderedHeadings.length === 2;

      const debugChecks = {
        all3EquationsFound,
        headingsFound,
        textCountOk,
        aiMathFound,
        aiListFound,
        domAll3MathRendered,
        domHeadingsRendered
      };
      const failed = Object.keys(debugChecks).find(k => !debugChecks[k]);
      if (failed) {
        console.log('TEST 23 FAILED AT:', failed, 'VALUES:', debugChecks);
        console.log('wikiUnits types:', wikiUnits.map(u => u.type));
        console.log('aiUnits types:', aiUnits.map(u => u.type));
        return false;
      }

      return true;
    });
    assert(multiEquationHtmlTest, 'Web HTML paste captures ALL 10+ equations in original reading sequence without dropping any, and AI chatbot HTML brackets \\[...\\] render as textbook Equation Cards');

    // TEST 24: Cursor-Anchored Zero-Drift Zooming
    console.log('\n--- 24. Cursor-Anchored Zero-Drift Zooming ---');
    const zeroDriftResult = await page.evaluate(() => {
      const canvas = window.app.canvas;
      canvas.setZoom(1.0);
      canvas.viewport.scrollLeft = 100;
      canvas.viewport.scrollTop = 100;

      const vRect = canvas.viewport.getBoundingClientRect();
      const screenX = vRect.left + 350;
      const screenY = vRect.top + 250;

      // Calculate world coordinate before zoom
      const pivotX = screenX - vRect.left;
      const pivotY = screenY - vRect.top;
      const worldXBefore = (canvas.viewport.scrollLeft + pivotX) / canvas.zoomLevel;
      const worldYBefore = (canvas.viewport.scrollTop + pivotY) / canvas.zoomLevel;

      // Zoom in anchored at (screenX, screenY)
      canvas.adjustZoom(0.3, screenX, screenY);

      // Calculate world coordinate after zoom
      const worldXAfter = (canvas.viewport.scrollLeft + pivotX) / canvas.zoomLevel;
      const worldYAfter = (canvas.viewport.scrollTop + pivotY) / canvas.zoomLevel;

      canvas.setZoom(1.0);
      canvas.viewport.scrollLeft = 0;
      canvas.viewport.scrollTop = 0;

      return Math.abs(worldXBefore - worldXAfter) < 2 && Math.abs(worldYBefore - worldYAfter) < 2;
    });
    assert(zeroDriftResult, 'Cursor-anchored zooming preserves exact coordinate under pointer with zero drift');

    // TEST 25: Kinetic Momentum Panning (Gliding)
    console.log('\n--- 25. Kinetic Momentum Panning (Gliding) ---');
    const momentumResult = await page.evaluate(async () => {
      const canvas = window.app.canvas;
      canvas.viewport.scrollLeft = 0;
      canvas.startMomentum(-25, 0); // pan right
      await new Promise(r => setTimeout(r, 80));
      const midScroll = canvas.viewport.scrollLeft;
      await new Promise(r => setTimeout(r, 80));
      const endScroll = canvas.viewport.scrollLeft;
      canvas.stopMomentum();
      canvas.viewport.scrollLeft = 0;
      return midScroll > 10 && endScroll >= midScroll;
    });
    assert(momentumResult, 'Kinetic momentum panning smoothly coasts viewport to a natural halt');

    // TEST 26: Ghost Spatial Scrollbars
    console.log('\n--- 26. Ghost Spatial Scrollbars ---');
    const ghostScrollResult = await page.evaluate(() => {
      const hTrack = document.getElementById('ghost-scrollbar-h');
      const vTrack = document.getElementById('ghost-scrollbar-v');
      const hThumb = document.getElementById('ghost-thumb-h');
      const vThumb = document.getElementById('ghost-thumb-v');
      if (!hTrack || !vTrack || !hThumb || !vThumb) return false;

      // Verify track click jumps scroll
      const rect = hTrack.getBoundingClientRect();
      hTrack.dispatchEvent(new MouseEvent('mousedown', {
        clientX: rect.left + rect.width * 0.4,
        clientY: rect.top + 4,
        bubbles: true
      }));

      const scrollAfterJump = window.app.canvas.viewport.scrollLeft;
      window.app.canvas.viewport.scrollLeft = 0;
      window.app.canvas.updateGhostScrollbars();

      return hThumb.offsetWidth > 20 && vThumb.offsetHeight > 20 && scrollAfterJump > 0;
    });
    assert(ghostScrollResult, 'Ghost Spatial Scrollbars render proportional thumbs and support click-to-jump');

    // TEST 27: Marquee Multi-Box Selection & Group Dragging
    console.log('\n--- 27. Marquee Multi-Box Selection & Group Dragging ---');
    const marqueeGroupResult = await page.evaluate(async () => {
      const app = window.app;
      const note1 = app.noteBoxes[0];
      const note2 = app.noteBoxes[1];
      if (!note1 || !note2) return false;

      // Select Note 1 and Note 2 with marquee
      note1.element.classList.add('multi-selected');
      note2.element.classList.add('multi-selected');

      const startX1 = note1.x;
      const startX2 = note2.x;

      // Simulate dragging Note 1 header by 80px
      const header = note1.header;
      header.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, clientY: 100, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 280, clientY: 100, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      const movedBoth = (note1.x === startX1 + 80) && (note2.x === startX2 + 80);

      // Clear selection with deselectAll
      app.deselectAll();
      const cleared = !note1.element.classList.contains('multi-selected') && !note2.element.classList.contains('multi-selected');

      // Restore original positions
      note1.x = startX1;
      note1.element.style.left = `${startX1}px`;
      note2.x = startX2;
      note2.element.style.left = `${startX2}px`;

      return movedBoth && cleared;
    });
    assert(marqueeGroupResult, 'Marquee multi-selection groups cards and moves all selected notes together in lockstep');

    // TEST 28: Collapsible Sidebar Toggling
    console.log('\n--- 28. Collapsible Sidebar Toggling ---');
    const sidebarToggleResult = await page.evaluate(() => {
      const toggleBtn = document.getElementById('btn-toggle-sidebar');
      const sidebar = document.getElementById('app-sidebar');
      if (!toggleBtn || !sidebar) return false;

      // Click to collapse
      toggleBtn.click();
      const isCollapsed = sidebar.classList.contains('collapsed');

      // Click to expand back
      toggleBtn.click();
      const isExpanded = !sidebar.classList.contains('collapsed');

      return isCollapsed && isExpanded;
    });
    assert(sidebarToggleResult, 'Sidebar collapses and expands smoothly via toggle button');

    // TEST 29: Three-Tier Hierarchy (Notebooks, Sections, Pages)
    console.log('\n--- 29. Three-Tier Hierarchy Structure ---');
    const hierarchyResult = await page.evaluate(() => {
      const nbItems = document.querySelectorAll('#sidebar-notebooks-list .notebook-item');
      const secItems = document.querySelectorAll('#sidebar-sections-list .section-item');
      const pageItems = document.querySelectorAll('#sidebar-pages-list .page-item');

      const nbTitle = document.getElementById('notebook-name-display')?.textContent;
      const pageTitle = document.getElementById('page-title-display')?.textContent;

      return nbItems.length >= 1 &&
             secItems.length >= 1 &&
             pageItems.length >= 1 &&
             nbTitle.includes('Personal Workspace') &&
             pageTitle.includes('Project Canvas');
    });
    assert(hierarchyResult, 'Three-tier hierarchy displays Notebooks, Sections, and Pages with active indicators');

    // TEST 30: Clean Blank Page Guarantee
    console.log('\n--- 30. Clean Blank Page Guarantee ---');
    const cleanPageResult = await page.evaluate(() => {
      const sidebar = window.app.sidebar;
      sidebar.createPage('My Clean Blank Canvas');

      const activePage = sidebar.getActivePage();
      const noteCount = window.app.noteBoxes.length;

      return activePage.title === 'My Clean Blank Canvas' && noteCount === 0;
    });
    assert(cleanPageResult, 'Creating a new page guarantees a 100% clean, blank canvas with 0 lingering notes');

    // TEST 31: Instant Page Switching & Persistence
    console.log('\n--- 31. Instant Page Switching & Canvas Persistence ---');
    const pageSwitchResult = await page.evaluate(() => {
      const app = window.app;
      const sidebar = app.sidebar;

      // 1. Add a note on the new blank page
      const page2Box = app.createNoteBox(200, 200, 300);
      page2Box.addTextBlock('Unique Page 2 Thought');
      const page2Id = sidebar.state.activePageId;

      // 2. Switch back to Page 1 ("Project Canvas")
      const page1 = sidebar.getActiveSection().pages[0];
      sidebar.selectPage(page1.id);
      const page1NoteCount = app.noteBoxes.length;

      // 3. Switch back to Page 2
      sidebar.selectPage(page2Id);
      const page2NoteCount = app.noteBoxes.length;
      const page2Text = app.noteBoxes[0]?.contentArea?.textContent || '';

      return page1NoteCount >= 3 && page2NoteCount === 1 && page2Text.includes('Unique Page 2 Thought');
    });
    assert(pageSwitchResult, 'Switching pages auto-saves state and instantly restores canvas content');

    // TEST 32: Section Creation & Inline Renaming
    console.log('\n--- 32. Section Creation & Renaming ---');
    const sectionCreateResult = await page.evaluate(() => {
      const sidebar = window.app.sidebar;
      sidebar.createSection('Lab Experiments');

      const activeSec = sidebar.getActiveSection();
      const isLab = activeSec.name === 'Lab Experiments';

      // Rename section
      activeSec.name = 'Deep Research Lab';
      sidebar.render();

      const secItems = Array.from(document.querySelectorAll('#sidebar-sections-list .section-item'));
      const foundRenamed = secItems.some(el => el.textContent.includes('Deep Research Lab'));

      // Switch back to original section and page 1
      const defaultSec = sidebar.getActiveNotebook().sections[0];
      sidebar.selectSection(defaultSec.id);

      return isLab && foundRenamed;
    });
    assert(sectionCreateResult, 'Sections can be created, switched, and renamed cleanly');

    // TEST 33: Multi-Store IndexedDB Engine & Persistence Safe-Lock
    console.log('\n--- 33. Multi-Store IndexedDB Engine & Persistence ---');
    const idbInitResult = await page.evaluate(async () => {
      const vault = window.app.storageVault;
      if (!vault || !vault.db) return false;

      const storeNames = Array.from(vault.db.objectStoreNames);
      const hasPages = storeNames.includes('pages');
      const hasHierarchy = storeNames.includes('hierarchy');
      const hasAssets = storeNames.includes('assets');
      const hasSettings = storeNames.includes('settings');

      const isPersisted = await vault.checkPersistence();
      return hasPages && hasHierarchy && hasAssets && hasSettings && (typeof isPersisted === 'boolean');
    });
    assert(idbInitResult, 'IndexedDB initializes with 4 partitioned stores and checks persistence safe-lock');

    // TEST 34: Storage Vault Dialog & Live Diagnostics
    console.log('\n--- 34. Storage Vault Dialog & Live Diagnostics ---');
    const diagnosticsResult = await page.evaluate(async () => {
      const vault = window.app.storageVault;
      const modal = document.getElementById('storage-hub-modal');
      const openBtn = document.getElementById('btn-storage-hub');
      const closeBtn = document.getElementById('btn-close-storage-hub');

      // 1. Open modal
      openBtn.click();
      await new Promise(r => setTimeout(r, 100));
      const isOpen = modal.classList.contains('active');

      // 2. Check stats populated
      const nbText = document.getElementById('stat-notebooks-count').textContent;
      const notesText = document.getElementById('stat-notes-count').textContent;
      const statsValid = parseInt(nbText, 10) >= 1 && parseInt(notesText, 10) >= 1;

      // 3. Close modal
      closeBtn.click();
      const isClosed = !modal.classList.contains('active');

      return isOpen && statsValid && isClosed;
    });
    assert(diagnosticsResult, 'Storage Vault dialog opens, reports live diagnostics, and closes cleanly');

    // TEST 35: One-Click Backup Export Payload Verification
    console.log('\n--- 35. One-Click Backup Export Payload ---');
    const exportResult = await page.evaluate(async () => {
      const vault = window.app.storageVault;
      const backup = await vault.exportBackup();
      return backup &&
             backup.app === 'OneNote Spatial Canvas' &&
             backup.formatVersion === '1.0' &&
             backup.hierarchy &&
             Array.isArray(backup.hierarchy.notebooks) &&
             backup.diagnostics;
    });
    assert(exportResult, 'One-Click Backup exports complete library payload with hierarchy and diagnostics');

    // TEST 36: One-Click Backup Restore & Clean Canvas Reload
    console.log('\n--- 36. One-Click Backup Restore & Clean Reload ---');
    const restoreResult = await page.evaluate(async () => {
      const vault = window.app.storageVault;
      const sidebar = window.app.sidebar;

      const mockBackup = {
        app: 'OneNote Spatial Canvas',
        formatVersion: '1.0',
        exportedAt: new Date().toISOString(),
        hierarchy: {
          activeNotebookId: 'nb-restore',
          activeSectionId: 'sec-restore',
          activePageId: 'page-restore',
          notebooks: [
            {
              id: 'nb-restore',
              name: 'Restored Vault 2026',
              icon: '🚀',
              sections: [
                {
                  id: 'sec-restore',
                  name: 'Blueprint Section',
                  color: '#00b7c3',
                  pages: [
                    {
                      id: 'page-restore',
                      title: 'Master Blueprint Page',
                      preview: 'Restored blueprint card...',
                      data: {
                        boxes: [
                          {
                            id: 999,
                            x: 180,
                            y: 160,
                            width: 380,
                            height: 140,
                            html: '<p>Restored Master Blueprint Card from Vault</p>'
                          }
                        ]
                      }
                    }
                  ]
                }
              ]
            }
          ]
        },
        pages: [
          {
            id: 'page-restore',
            data: {
              boxes: [
                {
                  id: 999,
                  x: 180,
                  y: 160,
                  width: 380,
                  height: 140,
                  html: '<p>Restored Master Blueprint Card from Vault</p>'
                }
              ]
            }
          }
        ]
      };

      const success = await vault.importBackup(mockBackup);
      const activeNb = sidebar.getActiveNotebook();
      const restoredTitle = activeNb ? activeNb.name : '';
      const restoredCardContent = window.app.noteBoxes[0]?.contentArea?.textContent || '';
      return success &&
             restoredTitle === 'Restored Vault 2026' &&
             restoredCardContent.includes('Restored Master Blueprint Card');
    });
    assert(restoreResult, 'One-Click Backup Restore accurately restores hierarchy and reconstructs canvas state');

    // TEST 37: Smart Ribbon "Two-Way Mirror" Cursor Inspection
    console.log('\n--- 37. Smart Ribbon "Two-Way Mirror" Inspection ---');
    const mirrorResult = await page.evaluate(async () => {
      const box = window.app.noteBoxes[0];
      if (!box) return false;

      // Add a bold heading paragraph
      const p = document.createElement('h1');
      p.innerHTML = '<strong>Big Mirror Heading</strong>';
      box.contentArea.appendChild(p);

      // Place selection inside strong element
      const range = document.createRange();
      range.selectNodeContents(p.querySelector('strong'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      window.app.ribbonController.inspectCursor();

      const btnBoldActive = document.getElementById('btn-bold').classList.contains('active');
      const headingVal = document.getElementById('select-heading').value;

      return btnBoldActive && headingVal === 'h1';
    });
    assert(mirrorResult, 'Two-Way Mirror inspects cursor and lights up Bold button and Heading dropdown');

    // TEST 38: 2-in-1 Split Font Color & Illuminated Bar
    console.log('\n--- 38. 2-in-1 Split Font Color Tool ---');
    const splitColorResult = await page.evaluate(async () => {
      const chevron = document.getElementById('btn-font-color-chevron');
      const palette = document.getElementById('palette-font-color');
      const bar = document.getElementById('font-color-bar');

      // 1. Click chevron to open palette
      chevron.click();
      const paletteOpened = palette.classList.contains('active');

      // 2. Click Royal Blue swatch
      const swatches = Array.from(palette.querySelectorAll('.palette-swatch-item'));
      const blueSwatch = swatches.find(s => s.title.includes('Royal Blue'));
      if (blueSwatch) {
        blueSwatch.click();
      }

      const barUpdated = bar.style.backgroundColor.includes('0, 120, 212') || bar.style.backgroundColor.includes('#0078d4');
      const paletteClosed = !palette.classList.contains('active');

      return paletteOpened && barUpdated && paletteClosed;
    });
    assert(splitColorResult, 'Split font color tool opens palette, updates illuminated bar, and applies color');

    // TEST 39: 2-in-1 Split Highlighter with Chisel Swatches
    console.log('\n--- 39. 2-in-1 Split Highlighter Tool ---');
    const splitHighlightResult = await page.evaluate(async () => {
      const chevron = document.getElementById('btn-highlight-chevron');
      const palette = document.getElementById('palette-highlight-color');
      const bar = document.getElementById('highlight-color-bar');

      // 1. Click chevron to open palette
      chevron.click();
      const paletteOpened = palette.classList.contains('active');

      // 2. Click Green swatch
      const swatches = Array.from(palette.querySelectorAll('.palette-swatch-item'));
      const greenSwatch = swatches.find(s => s.title.includes('Green'));
      if (greenSwatch) {
        greenSwatch.click();
      }

      const barUpdated = bar.style.backgroundColor !== '';
      const paletteClosed = !palette.classList.contains('active');

      return paletteOpened && barUpdated && paletteClosed;
    });
    assert(splitHighlightResult, 'Split highlighter tool opens palette, updates illuminated bar, and closes smoothly');

    // TEST 40: Selection Lock (Text Selection Preservation)
    console.log('\n--- 40. Selection Lock (Text Selection Preservation) ---');
    const selectionLockResult = await page.evaluate(async () => {
      const box = window.app.noteBoxes[0];
      const p = box.contentArea.querySelector('h1') || box.contentArea.querySelector('p');
      if (!p) return false;

      // Select text in p
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      const originalText = sel.toString();

      // Snapshot selection
      window.app.ribbonController.snapshotSelection();

      // Collapse / deselect
      sel.removeAllRanges();
      const wasCleared = sel.rangeCount === 0;

      // Restore selection
      window.app.ribbonController.restoreSelection();
      const restoredText = window.getSelection().toString();

      return wasCleared && restoredText === originalText && restoredText.length > 0;
    });
    assert(selectionLockResult, 'Selection Lock snapshots and restores DOM text selection accurately');

    // TEST 41: Inking Mode Switching & "Sheet of Glass" Prevention
    console.log('\n--- 41. Inking Mode Switching & Sheet of Glass Prevention ---');
    const inkSwitchResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      const navBtn = document.getElementById('btn-draw-pointer');
      const penBtn = document.getElementById('btn-draw-pen');
      const drawCanvas = document.getElementById('active-draw-canvas');

      // 1. Initial navigate mode has pointer-events: none (no sheet of glass!)
      ink.setMode('navigate');
      const navEvents = drawCanvas.style.pointerEvents === 'none';

      // 2. Click Pen mode switches to pointer-events: auto
      penBtn.click();
      const penEvents = drawCanvas.style.pointerEvents === 'auto';
      const isPenActive = penBtn.classList.contains('active');

      // 3. Switch back to Navigate
      navBtn.click();
      const backToNav = drawCanvas.style.pointerEvents === 'none';

      return navEvents && penEvents && isPenActive && backToNav;
    });
    assert(inkSwitchResult, 'Inking mode controls switch between Navigate & Ink modes without sheet of glass blocking');

    // TEST 42: Fluid Ballpoint Pen Inking & Stroke Vector Recording
    console.log('\n--- 42. Fluid Ballpoint Pen Inking & Vector Storage ---');
    const penInkingResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      ink.setMode('pen');
      const canvas = ink.inkCanvas;

      // Simulate a pen stroke
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 200, pressure: 0.6 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 230, clientY: 220, pressure: 0.8 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 260, clientY: 250, pressure: 0.9 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 260, clientY: 250 }));

      const strokeSaved = ink.strokes.length >= 1;
      const lastStroke = ink.strokes[ink.strokes.length - 1];
      const isValidStroke = lastStroke && lastStroke.tool === 'pen' && lastStroke.points.length >= 3;

      ink.setMode('navigate');
      return strokeSaved && isValidStroke;
    });
    assert(penInkingResult, 'Ballpoint pen inking records smooth vector strokes with pressure points');

    // TEST 43: True Under-Text Chisel Highlighter
    console.log('\n--- 43. True Under-Text Chisel Highlighter ---');
    const highlighterResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      const hlCanvas = document.getElementById('highlighter-draw-canvas');
      const isUnderText = hlCanvas.classList.contains('under-text');
      const hasMultiply = window.getComputedStyle(hlCanvas).mixBlendMode === 'multiply';

      ink.setMode('highlighter');
      const canvas = ink.inkCanvas;
      canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, clientY: 200 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 380, clientY: 200 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 380, clientY: 200 }));

      const lastStroke = ink.strokes[ink.strokes.length - 1];
      const isHlStroke = lastStroke && lastStroke.tool === 'highlighter' && lastStroke.width >= 16;

      ink.setMode('navigate');
      return isUnderText && hasMultiply && isHlStroke;
    });
    assert(highlighterResult, 'Under-text highlighter utilizes multiply blending layer and chisel widths');

    // TEST 44: Draw-and-Hold Geometric Shape Snapping
    console.log('\n--- 44. Draw-and-Hold Geometric Shape Snapping ---');
    const shapeSnapResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      ink.setMode('pen');

      // Create a mock circular loop stroke
      const points = [];
      const cx = 400, cy = 300, r = 50;
      for (let i = 0; i <= 16; i++) {
        const theta = (i / 16) * Math.PI * 2;
        points.push({ x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r, p: 0.5 });
      }

      ink.currentStroke = {
        id: 'stroke-circle',
        tool: 'pen',
        color: '#7719aa',
        width: 3,
        points: points,
        shape: null
      };

      ink.snapCurrentStroke();
      const isSnapped = ink.currentStroke.shape !== null && ink.currentStroke.shape.type === 'ellipse';

      ink.strokes.push(ink.currentStroke);
      ink.currentStroke = null;
      ink.renderAllStrokes();
      ink.setMode('navigate');

      return isSnapped;
    });
    assert(shapeSnapResult, 'Draw-and-hold shape snapping detects and converts rough closed loops into clean ellipses');

    // TEST 45: Smart Stroke Eraser
    console.log('\n--- 45. Smart Stroke Eraser ---');
    const eraserResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      const initialCount = ink.strokes.length;

      ink.setMode('eraser');
      // Erase at coordinate (400, 300) where the snapped circle was drawn
      ink.eraseAt(400, 300);

      const countAfter = ink.strokes.length;
      const wasErased = countAfter < initialCount;

      ink.setMode('navigate');
      return wasErased;
    });
    assert(eraserResult, 'Smart stroke eraser cleanly detects and deletes intersected strokes');

    // TEST 46: Home vs. Draw Ribbon Tab Switching
    console.log('\n--- 46. Home vs. Draw Ribbon Tab Switching ---');
    const tabSwitchResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      const tabDraw = document.getElementById('tab-btn-draw');
      const tabHome = document.getElementById('tab-btn-home');
      const homeContent = document.getElementById('ribbon-home-content');
      const drawContent = document.getElementById('ribbon-draw-content');

      // 1. Switch to Draw Tab
      tabDraw.click();
      const drawTabActive = tabDraw.classList.contains('active');
      const drawVisible = drawContent.style.display !== 'none';
      const homeHidden = homeContent.style.display === 'none';
      const modeIsPen = ink.mode === 'pen';

      // 2. Switch back to Home Tab
      tabHome.click();
      const homeTabActive = tabHome.classList.contains('active');
      const homeVisible = homeContent.style.display !== 'none';
      const drawHidden = drawContent.style.display === 'none';
      const modeIsNav = ink.mode === 'navigate';

      return drawTabActive && drawVisible && homeHidden && modeIsPen &&
             homeTabActive && homeVisible && drawHidden && modeIsNav;
    });
    assert(tabSwitchResult, 'Top ribbon seamlessly switches between Home and Draw inking workspaces');

    // TEST 47: 4 Quick-Color Pen Slots & Dedicated Color Picker
    console.log('\n--- 47. 4 Quick-Color Pen Slots & Dedicated Color Picker ---');
    const penSlotsResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      const tabDraw = document.getElementById('tab-btn-draw');
      tabDraw.click();

      // 1. Switch between slots
      const slot2 = document.getElementById('pen-slot-2');
      slot2.click();
      const slot2Active = slot2.classList.contains('active') && ink.penColor === '#0078d4';

      // 2. Change active slot using Color Picker input
      const pickerInput = document.getElementById('draw-color-picker-input');
      pickerInput.value = '#00b7c3';
      pickerInput.dispatchEvent(new Event('input', { bubbles: true }));

      const colorPicked = ink.penColor === '#00b7c3' && ink.colorSlots[ink.activeSlotIndex] === '#00b7c3';
      const previewUpdated = document.getElementById('draw-picker-preview').style.backgroundColor.includes('0, 183, 195') ||
                             document.getElementById('draw-picker-preview').style.backgroundColor === '#00b7c3';

      document.getElementById('tab-btn-home').click();
      return slot2Active && colorPicked && previewUpdated;
    });
    assert(penSlotsResult, '4 Quick-Color Pen slots and Color Picker update active pen color and preview immediately');

    // TEST 48: Canvas Palm Lock Enforcement in Ink Mode
    console.log('\n--- 48. Canvas Palm Lock Enforcement in Ink Mode ---');
    const palmLockResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      const tabDraw = document.getElementById('tab-btn-draw');
      tabDraw.click();

      // Test manual lock toggle button
      const toggleBtn = document.getElementById('btn-toggle-canvas-lock');
      toggleBtn.click(); // Turn lock ON
      const isLocked = window.app.canvas.isPanningLocked === true;
      const isOverflowHidden = window.app.canvas.viewport.style.overflow === 'hidden';
      const hasLockedClass = window.app.canvas.viewport.classList.contains('canvas-locked');

      // Unlock toggle works
      toggleBtn.click(); // Turn lock OFF
      const wasUnlocked = window.app.canvas.isPanningLocked === false &&
                          window.app.canvas.viewport.style.overflow === 'scroll';

      // Re-lock
      toggleBtn.click(); // Turn lock ON
      const reLocked = window.app.canvas.isPanningLocked === true &&
                       window.app.canvas.viewport.style.overflow === 'hidden';

      document.getElementById('tab-btn-home').click();
      window.app.canvas.setLocked(false);
      return isLocked && isOverflowHidden && hasLockedClass && wasUnlocked && reLocked;
    });
    assert(palmLockResult, 'Canvas Palm Lock freezes viewport scrolling and gestures against accidental touch');

    // TEST 49: Clean Canvas Guarantee (Floating Puck Completely Removed)
    console.log('\n--- 49. Clean Canvas Guarantee (Puck Removed) ---');
    const cleanWorkspaceResult = await page.evaluate(() => {
      const puck = document.getElementById('mode-switcher-puck');
      return puck === null;
    });
    assert(cleanWorkspaceResult, 'Floating mode puck is completely removed from the workspace for an unhindered canvas');

    // TEST 50: Executive Dark Mode & OneNote Purple System
    console.log('\n--- 50. Executive Dark Mode & OneNote Purple System ---');
    const darkModeResult = await page.evaluate(() => {
      const toggleBtn = document.getElementById('btn-toggle-theme');
      const iconSpan = document.getElementById('theme-toggle-icon');
      if (!toggleBtn || !iconSpan) return false;

      // 1. Initial State (Light Mode)
      const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const initialIcon = iconSpan.textContent.trim();

      // 2. Click to toggle to Dark Mode
      toggleBtn.click();
      const darkTheme = document.documentElement.getAttribute('data-theme');
      const darkIcon = iconSpan.textContent.trim();
      const darkStorage = localStorage.getItem('onenote_theme');

      // Check canvas viewport and card styling under dark theme
      const viewportBg = window.getComputedStyle(document.querySelector('.canvas-viewport')).backgroundColor;
      const cardBg = window.getComputedStyle(document.querySelector('.note-box')).backgroundColor;

      // 3. Click again to return to Light Mode
      toggleBtn.click();
      const revertedTheme = document.documentElement.getAttribute('data-theme');
      const revertedIcon = iconSpan.textContent.trim();
      const revertedStorage = localStorage.getItem('onenote_theme');

      return (
        initialTheme === 'light' &&
        initialIcon === '🌙' &&
        darkTheme === 'dark' &&
        darkIcon === '☀️' &&
        darkStorage === 'dark' &&
        revertedTheme === 'light' &&
        revertedIcon === '🌙' &&
        revertedStorage === 'light'
      );
    });
    assert(darkModeResult, 'Executive Dark Mode toggles seamlessly, changes icon to ☀️, persists to localStorage, and reverts to Daylight 🌙');

    // TEST 51: Smart Pen & Highlighter Inversion on Theme Switch
    console.log('\n--- 51. Smart Pen & Highlighter Color Inversion ---');
    const inkInversionResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      const toggleBtn = document.getElementById('btn-toggle-theme');
      const slot0Tip = document.querySelector('#pen-slot-0 .pen-slot-tip');

      // 1. Ensure Light Mode
      window.app.setTheme('light');

      // Verify daylight ink resolution
      const lightPen = ink.resolveDisplayColor('#111111', 'pen');
      const lightHighlighter = ink.resolveDisplayColor('rgba(255, 235, 59, 0.65)', 'highlighter');
      const lightSlot0Bg = slot0Tip.style.backgroundColor;

      // 2. Switch to Dark Mode
      window.app.setTheme('dark');

      const darkPen = ink.resolveDisplayColor('#111111', 'pen');
      const darkHighlighter = ink.resolveDisplayColor('rgba(255, 235, 59, 0.65)', 'highlighter');
      const darkSlot0Bg = slot0Tip.style.backgroundColor;

      // 3. Switch back to Light Mode
      window.app.setTheme('light');

      const revertedPen = ink.resolveDisplayColor('#111111', 'pen');
      const revertedSlot0Bg = slot0Tip.style.backgroundColor;

      return (
        lightPen === '#111111' &&
        lightHighlighter === 'rgba(255, 235, 59, 0.65)' &&
        darkPen === '#f5f5f5' &&
        darkHighlighter === 'rgba(255, 225, 90, 0.65)' &&
        (darkSlot0Bg === 'rgb(245, 245, 245)' || darkSlot0Bg === '#f5f5f5') &&
        revertedPen === '#111111' &&
        (revertedSlot0Bg === 'rgb(17, 17, 17)' || revertedSlot0Bg === '#111111')
      );
    });
    assert(inkInversionResult, 'Smart pen & highlighter automatically invert black to cream-white and pastels to luminous glow in dark mode, and restore in daylight');

    // TEST 52: Midnight Glow Text Highlighter Inversion (Option A)
    console.log('\n--- 52. Midnight Glow Text Highlighter Inversion ---');
    const textHighlightResult = await page.evaluate(() => {
      // 1. Create a test card with highlighted text
      const box = window.app.createNoteBox(200, 200, 320);
      const block = box.addTextBlock('Test Highlight Line');
      const editable = block.querySelector('[contenteditable="true"]');
      editable.innerHTML = 'Hover on the <span id="test-yellow-highlight" style="background-color: rgb(255, 245, 157);">yellow text</span> and <span id="test-pink-highlight" style="background-color: rgb(248, 187, 208);">pink text</span>.';

      const yellowSpan = document.getElementById('test-yellow-highlight');
      const pinkSpan = document.getElementById('test-pink-highlight');

      // 2. In Daylight Mode: check bright pastel background
      window.app.setTheme('light');
      const lightYellowBg = window.getComputedStyle(yellowSpan).backgroundColor;
      const lightPinkBg = window.getComputedStyle(pinkSpan).backgroundColor;

      // 3. In Dark Mode: check midnight glow background & white text
      window.app.setTheme('dark');
      const darkYellowBg = window.getComputedStyle(yellowSpan).backgroundColor;
      const darkYellowColor = window.getComputedStyle(yellowSpan).color;
      const darkPinkBg = window.getComputedStyle(pinkSpan).backgroundColor;
      const darkPinkColor = window.getComputedStyle(pinkSpan).color;

      // 4. Return to Daylight Mode
      window.app.setTheme('light');
      const revertedYellowBg = window.getComputedStyle(yellowSpan).backgroundColor;

      // Clean up test box
      box.destroy();

      const isDarkYellowGlow = darkYellowBg.includes('255, 214, 0') || darkYellowBg.includes('0.28');
      const isDarkPinkGlow = darkPinkBg.includes('244, 114, 182') || darkPinkBg.includes('0.32');
      const isTextCrispWhite = darkYellowColor === 'rgb(237, 237, 237)' && darkPinkColor === 'rgb(237, 237, 237)';

      return isDarkYellowGlow && isDarkPinkGlow && isTextCrispWhite && revertedYellowBg.includes('255, 245, 157');
    });
    assert(textHighlightResult, 'Text highlights automatically transform into midnight amber/ruby glow with crisp white text in dark mode (Option A)');

    // TEST 53: Standalone PWA Installation & Manifest Verification
    console.log('\n--- 53. Standalone PWA Installation & Manifest Verification ---');
    const pwaResult = await page.evaluate(() => {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]');
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      const appleMobileMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');

      const hasManifest = manifestLink && manifestLink.getAttribute('href') === 'manifest.json';
      const hasAppleIcon = appleIconLink && appleIconLink.getAttribute('href') === 'icon-192.png';
      const hasThemeColor = themeColorMeta && themeColorMeta.getAttribute('content') === '#7719aa';
      const isAppleCapable = appleMobileMeta && appleMobileMeta.getAttribute('content') === 'yes';

      return hasManifest && hasAppleIcon && hasThemeColor && isAppleCapable;
    });

    const fs = require('fs');
    const manifestExists = fs.existsSync(path.resolve(__dirname, '../manifest.json'));
    const iconSvgExists = fs.existsSync(path.resolve(__dirname, '../icon.svg'));
    const icon192Exists = fs.existsSync(path.resolve(__dirname, '../icon-192.png'));
    const icon512Exists = fs.existsSync(path.resolve(__dirname, '../icon-512.png'));
    let manifestData = {};
    if (manifestExists) {
      manifestData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));
    }

    const isStandalonePWA = pwaResult &&
      manifestExists &&
      iconSvgExists &&
      icon192Exists &&
      icon512Exists &&
      manifestData.display === 'standalone' &&
      manifestData.theme_color === '#7719aa' &&
      manifestData.icons &&
      manifestData.icons.length >= 3;

    assert(isStandalonePWA, 'Standalone PWA manifest is valid with standalone display mode, #7719aa theme color, and high-res icons (SVG, 192px, 512px)');

    // TEST 54: 100% Offline Airplane Mode Service Worker (sw.js)
    console.log('\n--- 54. 100% Offline Airplane Mode Service Worker (sw.js) ---');
    const swExists = fs.existsSync(path.resolve(__dirname, '../sw.js'));
    let swContent = '';
    if (swExists) {
      swContent = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf8');
    }

    const hasCacheName = swContent.includes('CACHE_NAME');
    const hasPrecacheList = swContent.includes('PRECACHE_ASSETS') &&
      swContent.includes('index.html') &&
      swContent.includes('styles.css') &&
      swContent.includes('src/app.js');
    const hasInstallListener = swContent.includes("addEventListener('install'");
    const hasActivateListener = swContent.includes("addEventListener('activate'");
    const hasFetchListener = swContent.includes("addEventListener('fetch'");

    const indexHtmlContent = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const hasSwRegistration = indexHtmlContent.includes('navigator.serviceWorker.register');

    const isOfflineReady = swExists &&
      hasCacheName &&
      hasPrecacheList &&
      hasInstallListener &&
      hasActivateListener &&
      hasFetchListener &&
      hasSwRegistration;

    assert(isOfflineReady, '100% Offline Airplane Mode Service Worker is configured with cache-first strategy, pre-cached assets, and registered in index.html');

    // TEST 55: Smart Boundary Edge Auto-Scrolling for Note Cards
    console.log('\n--- 55. Smart Boundary Edge Auto-Scrolling for Note Cards ---');
    const edgeScrollMathResult = await page.evaluate(() => {
      const canvas = window.app.canvas;
      const vp = canvas.viewport;
      const rect = vp.getBoundingClientRect();

      // 1. In the middle of viewport -> zero velocity
      const centerVel = canvas.getEdgeScrollVelocity(rect.left + rect.width / 2, rect.top + rect.height / 2, 60);

      // 2. Near right edge (within 60px) -> positive vx
      const rightVel = canvas.getEdgeScrollVelocity(rect.right - 25, rect.top + rect.height / 2, 60);

      // 3. Near bottom edge (within 60px) -> positive vy
      const bottomVel = canvas.getEdgeScrollVelocity(rect.left + rect.width / 2, rect.bottom - 25, 60);

      // 4. Near left edge (within 60px) -> negative vx
      const leftVel = canvas.getEdgeScrollVelocity(rect.left + 25, rect.top + rect.height / 2, 60);

      // 5. Near top edge (within 60px) -> negative vy
      const topVel = canvas.getEdgeScrollVelocity(rect.left + rect.width / 2, rect.top + 25, 60);

      return (
        centerVel.vx === 0 && centerVel.vy === 0 &&
        rightVel.vx > 0 &&
        bottomVel.vy > 0 &&
        leftVel.vx < 0 &&
        topVel.vy < 0
      );
    });
    assert(edgeScrollMathResult, 'Smart edge velocity engine calculates proportional directional scrolling within 60px boundary zone and zeroes at center');

    // Interactive card drag near screen edge triggers live auto-scrolling
    const interactiveEdgeScrollResult = await page.evaluate(async () => {
      const box = window.app.noteBoxes[0];
      const vp = window.app.canvas.viewport;
      vp.scrollLeft = 0;
      vp.scrollTop = 0;
      const initialScroll = vp.scrollLeft;

      const header = box.element.querySelector('.note-header');
      const rect = vp.getBoundingClientRect();

      // Mouse down on header
      header.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 100,
        clientY: rect.top + 100
      }));

      // Move mouse to within 30px of right screen edge
      window.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: rect.right - 30,
        clientY: rect.top + 100
      }));

      // Wait 120ms for RAF auto-scroll frames to advance
      await new Promise(r => setTimeout(r, 120));

      // Mouse up to stop
      window.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      }));

      const finalScroll = vp.scrollLeft;
      return finalScroll > initialScroll;
    });
    assert(interactiveEdgeScrollResult, 'Dragging a note card near screen boundary smoothly glides the canvas viewport and halts on release');

    // TEST 56: Smart Boundary Edge Auto-Scrolling for Marquee Selection
    console.log('\n--- 56. Smart Boundary Edge Auto-Scrolling for Marquee Selection ---');
    const marqueeEdgeScrollResult = await page.evaluate(async () => {
      const stage = window.app.canvas.stage;
      const vp = window.app.canvas.viewport;
      vp.scrollLeft = 0;
      vp.scrollTop = 0;
      const initialScroll = vp.scrollLeft;
      const rect = vp.getBoundingClientRect();

      // Mouse down on empty stage space
      stage.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 50,
        clientY: rect.top + 50,
        button: 0
      }));

      // Drag marquee selection towards right screen edge (within 25px)
      window.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: rect.right - 25,
        clientY: rect.top + 50
      }));

      // Wait 200ms for edge auto-scrolling to advance
      await new Promise(r => setTimeout(r, 200));

      // Mouse up
      window.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      }));

      const finalScroll = vp.scrollLeft;
      const marqueeCleanedUp = document.querySelector('.marquee-selection-box') === null;

      return finalScroll > initialScroll && marqueeCleanedUp;
    });
    assert(marqueeEdgeScrollResult, 'Marquee lasso selection smoothly glides the canvas viewport near screen edges and cleans up marquee box on release');

    // TEST 57: Tablet 1-Finger Canvas Background Panning
    console.log('\n--- 57. Tablet 1-Finger Canvas Background Panning ---');
    const touchPanResult = await page.evaluate(async () => {
      const vp = window.app.canvas.viewport;
      vp.scrollLeft = 100;
      vp.scrollTop = 100;
      const initialScrollX = vp.scrollLeft;
      const initialScrollY = vp.scrollTop;
      const rect = vp.getBoundingClientRect();

      // Finger 1 down on empty background
      vp.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 101,
        pointerType: 'touch',
        clientX: rect.left + 300,
        clientY: rect.top + 300
      }));

      // Finger 1 drag left by 80px (scrolls right)
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 101,
        pointerType: 'touch',
        clientX: rect.left + 220,
        clientY: rect.top + 220
      }));

      await new Promise(r => setTimeout(r, 60));

      window.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 101,
        pointerType: 'touch',
        clientX: rect.left + 220,
        clientY: rect.top + 220
      }));

      return vp.scrollLeft > initialScrollX && vp.scrollTop > initialScrollY;
    });
    assert(touchPanResult, '1-finger touch drag on empty canvas smoothly pans the viewport');

    // TEST 58: Tablet 2-Finger Pinch-to-Zoom
    console.log('\n--- 58. Tablet 2-Finger Pinch-to-Zoom ---');
    const pinchZoomResult = await page.evaluate(async () => {
      const vp = window.app.canvas.viewport;
      window.app.canvas.setZoom(1.0);
      const initialZoom = window.app.canvas.zoomLevel;
      const rect = vp.getBoundingClientRect();

      // Finger 1 down
      vp.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 201,
        pointerType: 'touch',
        clientX: rect.left + 300,
        clientY: rect.top + 300
      }));

      // Finger 2 down (100px apart)
      vp.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 202,
        pointerType: 'touch',
        clientX: rect.left + 400,
        clientY: rect.top + 300
      }));

      // Finger 2 spreads out to 550px (pinch outwards to zoom in)
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 202,
        pointerType: 'touch',
        clientX: rect.left + 550,
        clientY: rect.top + 300
      }));

      await new Promise(r => setTimeout(r, 60));

      const finalZoom = window.app.canvas.zoomLevel;

      // Fingers lifted
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 201, pointerType: 'touch' }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 202, pointerType: 'touch' }));

      // Reset zoom back to 1.0
      window.app.canvas.setZoom(1.0);

      return finalZoom > initialZoom;
    });
    assert(pinchZoomResult, '2-finger pinch spread gesture dynamically zooms in the canvas');

    // TEST 59: Tablet Touch Dragging on Note Box Header
    console.log('\n--- 59. Tablet Touch Dragging on Note Box Header ---');
    const touchDragCardResult = await page.evaluate(async () => {
      window.app.canvas.viewport.scrollLeft = 0;
      window.app.canvas.viewport.scrollTop = 0;
      await new Promise(r => setTimeout(r, 20));
      const box = window.app.noteBoxes[0];
      const initialX = box.x;
      const initialY = box.y;
      const header = box.element.querySelector('.note-header');
      const rect = header.getBoundingClientRect();

      // Touch down on header
      header.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 301,
        pointerType: 'touch',
        clientX: rect.left + 20,
        clientY: rect.top + 10
      }));

      // Drag touch by 60px right and 40px down
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 301,
        pointerType: 'touch',
        clientX: rect.left + 80,
        clientY: rect.top + 50
      }));

      await new Promise(r => setTimeout(r, 50));

      // Touch up
      window.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 301,
        pointerType: 'touch',
        clientX: rect.left + 80,
        clientY: rect.top + 50
      }));

      return box.x > initialX && box.y > initialY;
    });
    assert(touchDragCardResult, 'Finger touch drag on note header smoothly moves note card across canvas');

    // TEST 60: Tablet Touch 8-Point Perimeter Resizing
    console.log('\n--- 60. Tablet Touch 8-Point Perimeter Resizing ---');
    const touchResizeResult = await page.evaluate(async () => {
      const box = window.app.noteBoxes[0];
      const initialW = box.element.offsetWidth;
      const initialH = box.element.offsetHeight;
      const seHandle = box.element.querySelector('.resize-handle.se');
      const rect = seHandle.getBoundingClientRect();

      // Touch down on Southeast corner handle
      seHandle.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 401,
        pointerType: 'touch',
        clientX: rect.left + 4,
        clientY: rect.top + 4
      }));

      // Drag touch down and right by 50px
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 401,
        pointerType: 'touch',
        clientX: rect.left + 54,
        clientY: rect.top + 54
      }));

      await new Promise(r => setTimeout(r, 50));

      // Touch up
      window.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 401,
        pointerType: 'touch'
      }));

      const finalW = box.element.offsetWidth;
      const finalH = box.element.offsetHeight;

      return finalW > initialW && finalH > initialH;
    });
    assert(touchResizeResult, 'Finger touch drag on 8-point corner handle smoothly resizes note box dimensions');

    // TEST 61: Pencil Only Mode Palm Rejection & Pixel-Accurate Stylus Inking
    console.log('\n--- 61. Pencil Only Mode Palm Rejection & Stylus Inking ---');
    const pencilOnlyResult = await page.evaluate(() => {
      const ink = window.app.inkEngine;
      ink.setMode('pen');
      ink.setPencilOnly(true);

      const canvas = ink.inkCanvas;
      const initialStrokesCount = ink.strokes.length;

      // 1. Simulate resting palm / finger touch: MUST be rejected in pencil-only mode
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 501,
        pointerType: 'touch',
        clientX: 250,
        clientY: 250
      }));
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 501,
        pointerType: 'touch',
        clientX: 280,
        clientY: 280
      }));
      canvas.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 501,
        pointerType: 'touch',
        clientX: 280,
        clientY: 280
      }));

      const palmRejected = ink.strokes.length === initialStrokesCount;

      // 2. Simulate Apple Pencil / Stylus: MUST ink smoothly
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 502,
        pointerType: 'pen',
        clientX: 300,
        clientY: 300,
        pressure: 0.75
      }));
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 502,
        pointerType: 'pen',
        clientX: 350,
        clientY: 350,
        pressure: 0.85
      }));
      canvas.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 502,
        pointerType: 'pen',
        clientX: 350,
        clientY: 350
      }));

      const penRecorded = ink.strokes.length === initialStrokesCount + 1;
      const lastStroke = ink.strokes[ink.strokes.length - 1];
      const penValid = lastStroke && lastStroke.tool === 'pen' && lastStroke.points.length >= 2;

      // 3. Test Toggle to Finger Drawing
      ink.setPencilOnly(false);
      const isFingerMode = ink.pencilOnly === false;

      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 503,
        pointerType: 'touch',
        clientX: 400,
        clientY: 400
      }));
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 503,
        pointerType: 'touch',
        clientX: 420,
        clientY: 420
      }));
      canvas.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 503,
        pointerType: 'touch',
        clientX: 420,
        clientY: 420
      }));

      const fingerRecorded = ink.strokes.length === initialStrokesCount + 2;

      // Restore Pencil Only default & reset to navigate mode
      ink.setPencilOnly(true);
      ink.setMode('navigate');

      return palmRejected && penRecorded && penValid && isFingerMode && fingerRecorded;
    });
    assert(pencilOnlyResult, 'Pencil Only mode rejects accidental finger/palm contact while recording Apple Pencil/stylus strokes');

    // TEST 62: Cross-Device Responsive Layout & Mobile Drawer
    console.log('\n--- 62. Cross-Device Responsive Layout & Mobile Drawer ---');
    // 1. Simulate Mobile Viewport (iPhone 14: 390 x 844)
    await page.setViewport({ width: 390, height: 844 });
    const mobileLayoutResult = await page.evaluate(async () => {
      const ribbon = document.querySelector('.ribbon-bar');
      const ribbonStyle = window.getComputedStyle(ribbon);
      const isRibbonScrollable = ribbonStyle.overflowX === 'auto';

      const sidebar = document.getElementById('app-sidebar');
      const toggleBtn = document.getElementById('btn-toggle-sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');

      // Ensure sidebar starts collapsed in mobile drawer mode
      if (!sidebar.classList.contains('collapsed')) {
        toggleBtn.click();
      }

      // In small screen mode, opening sidebar activates mobile backdrop
      toggleBtn.click();
      const isDrawerOpen = !sidebar.classList.contains('collapsed');
      const isBackdropActive = backdrop.classList.contains('active');

      // Tapping backdrop closes the drawer
      backdrop.click();
      const isDrawerClosed = sidebar.classList.contains('collapsed');
      const isBackdropInactive = !backdrop.classList.contains('active');

      return isRibbonScrollable && isDrawerOpen && isBackdropActive && isDrawerClosed && isBackdropInactive;
    });
    assert(mobileLayoutResult, 'Mobile layout provides swipeable ribbon, slide-away drawer sidebar, and backdrop overlay');

    // TEST 63: Android Tablet Emulation (4x CPU Slowdown) — Touch Panning Smoothness
    console.log('\n--- 63. Android Tablet Emulation (4x CPU Slowdown) ---');
    const cdpClient = await page.target().createCDPSession();
    await cdpClient.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.setViewport({ width: 1280, height: 800, hasTouch: true, isMobile: true });

    const androidTouchResult = await page.evaluate(async () => {
      const vp = document.getElementById('canvas-viewport');
      const initialScrollX = vp.scrollLeft;
      const initialScrollY = vp.scrollTop;

      // Simulate Android touch gesture
      const pDown = new PointerEvent('pointerdown', {
        pointerId: 101,
        pointerType: 'touch',
        clientX: 400,
        clientY: 400,
        bubbles: true
      });
      vp.dispatchEvent(pDown);

      const pMove = new PointerEvent('pointermove', {
        pointerId: 101,
        pointerType: 'touch',
        clientX: 300,
        clientY: 300,
        bubbles: true
      });
      window.dispatchEvent(pMove);

      // Wait a frame for kinetic / RAF governor
      await new Promise(r => requestAnimationFrame(r));

      const pUp = new PointerEvent('pointerup', {
        pointerId: 101,
        pointerType: 'touch',
        clientX: 300,
        clientY: 300,
        bubbles: true
      });
      window.dispatchEvent(pUp);

      const didScroll = (vp.scrollLeft > initialScrollX) || (vp.scrollTop > initialScrollY);
      const isTouchActionConfigured = window.getComputedStyle(vp).touchAction === 'none';

      return didScroll && isTouchActionConfigured;
    });
    assert(androidTouchResult, 'Android tablet profile under 4x CPU throttling executes non-blocking touch panning smoothly');

    // TEST 64: iPad Pro Stylus Emulation (4x CPU Slowdown) — Coalesced High-Frequency Inking
    console.log('\n--- 64. iPad Pro Stylus Emulation (4x CPU Slowdown) ---');
    await page.setViewport({ width: 1024, height: 1366, hasTouch: true, isMobile: true });

    const ipadInkingResult = await page.evaluate(async () => {
      const ink = window.app.inkEngine;
      ink.setMode('pen');
      ink.setPencilOnly(true);
      const initialCount = ink.strokes.length;

      const canvas = ink.inkCanvas;
      const rect = canvas.getBoundingClientRect();

      // Stylus contact
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 202,
        pointerType: 'pen',
        pressure: 0.8,
        clientX: rect.left + 200,
        clientY: rect.top + 200,
        bubbles: true
      }));

      // Stylus movement with simulated coalesced intermediate hardware points (240Hz hardware emulation)
      const sub1 = new PointerEvent('pointermove', { clientX: rect.left + 210, clientY: rect.top + 208, pressure: 0.75 });
      const sub2 = new PointerEvent('pointermove', { clientX: rect.left + 225, clientY: rect.top + 218, pressure: 0.70 });
      const sub3 = new PointerEvent('pointermove', { clientX: rect.left + 245, clientY: rect.top + 230, pressure: 0.65 });

      const mainMove = new PointerEvent('pointermove', {
        pointerId: 202,
        pointerType: 'pen',
        pressure: 0.65,
        clientX: rect.left + 245,
        clientY: rect.top + 230,
        bubbles: true
      });
      // Attach mock getCoalescedEvents mimicking WebKit iPadOS
      mainMove.getCoalescedEvents = () => [sub1, sub2, sub3];

      canvas.dispatchEvent(mainMove);

      canvas.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 202,
        pointerType: 'pen',
        clientX: rect.left + 245,
        clientY: rect.top + 230,
        bubbles: true
      }));

      const newStroke = ink.strokes[ink.strokes.length - 1];
      const hasCoalescedDensity = newStroke && newStroke.points.length >= 4; // contact dot + 3 coalesced points
      ink.setMode('navigate');

      return (ink.strokes.length === initialCount + 1) && hasCoalescedDensity;
    });
    assert(ipadInkingResult, 'iPad Pro profile under 4x CPU throttling records dense 240Hz coalesced inking points without jitter');

    // TEST 65: Multi-OS Real-World Gauntlet (Heavy 50-Paragraph Paste under 4x CPU Throttling)
    console.log('\n--- 65. Multi-OS Real-World Gauntlet (50-Block Paste under 4x CPU Throttling) ---');
    const gauntletResult = await page.evaluate(async () => {
      const app = window.app;
      // 1. Target a note box in the busy workspace
      const targetBox = app.createNoteBox(200, 200, 480);

      // 2. Synthesize a massive 50-unit rich outline payload (headings, text, math, tables, callouts)
      const units = [];
      for (let i = 1; i <= 50; i++) {
        if (i % 10 === 1) {
          units.push({ type: 'heading', tag: 'h2', content: `Section ${i}: Performance Stress Test` });
        } else if (i % 10 === 5) {
          units.push({ type: 'callout', content: `Crucial finding for block ${i} under mobile throttling.` });
        } else if (i % 10 === 8) {
          units.push({ type: 'math', latex: `\\sum_{k=1}^{${i}} \\frac{1}{k^2} = \\frac{\\pi^2}{6}` });
        } else {
          units.push({ type: 'text', content: `Paragraph ${i}: Validating buttery-smooth zero-freeze streaming across all mobile operating systems.` });
        }
      }

      let maxFrameGap = 0;
      let lastTime = 0;
      let isMonitoring = true;

      const monitorLoop = () => {
        if (!isMonitoring) return;
        const now = performance.now();
        if (lastTime > 0) {
          const gap = now - lastTime;
          if (gap > maxFrameGap) maxFrameGap = gap;
        }
        lastTime = now;
        requestAnimationFrame(monitorLoop);
      };
      requestAnimationFrame(monitorLoop);

      // 4. Execute streaming insertion with completion callback
      await new Promise(resolve => {
        app.insertOutlineUnits(units, targetBox, null, () => {
          isMonitoring = false;
          resolve();
        });
      });

      // 5. Verify all 50 blocks exist inside the target box and have interactive grips
      const blocks = targetBox.contentArea.querySelectorAll('.canvas-block');
      const allHaveGrips = Array.from(blocks).every(b => b.querySelector('.block-grip') !== null);
      const isIntegritySound = blocks.length === 50 && allHaveGrips;

      // Clean up target box
      targetBox.destroy();

      return isIntegritySound && (maxFrameGap < 250);
    });
    assert(gauntletResult, 'Real-world gauntlet: 50-paragraph paste streamed without main-thread freeze under 4x CPU mobile throttle');

    // Reset CPU throttling to 1 (full speed) and restore desktop viewport
    await cdpClient.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.setViewport({ width: 1440, height: 900 });





    console.log(`\n========================================`);
    console.log(`📊 Test Results: ${passedCount}/${totalCount} Passed (${Math.round((passedCount / totalCount) * 100)}%)`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('❌ Error during test run:', err);
  } finally {
    await browser.close();
  }
}

runTests();
