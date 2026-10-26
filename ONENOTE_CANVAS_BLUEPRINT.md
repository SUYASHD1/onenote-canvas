# 🗺️ OneNote Spatial Canvas — Architecture Blueprint & Implementation Guide

> **Core Vision:** Build a pure, authentic web-based spatial canvas that mirrors **Microsoft OneNote** with precision.  
> **Key Decisions:**
> * **Rigid, Anchored Canvas:** Fixed at top and left edges; automatically expands down and right only when content requires it. No floating negative space, no magnetic alignment snap guides, and no simulated floating lift physics.
> * **Table Auto-Detection:** Automatically turns text into tables when pressing `Tab`, with one-click switching between **4 distinct layout formats**.
> * **Image Cropping & Resizing:** Direct in-place image resizing and interactive cropping without external tools, keeping captions locked to pictures.
> * **Pop-Out & Pop-In:** Left-margin hover grips (`:::`) allow detaching items into new standalone note cards or merging them back with a live radiant blue insertion line.
> * **Conflict-Free Keyboard:** 3-tier shortcut system (`Alt+Shift+Arrows`, `Tab/Shift+Tab`, `Ctrl+A` ladder, and immune backspace).
> * **Strict Modular Codebase:** Every module kept clean, decoupled, and strictly within the **350–500 line range** for effortless maintenance and debugging.
> * **Browser Testing:** For browser-based testing, use Puppeteer (already installed on this machine configured for Microsoft Edge).
> * **Git & GitHub:** Push all code after every successful completion to GitHub.

---

## 🏛️ 1. Architecture & Design Principles

```
+-----------------------------------------------------------------------------------------------+
| TOP RIBBON: [Text Formatting] | [Insert Table] | [Insert Image] | [Zoom & Grid Controls]     |
+-----------------------------------------------------------------------------------------------+
| ONE-NOTE RIGID CANVAS (Anchored Top-Left, Auto-Expands Down & Right as Cards Grow)             |
|                                                                                               |
|  (0,0) Origin                                                                                 |
|   +---------------------------------------+      +----------------------------------------+   |
|   | [:::] Weekly Project Notes        [×] |      | [:::] Financial Forecast Matrix    [×] |   |
|   +---------------------------------------+      +----------------------------------------+   |
|   | Sprint Goals for Q4:                  |      | [ 4 Table Layout Styles Switcher ]     |   |
|   | [:::] High-priority tasks             |      | +-------------+----------+-----------+ |   |
|   |                                       |      | | Metric      | Target   | Actual    | |   |
|   | --- [BLUE INSERTION GUIDELINE] ---    |      | +-------------+----------+-----------+ |   |
|   | [:::] [Photo: Wireframe + Caption]    |      | | Q1 Revenue  | $120k    | $135k     | |   |
|   |       [Crop] [Resize Handles]         |      | +-------------+----------+-----------+ |   |
|   +---------------------------------------+      +----------------------------------------+   |
|                                                                                               |
+-----------------------------------------------------------------------------------------------+
```

### Principle 1: The Anchored, Auto-Growing Canvas
* **Fixed Origin:** Anchored strictly at top and left (0,0). No disorienting infinite negative space.
* **Smart Elastic Bounds:** As you drag cards near the right or bottom edges, or type long notes, the canvas automatically expands in that direction to accommodate content.
* **Double-Click Creation:** Double-clicking anywhere on the blank surface immediately spawns a new note card at that exact coordinate.

### Principle 2: The Flat, Authentic Note Container
* **Header Bar:** Subtle grey header bar at the top with a move handle (`:::`) and delete button (`×`).
* **8-Point Perimeter Resize:** Corners and edges have resize handles to freely widen, narrow, or stretch note cards.
* **Clean, Flat Styling:** Flat OneNote appearance with crisp borders—no unnecessary floating drop shadows or lift scaling.
* **Auto-Width & Word Wrapping:** Text wraps naturally to the container's set width.

### Principle 3: Table Auto-Detection & 4 Layout Formats
* **Instant Creation with `Tab`:** Typing a word and pressing `Tab` automatically converts that paragraph into a 2-column table. Pressing `Enter` adds a new row; pressing `Tab` in the last cell creates a new column.
* **Paste Detection:** Pasting TSV/CSV or copied spreadsheet cells automatically creates a structured table.
* **4 Distinct Visual Layout Formats:**
  1. **Classic Grid:** Clean, sharp borders on every cell for traditional note-taking.
  2. **Zebra Banded Rows:** Alternating light and shaded rows for effortless reading of dense data.
  3. **Modern Header Accent:** Distinct colored header bar with soft bottom row dividers and no vertical lines.
  4. **Compact Sheet (Data Matrix):** Monospaced, tight cell padding with subtle grid lines for financial, metric, or status tables.
