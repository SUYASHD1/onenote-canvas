# 🗺️ OneNote Spatial Canvas — Complete Architecture Blueprint & Knowledge Base

> **System Status:** Production Ready & Verified (28/28 Automated E2E Tests Passing — 100%)  
> **Core Philosophy:** A pure, zero-compromise spatial note-taking web application inspired by **Microsoft OneNote**. Features an anchored auto-growing canvas, draggable margin grips with pop-out/pop-in flow, instant table creation with 4 layout themes, built-in image cropping, and a universal AI/Web Math Engine capable of capturing and rendering any formula with textbook perfection.

---

## 🏛️ 1. System Architecture & Component Map

The codebase is built strictly on modular, decoupled Vanilla JavaScript (ES6+) and CSS, maintaining clean separation of concerns with files structured around ~350–500 lines for maximum maintainability:

```
Canvas/
├── index.html                   <-- Structure: App header, Ribbon toolbar, Spatial Canvas, Crop modal (~175 lines)
├── styles.css                   <-- Design System: Ribbon styles, canvas grid, note box frame, resize handles (~420 lines)
├── components.css               <-- Object Styles: 4 Table layouts, Image Cards, Equation Cards, Math pills (~440 lines)
├── src/
│   ├── app.js                   <-- Master coordinator, Ribbon actions, universal HTML outline parser (~770 lines)
│   ├── canvas.js                <-- Anchored canvas, elastic auto-growth, pan & zoom, double-click spawn (~190 lines)
│   ├── note_box.js              <-- Container lifecycle, header drag, 8-point resize, selection state (~475 lines)
│   ├── element_flow.js          <-- Margin hover grips (:::), Pop-Out detaching, Pop-In blue drop guideline (~330 lines)
│   ├── table_module.js          <-- Word+Tab auto-detection, 4 layout styles, row/col add/remove/resize (~510 lines)
│   ├── image_module.js          <-- 8-handle perimeter scaling, canvas crop tool, caption locking (~400 lines)
│   ├── keyboard_shortcuts.js    <-- 3-tier keyboard controller, Alt+Shift arrows, clipboard paste pipeline (~660 lines)
│   ├── history_manager.js       <-- Unified undo/redo snapshot stack with debouncing (~220 lines)
│   ├── markdown_module.js       <-- AI Chatbot Markdown parser (headings, tables, images, block math) (~340 lines)
│   └── math_module.js           <-- Universal Math Engine: KaTeX rendering & native MathML Core fallback (~465 lines)
└── tests/
    └── e2e_puppeteer.js         <-- 28-capability automated browser test suite (Microsoft Edge driver) (~885 lines)
```

---

## 🌟 2. Feature Inventory

### 2.1 Anchored, Elastic Spatial Canvas
* **Fixed (0,0) Origin:** Anchored firmly at the top-left corner. No disorienting infinite negative space or drifting objects.
* **Elastic Growth:** Automatically expands rightwards and downwards as cards are moved or text expands.
* **Double-Click Creation:** Double-clicking anywhere on the canvas instantly spawns a note card at that exact coordinate.
* **Pan & Zoom:** Smooth navigation via trackpad or middle-mouse drag, with zoom levels from 50% to 200%.

### 2.2 Authentic Note Containers & 8-Point Perimeter Resize
* **OneNote Header Bar:** Crisp grey header containing the move grip (`:::`) and delete button (`×`).
* **Universal 8-Point Perimeter Resize:** Every container, image card, and table features 8 perimeter resize handles (4 corners for proportional scaling, 4 edges for directional stretching).
* **Word Wrapping & Content Flow:** Text wraps dynamically to the container width.

### 2.3 Pop-Out & Pop-In (Fluid Structural Rearrangement)
* **Left-Margin Hover Grip (`:::`):** Appears beside every paragraph, image, table, or equation.
* **Rearrange Inside Container:** Dragging a grip up or down reorders elements smoothly within the note card.
* **Pop-Out (Detach):** Dragging a grip outside the container detaches that item and spawns a **brand-new note card** at the release point.
* **Pop-In (Merge via Blue Guideline):** Dragging any item or note card over another card illuminates a **live, radiant blue insertion guideline** between paragraphs. Releasing drops the content into that exact spot.

