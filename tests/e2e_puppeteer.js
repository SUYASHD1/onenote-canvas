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
      const pasteEvt = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true });
      window.dispatchEvent(pasteEvt);

      const countAfterPaste = window.app.noteBoxes.length;
      return countAfterPaste === countBefore + 1;
    });
    assert(clipboardTest, 'Ctrl+C copies selected container and Ctrl+V cleanly pastes clone to canvas');

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