* **Inline Controls:** Quick hover buttons to insert/delete rows and columns.

### Principle 4: Image Sizing & Built-In Cropping
* **8-Handle Resizing:** Dragging any corner handle resizes the image while maintaining aspect ratio; edge handles allow custom adjustment.
* **Interactive Crop Tool:**
  * Clicking the **Crop** button on any image activates crop mode right on the canvas.
  * Dragging crop borders cuts away unwanted portions.
  * Clicking "Apply" crops the image instantly without external tools.
* **Caption Locking:** An image and its caption are permanently glued together so moving or detaching the image never leaves the caption behind.

### Principle 5: Pop-Out & Pop-In Flow (Hover Grips & Insertion Line)
* **Left-Margin Hover Grip (`:::`):** Every paragraph, table, or image displays a grip when hovered.
* **Rearrange Inside:** Dragging the grip up or down moves that item between other paragraphs inside the card.
* **Pop Out (Detach):** Dragging that grip outside the boundaries of the note card detaches that item and spawns a **brand-new note card** right at the mouse release location.
* **Pop In (Merge via Blue Line):** Dragging any item or card over another note displays a live, glowing **blue horizontal insertion line** between paragraphs. Releasing drops the content into that exact gap.

### Principle 6: 3-Tier Conflict-Free Keyboard Shortcuts
* **Tier 1 (Typing inside text):** `Backspace` and `Delete` delete characters only. Backspace at line start un-indents or pulls the sentence up. The container cannot be accidentally deleted while typing.
* **Tier 2 (Item Selected):** Clicking an image or table selects it -> `Delete` removes only that item.
* **Tier 3 (Container Selected):** Clicking the container header selects the entire card -> `Delete` removes the card.
* **Outline Shortcuts:**
  * `Alt + Shift + Up / Down`: Move current paragraph or item up or down.
  * `Tab` / `Shift + Tab`: Indent or outdent outline items.
  * `Ctrl + A` Ladder: 1st press = current line; 2nd press = card contents; 3rd press = whole container.
  * `Ctrl + V` on empty canvas: Pastes clipboard content as a new card at the mouse position.

---

## 📁 2. Modular Codebase Architecture (~350–500 Lines per File)

To ensure maximum maintainability, clarity, and ease of debugging, every file is kept focused and within 350–500 lines:

```
Canvas/
├── index.html                   <-- Structure (Ribbon, Canvas container, Crop modal) (~200 lines)
├── styles.css                   <-- Appearance (OneNote themes, containers, 4 table styles, crop UI) (~400 lines)
├── src/
│   ├── canvas.js                <-- Anchored canvas, elastic auto-growth, pan & zoom, double-click spawn (~300 lines)
│   ├── note_box.js              <-- Container creation, header drag, 8-point resize, selection state (~350 lines)
│   ├── table_module.js          <-- Table auto-detection (word+Tab), 4 layout switchers, row/col operations (~350 lines)
│   ├── image_module.js          <-- Image insertion, 8-handle scaling, built-in crop tool, caption locking (~380 lines)
│   ├── element_flow.js          <-- Margin hover grips, Pop-Out detaching, Pop-In live blue line merging (~380 lines)
│   ├── keyboard_shortcuts.js    <-- 3-tier keyboard controller, Alt+Shift arrows, Tab indent, Ctrl+A ladder (~300 lines)
│   └── app.js                   <-- Master coordinator, ribbon toolbar actions, sample starter notes (~300 lines)
└── tests/
    └── e2e_puppeteer.js         <-- Automated browser testing via Puppeteer for Microsoft Edge (~250 lines)
```

---

## 🧪 3. Browser-Based Testing (Puppeteer for Microsoft Edge)

Automated tests will be run using **Puppeteer** targeting the local **Microsoft Edge** browser to verify:
1. **Canvas Growth Test:** Creating cards near the edge expands the canvas without jitter.
2. **Double-Click Spawn Test:** Double-clicking at coordinate (X, Y) spawns a note box exactly at that coordinate.
3. **Table Auto-Detection & Layouts Test:** Typing text and pressing `Tab` creates a table; clicking through all 4 layout formats applies corresponding classes cleanly.
4. **Image Crop Test:** Inserting an image, triggering crop, adjusting handles, and saving updates image dimensions correctly.
5. **Pop-Out Test:** Dragging a paragraph or image grip out onto blank canvas creates a new note container with caption intact.
6. **Pop-In Test:** Dragging an item over an existing container displays the blue insertion line and drops it between paragraphs.
7. **Keyboard Immunity Test:** Typing text and pressing `Backspace` at line start never destroys the container.

---

## 🚀 4. Git & GitHub Deployment Rule

* After every successful implementation step and verification test, code will be committed cleanly with a descriptive message and pushed directly to the GitHub repository.
