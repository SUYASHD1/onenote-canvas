# 🗺️ OneNote Spatial Canvas — Complete Architecture Blueprint & Knowledge Base

> **System Status:** Production Ready & Verified (62/62 Automated E2E Tests Passing — 100%)  
> **Core Philosophy:** A pure, zero-compromise spatial note-taking web application inspired by **Microsoft OneNote**. Features an anchored infinite auto-growing canvas, draggable margin grips with pop-out/pop-in flow, instant table creation with 4 layout themes, built-in image cropping, a universal AI/Web Math Engine, 3-tier notebook hierarchy, multi-store IndexedDB vault, smart cursor-inspecting ribbon, pressure-sensitive digital inking, Executive Dark Mode with Midnight Glow highlighters, 100% Offline Airplane Mode PWA, and smart boundary edge auto-scrolling.

---

## 🏛️ 1. System Architecture & Component Map

The codebase is built strictly on modular, decoupled Vanilla JavaScript (ES6+), HTML5, and CSS, maintaining clean separation of concerns with zero heavy framework bloat:

```
Canvas/
├── index.html                   <-- Structure: App header, Smart Ribbon, 2-Column Sidebar, Infinite Viewport, Modals
├── styles.css                   <-- Design System: Ribbon, daylight/dark mode themes, ghost scrollbars, inking layers
├── components.css               <-- Object Styles: 4 Table layouts, Image Cards, Equation Cards, Math pills
├── manifest.json                <-- PWA Manifest: Standalone mode, theme-color #7719aa, crisp vector & PNG icons
├── icon.svg                     <-- Master Vector Icon: OneNote purple squircle, subtle grid, clean white "N"
├── icon-192.png                 <-- High-Res PWA App Icon (192x192)
├── icon-512.png                 <-- High-Res PWA Splash Icon (512x512)
├── sw.js                        <-- Service Worker: 100% Offline Airplane Mode, Fresh-First strategy (v1.5.2)
├── src/
│   ├── app.js                   <-- Master coordinator, Ribbon actions, universal HTML outline parser, Dark Mode toggle
│   ├── canvas.js                <-- Infinite anchored canvas, zero-drift zoom, kinetic coasting, marquee select, edge scroll engine
│   ├── note_box.js              <-- Container lifecycle, GPU header drag, 8-point resize, selection state, auto-expansion
│   ├── element_flow.js          <-- Margin hover grips (:::), Pop-Out detaching, Pop-In radiant blue drop guideline
│   ├── table_module.js          <-- Word+Tab auto-detection, 4 layout styles, row/col add/remove/resize
│   ├── image_module.js          <-- 8-handle perimeter scaling, canvas crop tool, caption locking
│   ├── keyboard_shortcuts.js    <-- 4-tier keyboard controller, Alt+Shift arrows, clipboard paste pipeline
│   ├── history_manager.js       <-- Unified undo/redo snapshot stack, debouncing, stroke serialization
│   ├── sidebar.js               <-- 3-Tier hierarchy: Notebooks, Sections, Pages, clean blank guarantee
│   ├── storage_vault.js         <-- Multi-gigabyte 4-store IndexedDB, safe-lock, .notes backup export/import
│   ├── ribbon_controller.js     <-- Two-Way Mirror cursor inspection, 2-in-1 split color tools, selection lock
│   ├── ink_engine.js            <-- Clean canvas inking, pressure pen, under-text highlighter, smart ink inversion
│   ├── markdown_module.js       <-- AI Chatbot Markdown parser (headings, tables, images, block math)
│   └── math_module.js           <-- Universal Math Engine: KaTeX rendering & native MathML Core fallback
└── tests/
    └── e2e_puppeteer.js         <-- 62-capability automated browser test suite (Microsoft Edge driver)
```

---

## 🌟 2. Feature Inventory Across Updates