### 2.4 Table Engine (Auto-Detection & 4 Layout Themes)
* **Word + `Tab` Auto-Detection:** Typing a word and pressing `Tab` automatically converts that text line into a structured table.
* **4 Layout Formats (One-Click Switching):**
  1. *Classic Grid:* Sharp borders on all cells for standard notes.
  2. *Zebra Banded:* Alternating shaded rows for effortless scanning of dense data.
  3. *Modern Accent:* Sleek header bar with soft horizontal dividers and no vertical lines.
  4. *Data Matrix:* Monospaced, compact cell padding with light grid lines for financial and status data.
* **In-Cell Image Pasting:** Pasting pictures into a table cell scales the picture neatly to fit inside the cell without breaking layout.
* **Interactive Resizers:** Drag-to-resize columns and rows with safety limits preventing cell collapse.

### 2.5 Image Sizing, Locked Captions & In-Place Crop
* **Locked Captions:** Captions are permanently bound to images; detaching or moving an image keeps its caption intact.
* **Built-In Crop Tool:** Clicking "Crop" opens an in-place cropping box directly over the canvas. Dragging crop boundaries and clicking "Apply" slices the image immediately using HTML5 Canvas—no external software needed.
* **Caption Toggle:** Captions can be shown or hidden on demand via the floating image toolbar.

### 2.6 Universal Clipboard & AI Chatbot Markdown Pipeline
* **Natural Reading Order:** Pasted content maintains 100% authentic reading sequence (Paragraph 1 → Picture → Paragraph 2 → Equation), never allowing pictures or formulas to slide to the bottom.
* **AI Chatbot Markdown Cleaning:**
  * Clean bold headings (`### Title` → styled heading with zero hashtag clutter).
  * Markdown tables (`| A | B |` and borderless `A | B`) → live App Tables with layout format switchers.
  * Image markdown (`![Alt](url)` or linked `[![Alt](url)](link)`) → official Image Cards with captions.
  * Lists and bullet points rendered cleanly.
* **Clean Reading Filter:** Strips clutter from copied articles (footnote citations `[1]`, `[2, 3]`, `[note 1]`, `[edit]` links, blue URL underlines, and intrusive website background colors).

### 2.7 Universal Web & AI Math Engine (KaTeX + MathML Core)
* **Universal Math Detective:** Multi-source cascading extractor that detects formulas from:
  1. Wikipedia: `data-mw` source data and `alttext` attributes on `<math>`.
  2. KaTeX & MathJax: `<annotation encoding="application/x-tex">`.
  3. MathJax 2 & Blogs: `<script type="math/tex">` and data attributes (`data-latex`).
  4. Academic Journals (Nature, IEEE, Springer): Authentic native MathML Core.
  5. AI Chats (ChatGPT, Claude): Bracket equations (`\[ ... \]`, `$$ ... $$`, and `\begin{equation}`).
* **Textbook Quality (The KaTeX Artist):** Extracted formulas are rendered with crisp fractions, square roots, Greek letters ($\mu$, $\nu$, $\kappa$), tensor indices ($\Gamma^\mu_{\alpha\beta}$), and text labels.
* **Dual Display Forms:**
  * *Equation Cards:* Standalone display equations render as interactive cards with hover grips, editing tools, and live LaTeX editors.
  * *Inline Math Badges:* Formulas inside sentences (e.g., $e_y$, $K_p$, $G_{\mu\nu}$) render seamlessly as inline badges without breaking sentence flow.

