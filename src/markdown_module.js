/**
 * OneNote Spatial Canvas - AI Markdown & Chatbot Converter Module
 * 
 * Translates AI chatbot output (ChatGPT, Claude, Gemini, Copilot, DeepSeek)
 * into native OneNote outline units:
 * - ### Headings -> App Heading Blocks (h1-h6) with margin grips
 * - ![alt](url) -> App Image Objects with resize handles & crop tools
 * - | Table | -> App Interactive Tables with 4 layout styles
 * - - Bullet & 1. Numbered lists -> App List Blocks
 * - $$ Math $$ -> App Equation Blocks
 * - **bold**, *italic*, `code` -> Clean rich text formatting
 */

class MarkdownModule {
  constructor(app) {
    this.app = app;
  }

  /**
   * Inspects incoming text for unambiguous Markdown / AI Chatbot signals
   */
  isMarkdown(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.length < 2) return false;

    // 1. Markdown headings: # Title, ## Section, ### Sub-section
    if (/(^|\n)\s*#{1,6}\s+\S/m.test(trimmed)) return true;

    // 2. Markdown image: ![alt](url) or [![alt](url)](link) or <img ...>
    if (/!\[([^\]]*)\]\(\s*([^\s)"']+)/.test(trimmed)) return true;

    // 3. Markdown table: any line with pipe followed by separator row with - and |
    if (/(^|\n)\s*\|?.+\|.+\n\s*\|?[\s\-:]+\|[\s\-:]*\|?/m.test(trimmed)) return true;

    // 4. Code block fences: ```python or ```
    if (/(^|\n)\s*```[a-zA-Z0-9_-]*\s*\n/m.test(trimmed)) return true;

    // 5. Block math: $$ formula $$ or \[ formula \] or \begin{equation}
    if (/(^|\n)\s*(?:\$\$|\\\[|\\begin\{(?:equation|align)\})/.test(trimmed)) return true;
    if (/\\\([^\)]+\\\)/.test(trimmed)) return true;

    // 6. Multiple bullet lines or numbered list lines
    const bulletMatches = trimmed.match(/(^|\n)\s*[-*+]\s+\S/g);
    if (bulletMatches && bulletMatches.length >= 2) return true;

    const numMatches = trimmed.match(/(^|\n)\s*\d+\.\s+\S/g);
    if (numMatches && numMatches.length >= 2) return true;

    return false;
  }

  /**
   * Formats inline markdown formatting (bold, italic, code, links, math badges)
   */
  formatInline(text) {
    if (!text) return '';
    let out = text;

    // 1. Bold: **text** or __text__
    out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    out = out.replace(/__(.+?)__/g, '<b>$1</b>');

    // 2. Italic: *text* or _text_
    out = out.replace(/\*([^*]+?)\*/g, '<i>$1</i>');
    out = out.replace(/(^|\s)_([^_]+?)_(\s|$)/g, '$1<i>$2</i>$3');

    // 3. Inline code: `code`
    out = out.replace(/`([^`]+?)`/g, '<code style="background:rgba(0,0,0,0.06);padding:2px 5px;border-radius:4px;font-family:monospace;font-size:0.9em;">$1</code>');

    // 4. Links: [text](url) -> unwrap to text for clean reading notes
    out = out.replace(/\[([^\]]+)\]\((?:https?:\/\/[^)]+)\)/g, '$1');

    // 5. Strikethrough: ~~text~~
    out = out.replace(/~~(.+?)~~/g, '<del>$1</del>');

    return out;
  }

  /**
   * Robust extractor for pictures in AI chatbot messages:
   * Handles linked pictures [![Alt](url)](link), standard ![Alt](url "title"), and raw <img src="...">
   */
  extractImageFromText(line) {
    if (!line) return null;
    const trimmed = line.trim();

    // 1. Linked Markdown Image: [![Alt](url)](link)
    const linkedMatch = trimmed.match(/\[!\[([^\]]*)\]\(\s*([^\s)"']+)(?:\s+["'][^"']*["'])?\s*\)\]\([^)]+\)/);
    if (linkedMatch) {
      return { src: linkedMatch[2].trim(), caption: linkedMatch[1].trim(), raw: linkedMatch[0] };
    }

    // 2. Standard Markdown Image: ![Alt](url "optional title")
    const mdMatch = trimmed.match(/!\[([^\]]*)\]\(\s*([^\s)"']+)(?:\s+["'][^"']*["'])?\s*\)/);
    if (mdMatch) {
      return { src: mdMatch[2].trim(), caption: mdMatch[1].trim(), raw: mdMatch[0] };
    }

    // 3. Raw HTML <img> tag
    const htmlImgMatch = trimmed.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
    if (htmlImgMatch) {
      const src = htmlImgMatch[1].trim();
      const altMatch = trimmed.match(/alt=["']([^"']*)["']/i);
      const titleMatch = trimmed.match(/title=["']([^"']*)["']/i);
      const caption = (altMatch && altMatch[1]) || (titleMatch && titleMatch[1]) || '';
      return { src, caption: caption.trim(), raw: htmlImgMatch[0] };
    }

    return null;
  }

  /**
   * Detects if a line is a markdown table separator row: | --- | --- | or --- | ---
   */
  isTableSeparatorRow(line) {
    if (!line || !line.includes('-')) return false;
    const trimmed = line.trim();
    return /^[|\s\-:]+$/.test(trimmed) && trimmed.includes('|') && trimmed.includes('-');
  }

  /**
   * Splits a table row into clean cell contents, handling both bordered and borderless tables
   */
  parseTableRowCells(line) {
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);
    return trimmed.split('|').map(c => c.trim());
  }

  /**
   * Converts Markdown text into OneNote Canvas outline units
   */
  parseMarkdownToOutlineUnits(mdString) {
    if (!mdString) return [];
    const units = [];
    const lines = mdString.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // 1. Block Math: $$ ... $$, \[ ... \], or \begin{equation}
      if (trimmed.startsWith('$$') || trimmed.startsWith('\\[') || trimmed.startsWith('\\begin{equation}') || trimmed.startsWith('\\begin{align}')) {
        let mathContent = '';
        const isBracket = trimmed.startsWith('\\[');
        const endMarker = isBracket ? '\\]' : (trimmed.startsWith('$$') ? '$$' : '\\end{');

        if (isBracket && trimmed.endsWith('\\]') && trimmed.length > 4) {
          mathContent = trimmed.slice(2, -2).trim();
          i++;
        } else if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
          mathContent = trimmed.slice(2, -2).trim();
          i++;
        } else {
          mathContent = isBracket ? trimmed.slice(2).trim() : (trimmed.startsWith('$$') ? trimmed.slice(2).trim() : trimmed);
          i++;
          while (i < lines.length && !lines[i].trim().includes(endMarker)) {
            mathContent += '\n' + lines[i];
            i++;
          }
          if (i < lines.length) {
            mathContent += '\n' + lines[i].trim().replace(/\$\$|\\\]|\\end\{[^}]+\}/g, '');
            i++;
          }
        }
        if (mathContent.trim()) {
          units.push({ type: 'math', latex: mathContent.trim() });
          continue;
        }
      }

      // 2. Picture Detection (Linked, standard markdown, or HTML img tag)
      const imgInfo = this.extractImageFromText(trimmed);
      if (imgInfo) {
        units.push({
          type: 'image',
          caption: imgInfo.caption,
          src: imgInfo.src
        });
        // Check if there was other text on the line beside the image
        const remaining = trimmed.replace(imgInfo.raw, '').trim();
        if (remaining.length > 0) {
          units.push({
            type: 'text',
            content: this.formatInline(remaining)
          });
        }
        i++;
        continue;
      }

      // 3. Markdown Headings: # through ######
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const tag = `h${Math.min(6, level)}`;
        const headingContent = this.formatInline(headingMatch[2].trim());
        units.push({
          type: 'heading',
          tag,
          content: headingContent
        });
        i++;
        continue;
      }

      // 4. Flexible Table Detection: bordered (| A | B |) or borderless (A | B)
      if (trimmed.includes('|') && i + 1 < lines.length && this.isTableSeparatorRow(lines[i + 1])) {
        const tableLines = [trimmed, lines[i + 1].trim()];
        i += 2;
        // Collect all following table data rows
        while (i < lines.length && lines[i].trim().includes('|') && !this.isTableSeparatorRow(lines[i])) {
          tableLines.push(lines[i].trim());
          i++;
        }
        const domTable = this.convertMarkdownTableToDOM(tableLines);
        if (domTable) {
          units.push({ type: 'table', domElement: domTable });
          continue;
        }
      }

      // 5. Code Block: ```lang ... ```
      if (trimmed.startsWith('```')) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // skip ending ```
        const codeText = codeLines.join('\n');
        units.push({
          type: 'text',
          content: `<pre style="background:#f3f2f1;border-radius:6px;padding:8px 12px;font-family:monospace;font-size:13px;overflow-x:auto;"><code>${this.escapeHTML(codeText)}</code></pre>`
        });
        continue;
      }

      // 6. Bullet Lists: - item, * item, + item
      if (/^[-*+]\s+/.test(trimmed)) {
        const listItems = [];
        while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
          const itemText = lines[i].trim().replace(/^[-*+]\s+/, '');
          listItems.push(this.formatInline(itemText));
          i++;
        }
        const listHtml = `<ul>${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
        units.push({
          type: 'list',
          tag: 'ul',
          content: listHtml
        });
        continue;
      }

      // 7. Numbered Lists: 1. item, 2. item
      if (/^\d+\.\s+/.test(trimmed)) {
        const listItems = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
          listItems.push(this.formatInline(itemText));
          i++;
        }
        const listHtml = `<ol>${listItems.map(item => `<li>${item}</li>`).join('')}</ol>`;
        units.push({
          type: 'list',
          tag: 'ol',
          content: listHtml
        });
        continue;
      }

      // 8. Standard text paragraph
      units.push({
        type: 'text',
        content: this.formatInline(trimmed)
      });
      i++;
    }

    return units;
  }

  /**
   * Converts markdown table lines into an HTML table element ready for TableModule
   */
  convertMarkdownTableToDOM(lines) {
    if (!lines || lines.length < 2) return null;
    const table = document.createElement('table');
    table.className = 'canvas-table layout-classic';

    // Parse header row
    const headerCells = this.parseTableRowCells(lines[0]);

    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    headerCells.forEach(cellText => {
      const th = document.createElement('th');
      th.innerHTML = this.formatInline(cellText) || '&nbsp;';
      headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);
    table.appendChild(thead);

    // Parse data rows (index 1 is separator, data rows start at index 2)
    const tbody = document.createElement('tbody');
    for (let r = 2; r < lines.length; r++) {
      const cells = this.parseTableRowCells(lines[r]);
      const tr = document.createElement('tr');
      for (let c = 0; c < headerCells.length; c++) {
        const td = document.createElement('td');
        const text = cells[c] !== undefined ? cells[c] : '';
        td.innerHTML = this.formatInline(text) || '&nbsp;';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Export for modular browser loading
window.MarkdownModule = MarkdownModule;