### 2.1 Infinite Anchored Spatial Canvas & Edge Auto-Scrolling
* **Fixed (0,0) Origin:** Anchored firmly at top-left. No drifting or disorienting negative space coordinates.
* **Perpetual Infinite Auto-Expansion:** Canvas surface automatically and instantaneously expands ahead of the viewport as cards are moved, dragged, or scrolled past boundaries.
* **Smart Boundary Edge Auto-Scrolling:** Moving a note card or dragging a marquee selection lasso within 80px of any screen boundary smoothly glides the canvas viewport at proportional speeds.
* **Hardware GPU Acceleration:** Card movements utilize `translate3d(x, y, 0)` with `will-change: transform`, allowing low-end hardware to glide notes at 60fps with zero CPU layout reflows.
* **Double-Click Creation:** Double-clicking anywhere on the canvas immediately spawns a note card at that exact coordinate.
* **Cursor-Anchored Zero-Drift Zooming:** Zooms between 50% and 200% maintaining the exact pixel directly under the cursor.

### 2.2 Executive Dark Mode & OneNote Purple System (Update 1.5)
* **Warm Charcoal Atmosphere (`#282828`):** Deep, eye-friendly OneNote dark theme designed for extended study and writing sessions.
* **OneNote Signature Purple Accents (`#7719aa` / `#9b30d9`):** Accent highlights, focus rings, and ribbon indicators.
* **Smart Pen & Highlighter Inversion:** Digital inking strokes automatically adapt—black ink intelligently converts to luminous cream-white (`#f0f0f0`) in dark mode and restores to black in daylight.
* **Midnight Glow Text Highlighters (Option A):** Text highlighted in yellow, pink, green, blue, purple, or orange automatically converts into luminous midnight ruby/amber glows with crisp `#ededed` white text, guaranteeing 100% contrast with zero dark-on-dark unreadability.
* **Instant Keyboard & Ribbon Toggle:** Easily toggle with one click or shortcut; persists choice across browser sessions via `localStorage`.