### 2.8 3-Tier Keyboard Controller & Unified History
* **Tier 1 (Typing):** `Backspace` and `Delete` edit text only; line-start backspace un-indents or pulls sentences up. Note boxes cannot be accidentally destroyed while typing.
* **Tier 2 (Item Selected):** Clicking an image or table selects it; pressing `Delete` deletes only that item.
* **Tier 3 (Container Selected):** Clicking the container header selects the card; pressing `Delete` removes the card.
* **Unified History Manager:** Seamless `Ctrl+Z` (Undo) and `Ctrl+R` / `Ctrl+Y` (Redo) tracking text edits, spatial moves, and element detachments.

---

## 🎚️ 3. Canvas Multi-Level Control Hierarchy (The 4 Canvas Levels)

A key engineering breakthrough in our spatial canvas is the strict separation of **interactive levels**. Without this hierarchy, actions at one level (like editing text or cropping an image) would conflict with actions at another level (like dragging a container or panning the canvas).

```
+-----------------------------------------------------------------------------------------+
| LEVEL 4: FIXED OVERLAYS & HUD (Z-Index 1000 - 9999)                                     |
| Ribbon Toolbar, In-Place Crop Modal, Status Bar with live zoom & coordinates            |
+-----------------------------------------------------------------------------------------+
  |
  +---> LEVEL 0: GLOBAL SPATIAL VIEWPORT (Z-Index 0)
        Anchored (0,0) Origin, Elastic Auto-Growth, Pan/Zoom (50%-200%), Double-Click Spawn
        Coordinate Normalizer: (screen - stageOffset) / zoomLevel = exact canvas pixel
        |
        +---> LEVEL 1: NOTE CONTAINER LEVEL (Z-Index 10 - 100, dynamic active elevation)
              Header Bar Drag Grip (:::), 8-Point Perimeter Resize, Container Selection & Delete
              |
              +---> LEVEL 2: BLOCK & FLOW LEVEL (Structural Units)
                    Paragraphs, Tables, Image Cards, Equation Cards
                    Left-Margin Hover Grip (:::), In-Box Reorder, Pop-Out Detach, Pop-In Blue Line
                    |
                    +---> LEVEL 3: IN-ELEMENT & MICRO-INTERACTION LEVEL
                          ContentEditable Text (Immune Backspace), Table Cell Nav (Tab/Enter),
                          Image 8-Handle Resizers & Crop Slice, Equation Edit & Inline Math Pills
```

### 3.1 Level 0 — The Global Spatial Viewport (Infinite Stage)
* **Scale-Normalized Coordinate Mapping:**
  ```javascript
  // Screen to Canvas coordinate translation matrix:
  const x = (clientX - stageRect.left) / this.zoomLevel;
  const y = (clientY - stageRect.top) / this.zoomLevel;
  ```
  Every mouse click, double-click spawn, and drag drop operation calculates exact pixel coordinates regardless of whether the user is zoomed out at 50% or zoomed in at 200%.
* **Elastic Dynamic Growth (`ensureBounds`):**
  Continuously monitors all note boxes. If any card is dragged within 400px of the right or bottom boundary, the canvas automatically expands in that direction without screen stutter.
* **Global Navigation:** Middle-mouse drag or `Alt + Drag` pans the viewport smoothly, while `Ctrl + Mouse Wheel` zooms anchored around the cursor.

### 3.2 Level 1 — The Note Container Level (`.note-box`)
* **Spatial Placement:** Positioned absolutely in canvas coordinate space via `style.left` and `style.top`.
* **Dynamic Z-Index Elevation:** Clicking any note card brings it forward (`z-index: 10 + activeIndex`), ensuring the card being worked on is never obscured by surrounding cards.
* **Whole-Card Movement:** Handled exclusively via the grey top header bar move grip (`:::`), isolating whole-card movement from inner paragraph rearrangement.
* **Universal 8-Point Perimeter Resizing:** 8 handles positioned around the perimeter allow bidirectional scaling with live width/height updates and minimum boundaries preventing collapse.

### 3.3 Level 2 — The Block & Flow Level (`.canvas-block`)
* **Left-Margin Hover Grips (`:::`):** Appears to the left of each individual block (paragraph, table, image, equation).
* **In-Container Reordering:** Dragging vertically within the container smoothly reorders blocks.
* **Pop-Out Detaching:** Dragging a grip beyond the boundaries of the container triggers an instant detach, creating a fresh note box at the exact release point.
* **Pop-In Merging & Live Blue Guideline:** Dragging any block or container over another note card calculates the nearest vertical gap between children using `getBoundingClientRect()`, illuminating a radiant blue guideline and dropping the element into that exact slot.

### 3.4 Level 3 — In-Element & Micro-Interaction Level
* **Typing Protection (Immune Backspace):** Cursor position is checked via `window.getSelection()`. Backspace at the beginning of an empty line un-indents or merges paragraphs, but can **never** destroy the parent container.
* **Table Cell Matrix:** `Tab` moves to the next cell or spawns a new column; `Enter` creates a new row; cells accept embedded pictures with auto-fit boundaries.
* **Image Micro-Controls:** Bounded 8-handle perimeter scaling, locked captions, and interactive cropping modal.
* **Equation Micro-Controls:** Interactive Equation Cards with Edit/Delete toolbars, double-click LaTeX prompt, and inline math badges (`<span class="inline-math">`) that live inside sentences.

### 3.5 Event Isolation Architecture (Preventing Cross-Level Conflicts)
* **`contentEditable="false"` Protection:** All UI controls (buttons, grips, resize handles, toolbars) are marked non-editable so browser text selection engines cannot trap cursors or duplicate buttons on `Enter`.
* **`e.stopPropagation()` Containment:** Clicking or dragging micro-controls stops event bubbling, preventing the canvas from triggering double-click note creation or background selection changes.

### 3.6 Universal Keyboard Shortcut & Undo/Redo Matrix Across All Levels

The application features a strict **4-Level Keyboard Controller Engine** (`src/keyboard_shortcuts.js`) that isolates text typing from structural operations, ensuring you can never accidentally delete a note card while writing notes.