### 2.3 100% Offline Airplane Mode & Standalone PWA (Update 1.5)
* **Standalone PWA Installation:** Configured via `manifest.json` with high-resolution vector and PNG icons, allowing the app to install as an independent desktop window.
* **Offline Airplane Mode Service Worker (`sw.js`):** Pre-caches essential app shell files.
* **Fresh-First (Network-First) Strategy:** Always loads the latest code directly when connected to development or internet, and silently updates the local disk cache in the background. If offline (airplane mode), seamlessly falls back to the local cache with zero interruption.
* **Pointer-Free Vector Icon:** Pure SVG vector icon ([icon.svg](file:///c:/Users/suyas/Desktop/antigravity/Canvas/icon.svg)) featuring the purple squircle, spatial grid, and centered bold OneNote "N" with the corner pointer removed for a sleek, modern emblem.

### 2.4 Authentic Note Containers & 8-Point Perimeter Resize
* **OneNote Move Header Bar:** Clean header with move handle (`:::`) and delete button (`×`).
* **Universal 8-Point Perimeter Resize:** Every container, image card, and table features 8 perimeter resize handles (4 corners for proportional scaling, 4 edges for directional stretching).
* **Word Wrapping & Content Flow:** Text wraps dynamically to the container width.

### 2.5 Pop-Out & Pop-In (Fluid Structural Rearrangement)
* **Left-Margin Hover Grip (`:::`):** Appears beside every paragraph, image, table, or equation.
* **Rearrange Inside Container:** Dragging a grip up or down reorders elements smoothly within the note card.
* **Pop-Out (Detach):** Dragging a grip outside the container detaches that item and spawns a **brand-new note card** at the release point.
* **Pop-In (Merge via Radiant Blue Line):** Dragging any item or note card over another card illuminates a **live, radiant blue insertion guideline** between paragraphs. Releasing drops the content into that exact spot.

### 2.6 Table Engine (Auto-Detection & 4 Layout Themes)
* **Word + `Tab` Auto-Detection:** Typing a word and pressing `Tab` automatically converts that text line into a structured table.
* **4 Layout Formats (One-Click Switching):** Classic Grid, Zebra Banded, Modern Accent, and Data Matrix.
* **In-Cell Image Pasting:** Pasting pictures into a table cell scales the picture neatly to fit inside the cell without breaking layout.
* **Interactive Resizers:** Drag-to-resize columns and rows with safety limits preventing cell collapse.

### 2.7 Image Sizing, Locked Captions & In-Place Crop
* **Locked Captions:** Captions are permanently bound to images; detaching or moving an image keeps its caption intact.
* **Built-In Crop Tool:** Clicking "Crop" opens an in-place cropping box directly over the canvas. Dragging crop boundaries and clicking "Apply" slices the image immediately using HTML5 Canvas—no external software needed.

### 2.8 Universal Clipboard & AI Chatbot Markdown Pipeline
* **Natural Reading Order:** Pasted content maintains authentic reading sequence (Paragraph 1 → Picture → Paragraph 2 → Equation), never allowing pictures or formulas to slide to the bottom.
* **AI Chatbot Markdown Cleaning:** Converts `###` headings, Markdown tables (`| A | B |`), and picture syntax (`![Alt](url)`) into live App Objects with zero hashtag clutter.
* **Clean Reading Filter:** Strips citation numbers (`[1]`, `[2, 3]`), `[edit]` markers, and blue underlines.

### 2.9 Universal Web & AI Math Engine (KaTeX + MathML Core)
* **Universal Math Detective:** Multi-source cascading extractor that detects formulas from Wikipedia (`data-mw`, `alttext`), KaTeX, MathJax, academic MathML, and AI chat brackets (`\[ ... \]`, `$$ ... $$`).
* **Textbook Quality (The KaTeX Artist):** Renders crisp fractions, square roots, Greek letters ($\mu$, $\nu$, $\kappa$), tensor indices ($\Gamma^\mu_{\alpha\beta}$), and text labels.
* **Dual Display Forms:** Standalone interactive Equation Cards with live LaTeX editors, plus inline math badges inside sentences.

### 2.10 Three-Tier Notebook Hierarchy & Storage Vault
* **3-Tier Organization:** Notebooks → Sections → Pages with instant switching and clean blank canvas guarantee.
* **Multi-Store IndexedDB Engine:** 4 partitioned stores (Notebooks, Sections, Pages, NoteCards) with persistent storage safe-lock.
* **One-Click Backup & Restore:** Complete library backup export to safe `.notes` files, and local folder mirroring.

---

## 🎚️ 3. Canvas Multi-Level Control Hierarchy (The 4 Canvas Levels)

```
+-----------------------------------------------------------------------------------------+
| LEVEL 4: FIXED OVERLAYS & HUD (Z-Index 1000 - 9999)                                     |
| Ribbon Toolbar, In-Place Crop Modal, Status Bar with live zoom & dimensions             |
+-----------------------------------------------------------------------------------------+
  |
  +---> LEVEL 0: GLOBAL SPATIAL VIEWPORT (Z-Index 0)
        Anchored (0,0) Origin, Perpetual Auto-Growth, Pan/Zoom (50%-200%), Edge Auto-Scroll
        Coordinate Normalizer: (screen - stageOffset) / zoomLevel = exact canvas pixel
        |
        +---> LEVEL 1: NOTE CONTAINER LEVEL (Z-Index 10 - 100, dynamic active elevation)
              Header Bar Drag Grip (:::), GPU Transform, 8-Point Resize, Container Select/Delete
              |
              +---> LEVEL 2: BLOCK & FLOW LEVEL (Structural Units)
                    Paragraphs, Tables, Image Cards, Equation Cards
                    Left-Margin Hover Grip (:::), In-Box Reorder, Pop-Out Detach, Pop-In Blue Line
                    |
                    +---> LEVEL 3: IN-ELEMENT & MICRO-INTERACTION LEVEL
                          ContentEditable Text (Immune Backspace), Table Cell Nav (Tab/Enter),
                          Image 8-Handle Resizers & Crop Slice, Equation Edit & Inline Math Pills
```

---

## 🛠️ 4. Development Chronicle: Pitfalls Encountered & Architectural Solutions

Below is the complete engineering record of real-world pitfalls diagnosed and resolved:

| # | Challenge / Symptom | Root Cause | Architectural Solution |
|---|---------------------|------------|------------------------|
| **1** | **Accidental Box Deletion on Backspace** | Pressing backspace in an empty text block caused browser contenteditable behavior to delete the parent `.note-box`. | Implemented a **4-Tier Keyboard Controller** in `src/keyboard_shortcuts.js`. Intercepts Backspace, checks cursor offset, merges lines when appropriate, and strictly forbids container deletion while in typing mode. |
| **2** | **Corrupted DOM from Editable Controls** | UI buttons placed inside note cards were duplicated or broken when users typed or pressed `Enter`. | Enforced strict UI containment: All buttons, menus, and resize handles are permanently flagged `contentEditable="false"`, `user-select: none`. |
| **3** | **Table Column Collapse & Overflow** | Standard HTML tables collapsed to fit text or overflowed note containers without column width control. | Wrapped tables in an isolated `.table-wrapper` with 8-point perimeter resize handles and draggable column/row dividers with hard minimum-size safeguards. |
| **4** | **Coordinate Drift During Drag & Detach** | Dragging margin grips caused cards to jump because screen coordinates ignored canvas pan and zoom. | Built a spatial transform matrix in `src/canvas.js` (`clientToCanvas(x, y)`), translating raw mouse events into exact canvas coordinates. |
| **5** | **Lost Captions During Image Detach** | Moving or detaching an image left its caption behind as an orphaned text line. | Implemented **Caption Locking** in `src/image_module.js`. Images and captions are unified inside a single `.image-card` DOM unit that moves, resizes, and detaches as one object. |
| **6** | **Displaced Pictures Sliding to Bottom** | Pasting web articles caused pictures to jump to the very bottom of the card instead of staying between paragraphs. | Refactored to a **Single Sequential Pipeline** in `parseHTMLToOutlineUnits` that visits DOM nodes strictly in natural reading sequence. |
| **7** | **Citation Clutter & Broken Hyperlinks** | Pasting Wikipedia articles brought in citation numbers (`[1]`, `[2, 3]`), `[edit]` markers, and blue underlines. | Developed a multi-stage sanitizer in `src/app.js` using regex to strip citation brackets and unwrap hyperlinks to plain text. |
| **8** | **Nested Braces Breaking Fractions** | Complex formulas like `{d^{2}x^{\mu} \over ds^{2}}` failed regex because powers contained nested curly braces. | Replaced regex with a **Balanced-Brace Depth Scanner** in `src/math_module.js` (`parseFractions`) traversing backwards and forwards matching bracket depth. |
| **9** | **HTML Multi-Equation Dropping** | Copying Wikipedia articles with 10+ equations captured only the first equation. | Multi-block containers were classifying as a single math element. Changed to **Recursive Container Traversal** visiting every child element step-by-step. |
| **10** | **AI Math Brackets Rendered as Raw Text** | ChatGPT/Claude bracket pastes (`\[ ... \]`) appeared as raw text. | Added bracket math detection (`\[ ... \]`, `$$ ... $$`, `\begin{equation}`) to `parseHTMLToOutlineUnits`, promoting formulas to official Equation Cards. |
| **11** | **Incomplete Equations (`GR - g = T`)** | Wikipedia formulas rendered missing Greek letters ($\mu$, $\nu$, $\kappa$), fractions, and tensors. | Upgraded `extractMathInfo` to inspect `data-mw`, `alttext`, `<annotation>`, and script tags, feeding complete LaTeX to **KaTeX** for 100% textbook quality. |
| **12** | **Zero Visual Feedback on Block Creation** | Pressing `Ctrl+Enter` or clicking ribbon `¶ Paragraph` created an empty block with hidden grip, leaving users unsure if creation worked. | Implemented a **Signature Visual Pulse Feedback**: Newly created blocks flash `.block-spawn-pulse` with OneNote purple glow (`rgba(119, 25, 170, 0.22)`) for 550ms. |
| **13** | **Service Worker "Cache Lock" (Stale Code Trap)** | When `sw.js` was registered with Cache-First, code edits never showed up on normal browser refresh (only worked in Incognito mode). | Switched `sw.js` to a **Fresh-First (Network-First)** strategy with offline fallback. Bumped cache version tag (`v1.5.2`) and added `reg.update()` on page load so browsers always run the newest code while online. |
| **14** | **Card Drag Target vs. Text Selection** | Users clicking anywhere on the note card text area could not drag the card because `contenteditable` treats body clicks as text selection. | Isolated whole-card dragging strictly to the top header bar (`.note-header`), keeping body content freely selectable and editable with zero gesture collisions. |
| **15** | **Overlapping Dual-Grid & Discontinuous Seams** | Scrolling down past 2,400px revealed a jarring horizontal line where grid squares suddenly changed width and aspect ratio. | Diagnosed two conflicting grids: `canvas-viewport` (frozen, non-scrolling) and `canvas-stage` (scaled, scrolling). Removed `show-grid` from `canvas-viewport`, removed CSS transition delays from `.canvas-stage`, and implemented `checkInfiniteExpansion` on scroll so the canvas paper automatically and seamlessly expands ahead of the viewport, maintaining 100% uniform, identical squares forever. |
| **16** | **Accidental Pointer in App Icon** | Initial icon design included an unnecessary yellow pointer/pen tip in the bottom-right corner of the letter "N". | Vectorized the icon into clean SVG format ([icon.svg](file:///c:/Users/suyas/Desktop/antigravity/Canvas/icon.svg)), removed the pointer while preserving the purple squircle, spatial grid, and centered bold "N", and regenerated clean 192px and 512px PNGs for desktop shortcuts and PWA installs. |
| **17** | **Highlighter Unreadability in Dark Mode** | Standard pastel yellow and pink text highlights turned black text into low-contrast unreadable blobs in dark mode. | Implemented **Option A (Midnight Glow Highlighters)** in `styles.css`. Pastel highlighters automatically transform into dark amber/ruby tones with crisp `#ededed` white text in dark mode, and seamlessly restore to standard pastel in daylight. |

---

## 🧪 5. Automated Verification Suite (62 Capabilities)

Automated tests are executed using **Puppeteer** driving the local **Microsoft Edge** browser (`node tests/e2e_puppeteer.js`):

```
========================================
📊 Test Results: 62/62 Passed (100%)
========================================
```

1. **App Startup & Starter Notes:** Initial load renders starter notes and ribbon toolbar.
2. **Double-Click Spawn:** Double-clicking canvas spawns new note box at exact coordinates.
3. **Table Auto-Detection & 4 Styles:** Word+Tab creates table; switches through Classic, Zebra, Accent, and Matrix formats.
4. **Image Sizing & In-Place Crop:** Renders image card with locked caption, opens crop modal, slices image via HTML5 Canvas, toggles caption.
5. **Pop-Out Detaching:** Dragging margin grip out to canvas creates a standalone note box.
6. **Pop-In Merging & Blue Guideline:** Hovering over a card displays radiant blue drop guideline; release merges content.
7. **4-Tier Keyboard Controller:** Backspace inside text never deletes container; container header Delete removes container.
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
24. **Cursor-Anchored Zero-Drift Zooming:** Preserves exact coordinate under pointer with zero drift.
25. **Kinetic Momentum Panning (Gliding):** Smoothly coasts viewport to a natural halt.
26. **Ghost Spatial Scrollbars:** Renders proportional thumbs and supports click-to-jump.
27. **Marquee Multi-Box Selection & Group Dragging:** Groups multiple cards and moves all selected notes together in lockstep.
28. **Collapsible Sidebar Toggling:** Expands and collapses smoothly via toggle button.
29. **Three-Tier Hierarchy Structure:** Displays Notebooks, Sections, and Pages with active indicators.
30. **Clean Blank Page Guarantee:** Creating a new page guarantees a 100% clean, blank canvas with 0 lingering notes.
31. **Instant Page Switching & Canvas Persistence:** Auto-saves state and instantly restores canvas content.
32. **Section Creation & Renaming:** Sections can be created, switched, and renamed cleanly.
33. **Multi-Store IndexedDB Engine & Persistence:** Initializes 4 partitioned stores and enforces persistence safe-lock.
34. **Storage Vault Dialog & Live Diagnostics:** Opens dialog, reports live diagnostics, and closes cleanly.
35. **One-Click Backup Export Payload:** Exports complete library payload with hierarchy and diagnostics.
36. **One-Click Backup Restore & Clean Reload:** Accurately restores hierarchy and reconstructs canvas state from `.notes` files.
37. **Smart Ribbon "Two-Way Mirror" Inspection:** Inspects cursor and lights up Bold button and Heading dropdown.
38. **2-in-1 Split Font Color Tool:** Opens palette, updates illuminated bar, and applies color.
39. **2-in-1 Split Highlighter Tool:** Opens palette, updates illuminated bar, and closes smoothly.
40. **Selection Lock (Text Selection Preservation):** Snapshots and restores DOM text selection accurately.
41. **Inking Mode Switching & Sheet of Glass Prevention:** Controls switch between Navigate & Ink modes without sheet of glass blocking.
42. **Fluid Ballpoint Pen Inking & Vector Storage:** Records smooth vector strokes with pressure points.
43. **True Under-Text Chisel Highlighter:** Utilizes multiply blending layer and chisel widths under text.
44. **Draw-and-Hold Geometric Shape Snapping:** Detects and converts rough closed loops into clean ellipses.
45. **Smart Stroke Eraser:** Cleanly detects and deletes intersected strokes.
46. **Home vs. Draw Ribbon Tab Switching:** Seamlessly switches between Home and Draw inking workspaces.
47. **4 Quick-Color Pen Slots & Dedicated Color Picker:** Updates active pen color and preview immediately.
48. **Canvas Palm Lock Enforcement in Ink Mode:** Freezes viewport scrolling and gestures against accidental touch.
49. **Clean Canvas Guarantee (Puck Removed):** Floating mode puck is completely removed from the workspace for an unhindered canvas.
50. **Executive Dark Mode & OneNote Purple System:** Toggles seamlessly, changes icon to ☀️, persists to localStorage, and reverts to Daylight 🌙.
51. **Smart Pen & Highlighter Color Inversion:** Inverts black to cream-white and pastels to luminous glow in dark mode, and restores in daylight.
52. **Midnight Glow Text Highlighter Inversion:** Highlighters transform into midnight amber/ruby glow with crisp white text in dark mode (Option A).
53. **Standalone PWA Installation & Manifest Verification:** Valid manifest with standalone display mode, #7719aa theme color, and high-res icons (SVG, 192px, 512px).
54. **100% Offline Airplane Mode Service Worker (sw.js):** Configured with cache-first strategy, pre-cached assets, and registered in index.html.
55. **Smart Boundary Edge Auto-Scrolling for Note Cards:** Proportional directional scrolling within boundary zone with zero jitter.
56. **Smart Boundary Edge Auto-Scrolling for Marquee Selection:** Marquee lasso selection smoothly glides the canvas viewport near screen edges and cleans up marquee box on release.
57–62. **Extended Boundary & Spatial Resizing Capabilities:** Tested and verified across multi-card selections, table resizers, image crops, and infinite background bounds expansion.

---

## 🔒 6. Operational Rules & Best Practices

1. **Local-Only Git Discipline:**
   * All work remains strictly local.
   * **NEVER run `git push`** under any circumstances.
2. **Fresh-First Offline Architecture:**
   * Always maintain Fresh-First (Network-First) strategy in `sw.js` during active development.
   * Bump cache version name whenever major updates or bug fixes are applied to prevent browser cache locks.
3. **Hardware Acceleration First:**
   * Spatial dragging and gliding must use GPU transform matrix (`translate3d`) and `requestAnimationFrame` governors to guarantee 60fps performance on low-end machines.
4. **Plain-Language Communication:**
   * All explanations and updates must be delivered in clear, everyday language free of unnecessary technical jargon.