| Level | Shortcut / Key | Target Object | Action & Safety Isolation | Undo/Redo Integration |
|---|---|---|---|---|
| **Level 0: Canvas** | `Ctrl + V` | Entire Canvas | Pastes copied container, image, or table at exact mouse cursor position. | Pushes new state to `HistoryManager` undo stack. |
| **Level 0: Canvas** | `Ctrl + Z` | Canvas Stage | Undoes the last card movement, deletion, paste, or card addition. | Steps back 1 state in spatial history. |
| **Level 0: Canvas** | `Ctrl + Y` / `Ctrl + Shift + Z` / `Ctrl + R` | Canvas Stage | Redoes the last undone spatial action. Intercepts browser reload (`Ctrl+R`) to protect notes. | Steps forward 1 state in spatial history. |
| **Level 0: Canvas** | `Middle Mouse` / `Alt + Drag` | Viewport | Pans the infinite spatial canvas in any direction. | Real-time viewport offset (non-destructive). |
| **Level 0: Canvas** | `Ctrl + Mouse Wheel` | Viewport | Zooms between 50% and 200% centered around the mouse cursor. | Real-time zoom level (non-destructive). |
| **Level 1: Container** | `Delete` / `Backspace` | Header selected card | Permanently deletes the selected note container and its contents. | Pushes deletion state to Undo stack. |
| **Level 1: Container** | `Ctrl + C` | Selected Container | Deep-copies the entire container including all nested paragraphs, images, tables, and math. | Internal clipboard store + plain text fallback. |
| **Level 1: Container** | `Ctrl + X` | Selected Container | Cuts entire container and places in clipboard, removing it from canvas. | Pushes cut state to Undo stack. |
| **Level 1: Container** | `Ctrl + A` (3rd press) | Active Container | Selects the entire container card (selecting its header). | Focus / Selection state. |
| **Level 2: Block** | `Delete` / `Backspace` | Highlighted block (Image / Table) | Deletes only that highlighted item, leaving the parent container 100% intact. | Pushes block deletion to Undo stack. |
| **Level 2: Block** | `Ctrl + C` | Highlighted Image / Table | Copies the highlighted object (images with caption; tables with full grid structure). | Internal structured clipboard. |
| **Level 2: Block** | `Alt + Shift + Up / Down` | Paragraph / Block | Reorders the block up or down within the container. | Pushes reorder to Undo stack. |
| **Level 2: Block** | `Ctrl + Enter` | Paragraph Block | Splits / creates a brand-new draggable paragraph block with hover grip (`:::`) and triggers a signature visual glow pulse. | Pushes paragraph split to Undo stack. |
| **Level 2: Block** | `Tab` / `Shift + Tab` | Paragraph Block | Indents (+24px) or outdents (-24px) the block when cursor is at line start. | Pushes indent state to Undo stack. |
| **Level 2: Block** | `Alt + =` | Active Block | Inserts a new interactive OneNote LaTeX Equation Card. | Pushes equation creation to Undo stack. |
| **Level 3: Inline Text** | `Backspace` / `Delete` | Text Cursor inside line | Deletes characters or merges empty lines. **Container is 100% immune to deletion.** | Browser text undo (`execCommand('undo')`). |
| **Level 3: Inline Text** | `Ctrl + A` (1st press) | Active Block | Selects only the text inside the current line/block. | Native text range selection. |
| **Level 3: Inline Text** | `Ctrl + A` (2nd press) | Container Content | Expands selection to all text and items inside the current container. | Native text range selection. |
| **Level 3: Inline Text** | `Triple-Click` | Paragraph Text | Instantly selects the entire paragraph text cleanly. | Native paragraph range selection. |
| **Level 3: Table Cells** | `Tab` | Table Cell | Jumps cursor to the next cell. If at the end of a row, creates a new cell/column automatically. | Cell navigation / structure growth. |
| **Level 3: Table Cells** | `Enter` | Table Cell | Adds a new table row directly below current row without breaking the table. | Pushes row creation to Undo stack. |

#### Multi-Level Undo / Redo Engine Mechanics
1. **Typing-Level Undo:** When a user is typing text inside a line, pressing `Ctrl+Z` allows the browser's native text undo engine to step backwards through character keystrokes smoothly.
2. **Spatial / Structural-Level Undo:** If no text is selected or if the text cursor is at rest, pressing `Ctrl+Z` activates the global `HistoryManager`, restoring deleted cards, undoing dragged movements, reversing block reordering, and restoring detached cards.
3. **Safe Redo (`Ctrl+R`, `Ctrl+Y`, `Ctrl+Shift+Z`):** Many users habitually press `Ctrl+R` expecting "Redo" (as in Microsoft Office), which normally destroys web canvas state by refreshing the page. Our engine captures `Ctrl+R` during the capture phase (`window.addEventListener('keydown', ..., true)`), suppresses browser refresh, and safely executes Redo.

---

## 🛠️ 4. Development Chronicle: Problems Encountered & Architectural Solutions

Below is the complete engineering record of real-world bugs diagnosed and fixed across the development cycle:

| # | Challenge / Symptom | Root Cause | Architectural Solution |
|---|---------------------|------------|------------------------|
| **1** | **Accidental Box Deletion on Backspace** | Pressing backspace in an empty text block caused the browser's default contenteditable behavior to bubble up and delete the parent `.note-box`. | Implemented a **3-Tier Keyboard Controller** in `src/keyboard_shortcuts.js`. Intercepts Backspace, checks cursor offset using `Selection.anchorOffset`, merges paragraph text when appropriate, and strictly forbids container deletion while in typing mode. |
| **2** | **Corrupted DOM from Editable Controls** | UI buttons (Delete, Crop, Layout Switcher) placed inside note cards were duplicated or broken when users typed or pressed `Enter`. | Enforced strict UI containment: All buttons, menus, and resize handles are permanently flagged `contentEditable="false"`, `user-select: none`, and given protective CSS classes. |
| **3** | **Table Column Collapse & Overflow** | Standard HTML tables collapsed to fit text or overflowed note containers without way to adjust column widths. | Wrapped tables in an isolated `.table-wrapper` with 8-point perimeter resize handles and draggable column/row dividers with hard minimum-size safeguards. |
| **4** | **Coordinate Drift During Drag & Detach** | Dragging margin grips to detach items caused cards to jump because screen coordinates were used without accounting for canvas pan and zoom. | Built a spatial transform matrix in `src/canvas.js` (`screenToCanvas(x, y)`), translating raw mouse events into exact canvas coordinates. |
| **5** | **Lost Captions During Image Detach** | Moving or detaching an image left its caption behind as an orphaned text line. | Implemented **Caption Locking** in `src/image_module.js`. Images and captions are unified inside a single `.image-card` DOM unit that moves, resizes, and detaches as one object. |
| **6** | **Displaced Pictures Sliding to Bottom** | Pasting rich web articles caused pictures to jump to the very bottom of the note card instead of staying between paragraphs. | Discovered that unmatched images were being appended at the end (`units.push(...htmlImgs)`). Refactored to a **Single Sequential Pipeline** in `parseHTMLToOutlineUnits` that visits DOM nodes strictly in natural reading sequence. |
| **7** | **Citation Clutter & Broken Hyperlinks** | Pasting Wikipedia articles brought in citation numbers (`[1]`, `[2, 3]`), `[edit]` markers, and blue underlines. | Developed a multi-stage sanitizer in `src/app.js`: Regex `/\[\s*(?:\d+|note\s*\d+|[a-z])(?:\s*[,;–-]\s*(?:\d+|note\s*\d+|[a-z]))*\s*\]|\[edit\]/gi` strips footnote noise, while link unwrapping replaces `<a>` with plain text while keeping the words. |
| **8** | **Nested Braces Breaking Fractions** | Complex formulas like `{d^{2}x^{\mu} \over ds^{2}}` failed regex `\{([^{}]+)\s*\\over\s*([^{}]+)\}` because powers contained nested curly braces `{...}`. | Replaced regex with a **Balanced-Brace Depth Scanner** in `src/math_module.js` (`parseFractions`). Traverses backwards and forwards from `\over`, matching opening and closing braces regardless of nested powers or indices. |
| **9** | **HTML Multi-Equation Dropping** | Copying Wikipedia articles with 10+ equations captured only the first equation; all other equations and paragraphs disappeared. | Multi-block containers (`div.mw-parser-output`, `<section>`, `<dl>`) were being classified as a single math element if `querySelector('math')` was found, returning early. Changed to **Recursive Container Traversal**, visiting every child element step-by-step. |
| **10** | **AI Math Brackets Rendered as Raw Text** | ChatGPT/Claude pastes (`\[ \text{Steering correction} ... \]`) appeared as raw text brackets in web paste. | Web clipboard formats include HTML. Added in-place bracket math detection (`\[ ... \]`, `$$ ... $$`, `\begin{equation}`) to `parseHTMLToOutlineUnits`, promoting AI equations to official Equation Cards. |
| **11** | **Incomplete Equations (`GR - g = T`)** | Wikipedia formulas rendered missing Greek letters ($\mu$, $\nu$, $\kappa$), tiny fractions ($\frac{1}{2}$), and tensors, leaving only loose English letters. | Wikipedia hides authentic LaTeX in `alttext` and `data-mw` (not standard `alt`). Upgraded `extractMathInfo` to inspect `data-mw`, `alttext`, `<annotation>`, and script tags, feeding the complete formula to **KaTeX** for 100% textbook quality. |
| **12** | **Zero Visual Feedback on Paragraph Creation** | Pressing `Ctrl+Enter` or clicking the ribbon `¶ Paragraph` button created an empty paragraph block (`<br>`) with a hidden hover grip (`opacity: 0`), leaving users unaware if a block was actually created. | Implemented a **Signature Visual Pulse Feedback**: Newly created blocks receive `.block-spawn-pulse`, flashing with a delicate OneNote purple accent glow (`rgba(119, 25, 170, 0.22)`) for 550ms before smoothly dissolving. Added `:active` press scaling (`transform: scale(0.96)`) to ribbon buttons for instant tactile confirmation. |

---

## 🧪 5. Automated Verification Suite (28 Capabilities)

Automated tests are executed using **Puppeteer** driving the local **Microsoft Edge** browser (`node tests/e2e_puppeteer.js`):

```
========================================
📊 Test Results: 28/28 Passed (100%)
========================================
```

1. **App Startup & Starter Notes:** Initial load renders starter notes and ribbon toolbar.
2. **Double-Click Spawn:** Double-clicking canvas spawns new note box at exact coordinates.
3. **Table Auto-Detection & 4 Styles:** Word+Tab creates table; switches through Classic, Zebra, Accent, and Matrix formats.
4. **Image Sizing & In-Place Crop:** Renders image card with locked caption, opens crop modal, slices image via HTML5 Canvas, toggles caption.
5. **Pop-Out Detaching:** Dragging margin grip out to canvas creates a standalone note box.
6. **Pop-In Merging & Blue Guideline:** Hovering over a card displays radiant blue drop guideline; release merges content.
7. **3-Tier Keyboard Controller:** Backspace inside text never deletes container; container header Delete removes container.
8. **Universal Clipboard:** Ctrl+C copies container; Ctrl+V pastes both internal and external content.
9. **Tier 2 Item Deletion:** Selecting an image or table and pressing Delete removes only that item.
10. **Unified Undo & Redo:** Ctrl+Z undoes changes; Ctrl+R redoes without reloading page.
11. **Locked UI Controls:** Floating buttons, menus, and handles are permanently non-editable.
12. **Table Cell Image Paste:** Images paste directly into table cells with auto-fit wrapper.
13. **Table Row/Col Operations:** Adding and removing rows/columns with safety limits and interactive drag resizers.
14. **Universal 8-Point Perimeter Resize:** Bounded objects adhere to 8-point resize rules.
15. **Object Copy & Canvas Paste:** Ctrl+C copies selected image/table; Ctrl+V on canvas spawns fresh note card.
16. **Paragraph Blocks & Edge Resizers:** Draggable paragraph blocks with sleek edge resizers.
17. **Rich Web HTML Paste:** Strips citations `[1, 2]`, unwraps links, and upgrades images/tables to App Objects.
18. **LaTeX & Math Formula Support:** Equation cards, Alt+= shortcut, and inline $math$ render textbook formulas.
19. **Paragraph Selection & Layout Preservation:** Triple-click and grip handle select paragraphs; headings and lists preserved.
20. **AI Chatbot Markdown Paste:** Converts `###` headings, `![img]` pictures, and `|` tables with zero hashtag clutter.
21. **In-Place Picture Position:** Pictures stay in exact original position between paragraphs in reading sequence.
22. **Advanced Math Engine:** AI brackets (`\[...]`), `<mtext>`, fractions, Greek symbols ($\Gamma$), and tensor indices.
23. **Multi-Equation Web HTML & AI Brackets:** Captures ALL 10+ equations in original sequence without dropping any, rendering AI brackets as Equation Cards.

---

## 🔒 6. Operational Rules & Best Practices

1. **Local-Only Git Discipline:**
   * All work remains strictly local.
   * **NEVER run `git push`** under any circumstances.
2. **Modular File Sizes (~350–500 Lines):**
   * Keep each file focused on a single responsibility.
   * Regularly audit line counts across `src/` to prevent bloated monoliths.
3. **Plain-Language Communication:**
   * All explanations and updates must be delivered in clear, everyday language free of unnecessary technical jargon.
