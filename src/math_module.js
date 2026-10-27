/**
 * OneNote Spatial Canvas — Advanced LaTeX & Math Formula Module
 * 
 * Responsibilities:
 * - 100% Offline, Zero-Dependency MathML + LaTeX rendering for all equations.
 * - Detects AI bracket math (\[ ... \], \( ... \)) and dollar math ($$ ... $$, $ ... $).
 * - Full Greek alphabet (lowercase & uppercase), calculus, physics symbols, and operators.
 * - True vertical fractions (\\frac, \\cfrac, and {a \\over b}), square roots, and powers.
 * - Preserves native Wikipedia MathML and vector equations without loss.
 * - Interactive math cards with ::: margin grip, live LaTeX editor, and floating toolbar.
 */

class MathModule {
  constructor(app) {
    this.app = app;
    this.initSymbols();
  }

  initSymbols() {
    this.symbols = {
      // Uppercase Greek
      '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
      '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
      '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
      // Lowercase Greek
      '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
      '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
      '\\theta': 'θ', '\\vartheta': 'θ', '\\iota': 'ι', '\\kappa': 'κ',
      '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
      '\\pi': 'π', '\\varpi': 'ϖ', '\\rho': 'ρ', '\\varrho': 'ϱ',
      '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
      '\\varphi': 'φ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
      // Calculus & Physics
      '\\partial': '∂', '\\nabla': '∇', '\\infty': '∞',
      '\\int': '∫', '\\iint': '∬', '\\iiint': '∭', '\\oint': '∮',
      '\\sum': '∑', '\\prod': '∏', '\\coprod': '∐',
      // Arithmetic & Relations
      '\\pm': '±', '\\mp': '∓', '\\times': '×', '\\cdot': '·', '\\div': '÷',
      '\\equiv': '≡', '\\approx': '≈', '\\sim': '∼', '\\propto': '∝',
      '\\neq': '≠', '\\ne': '≠', '\\leq': '≤', '\\le': '≤', '\\geq': '≥', '\\ge': '≥',
      '\\ll': '≪', '\\gg': '≫',
      // Sets & Logic
      '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\subseteq': '⊆',
      '\\supset': '⊃', '\\supseteq': '⊇', '\\cap': '∩', '\\cup': '∪',
      '\\forall': '∀', '\\exists': '∃', '\\neg': '¬', '\\lor': '∨', '\\land': '∧',
      // Arrows
      '\\to': '→', '\\rightarrow': '→', '\\leftarrow': '←',
      '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\iff': '⇔', '\\implies': '⇒'
    };
  }

  /**
   * Helper: Extracts content between matching { and }
   */
  extractBracedContent(str, startIndex) {
    if (!str || str[startIndex] !== '{') return null;
    let depth = 0;
    for (let i = startIndex; i < str.length; i++) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}') {
        depth--;
        if (depth === 0) {
          return {
            content: str.substring(startIndex + 1, i),
            endIndex: i
          };
        }
      }
    }
    return null;
  }

  /**
   * Translates LaTeX fraction commands (\frac{a}{b}, \cfrac{a}{b}, and {a \over b})
   */
  parseFractions(latex) {
    let out = latex;

    // 1. Wikipedia-style {a \over b} syntax with support for nested braces in numerator & denominator
    let searchOverIdx = 0;
    while (true) {
      const overIdx = out.indexOf('\\over', searchOverIdx);
      if (overIdx === -1) break;

      // Scan backwards to find matching unclosed '{'
      let depth = 0;
      let startIdx = -1;
      for (let i = overIdx - 1; i >= 0; i--) {
        if (out[i] === '}') {
          depth++;
        } else if (out[i] === '{') {
          if (depth === 0) {
            startIdx = i;
            break;
          } else {
            depth--;
          }
        }
      }

      // Scan forwards from after '\over' (length 5) to find matching unclosed '}'
      depth = 0;
      let endIdx = -1;
      for (let i = overIdx + 5; i < out.length; i++) {
        if (out[i] === '{') {
          depth++;
        } else if (out[i] === '}') {
          if (depth === 0) {
            endIdx = i;
            break;
          } else {
            depth--;
          }
        }
      }

      if (startIdx !== -1 && endIdx !== -1) {
        const num = out.substring(startIdx + 1, overIdx).trim();
        const den = out.substring(overIdx + 5, endIdx).trim();
        const parsedNum = this.parseFractions(num);
        const parsedDen = this.parseFractions(den);
        const mfrac = `<mfrac><mrow>${parsedNum}</mrow><mrow>${parsedDen}</mrow></mfrac>`;
        out = out.substring(0, startIdx) + mfrac + out.substring(endIdx + 1);
        searchOverIdx = startIdx + mfrac.length;
      } else {
        searchOverIdx = overIdx + 5;
      }
    }

    // 2. Standard \frac, \cfrac, \tfrac, and \dfrac with deep nesting support
    let searchIdx = 0;
    while (true) {
      const fracMatches = [
        { idx: out.indexOf('\\frac', searchIdx), len: 5 },
        { idx: out.indexOf('\\cfrac', searchIdx), len: 6 },
        { idx: out.indexOf('\\tfrac', searchIdx), len: 6 },
        { idx: out.indexOf('\\dfrac', searchIdx), len: 6 }
      ].filter(m => m.idx !== -1).sort((a, b) => a.idx - b.idx);

      if (fracMatches.length === 0) break;
      const targetIdx = fracMatches[0].idx;
      const cmdLen = fracMatches[0].len;

      let firstBrace = out.indexOf('{', targetIdx + cmdLen);
      if (firstBrace === -1) {
        searchIdx = targetIdx + cmdLen;
        continue;
      }

      const numRes = this.extractBracedContent(out, firstBrace);
      if (!numRes) {
        searchIdx = targetIdx + cmdLen;
        continue;
      }

      let secondBrace = out.indexOf('{', numRes.endIndex + 1);
      if (secondBrace === -1) {
        searchIdx = targetIdx + cmdLen;
        continue;
      }

      const denRes = this.extractBracedContent(out, secondBrace);
      if (!denRes) {
        searchIdx = targetIdx + cmdLen;
        continue;
      }

      const numMathML = this.parseFractions(numRes.content);
      const denMathML = this.parseFractions(denRes.content);
      const mfracHtml = `<mfrac><mrow>${numMathML}</mrow><mrow>${denMathML}</mrow></mfrac>`;

      out = out.substring(0, targetIdx) + mfracHtml + out.substring(denRes.endIndex + 1);
      searchIdx = targetIdx + mfracHtml.length;
    }

    return out;
  }

  /**
   * Convert LaTeX string into rich, standard MathML Core
   */
  latexToMathML(latex, isBlock = false) {
    if (!latex) return '';
    let clean = latex.trim();

    // 1. Strip delimiters if still present: \[, \], $$, \(, \)
    if (clean.startsWith('\\[') && clean.endsWith('\\]')) clean = clean.slice(2, -2).trim();
    if (clean.startsWith('$$') && clean.endsWith('$$')) clean = clean.slice(2, -2).trim();
    if (clean.startsWith('\\(') && clean.endsWith('\\)')) clean = clean.slice(2, -2).trim();
    if (clean.startsWith('$') && clean.endsWith('$')) clean = clean.slice(1, -1).trim();
    clean = clean.replace(/\\displaystyle\s*/g, '').replace(/\\textstyle\s*/g, '').trim();
    clean = clean.replace(/\\,/g, ' ');

    // 2. Text elements inside equations: \text{...}, \mathrm{...}, \mathbf{...}
    clean = clean.replace(/\\(?:text|mathrm|mathbf)\{([^{}]+)\}/g, '<mtext> $1 </mtext>');

    // 3. Parse Fractions (\frac, \cfrac, \over)
    let mathml = this.parseFractions(clean);

    // 4. Square Roots: \sqrt[n]{x} and \sqrt{x}
    mathml = mathml.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '<mroot><mrow>$2</mrow><mrow>$1</mrow></mroot>');
    mathml = mathml.replace(/\\sqrt\{([^{}]+)\}/g, '<msqrt><mrow>$1</mrow></msqrt>');

    // 5. Replace known LaTeX symbols & Greek alphabet
    Object.keys(this.symbols).forEach(sym => {
      mathml = mathml.split(sym).join(this.symbols[sym]);
    });

    // 6. Clean empty braces commonly produced by TeX editors ({}_{\alpha\beta})
    mathml = mathml.replace(/\{\}/g, '');

    // 7. Stacked Subscripts and Superscripts (e.g. \Gamma^\mu_{\alpha\beta} or X_{sub}^{sup})
    // Base followed by both super and sub
    mathml = mathml.replace(/([a-zA-Z0-9\u0370-\u03ff\u2200-\u22ff\)])\s*\^\{([^{}]+)\}\s*_\{([^{}]+)\}/g, '<msubsup><mi>$1</mi><mrow>$3</mrow><mrow>$2</mrow></msubsup>');
    mathml = mathml.replace(/([a-zA-Z0-9\u0370-\u03ff\u2200-\u22ff\)])\s*_\{([^{}]+)\}\s*\^\{([^{}]+)\}/g, '<msubsup><mi>$1</mi><mrow>$2</mrow><mrow>$3</mrow></msubsup>');
    mathml = mathml.replace(/([a-zA-Z0-9\u0370-\u03ff\u2200-\u22ff\)])\s*\^([a-zA-Z0-9\u0370-\u03ff])\s*_([a-zA-Z0-9\u0370-\u03ff])/g, '<msubsup><mi>$1</mi><mrow>$3</mrow><mrow>$2</mrow></msubsup>');
    mathml = mathml.replace(/([a-zA-Z0-9\u0370-\u03ff\u2200-\u22ff\)])\s*_([a-zA-Z0-9\u0370-\u03ff])\s*\^([a-zA-Z0-9\u0370-\u03ff])/g, '<msubsup><mi>$1</mi><mrow>$2</mrow><mrow>$3</mrow></msubsup>');

    // Single Superscripts (x^{y} or x^y)
    mathml = mathml.replace(/([a-zA-Z0-9\u0370-\u03ff\u2200-\u22ff\)])\s*\^\{([^{}]+)\}/g, '<msup><mi>$1</mi><mrow>$2</mrow></msup>');
    mathml = mathml.replace(/([a-zA-Z0-9\u0370-\u03ff\u2200-\u22ff\)])\s*\^([a-zA-Z0-9\u0370-\u03ff])/g, '<msup><mi>$1</mi><mn>$2</mn></msup>');

    // Single Subscripts (x_{y} or x_y)
    mathml = mathml.replace(/([a-zA-Z0-9\u0370-\u03ff\u2200-\u22ff\)])\s*_\{([^{}]+)\}/g, '<msub><mi>$1</mi><mrow>$2</mrow></msub>');
    mathml = mathml.replace(/([a-zA-Z0-9\u0370-\u03ff\u2200-\u22ff\)])\s*_([a-zA-Z0-9\u0370-\u03ff])/g, '<msub><mi>$1</mi><mn>$2</mn></msub>');

    // 8. Delimiters (\left( \right), etc.)
    mathml = mathml.replace(/\\left\(/g, '<mo>(</mo>').replace(/\\right\)/g, '<mo>)</mo>');
    mathml = mathml.replace(/\\left\[/g, '<mo>[</mo>').replace(/\\right\]/g, '<mo>]</mo>');
    mathml = mathml.replace(/\\left\\\{/g, '<mo>{</mo>').replace(/\\right\\\}/g, '<mo>}</mo>');
    mathml = mathml.replace(/\\left\|/g, '<mo>|</mo>').replace(/\\right\|/g, '<mo>|</mo>');
    mathml = mathml.replace(/\\\{/g, '{').replace(/\\\}/g, '}');

    // 9. Format Operators & Relations (safely, only outside HTML tags)
    mathml = mathml.replace(/([=+\-±×÷·≠≤≥|])/g, (match, op, offset, fullStr) => {
      if (typeof fullStr !== 'string') return match;
      const lastOpen = fullStr.lastIndexOf('<', offset);
      const lastClose = fullStr.lastIndexOf('>', offset);
      if (lastOpen > lastClose) return match; // inside HTML tag
      return `<mo>${match}</mo>`;
    });

    // Wrap in standard MathML container
    const displayAttr = isBlock ? 'display="block"' : 'display="inline"';
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" ${displayAttr} class="rendered-math-element">${mathml}</math>`;
  }

  /**
   * Universal Formula Renderer: Uses KaTeX (The Artist) when available for 100% textbook quality,
   * with seamless MathML Core fallback.
   */
  renderFormulaHTML(latex, isBlock = false, rawMathML = null) {
    if (rawMathML && rawMathML.includes('<math')) {
      return rawMathML;
    }
    if (typeof window !== 'undefined' && window.katex && latex) {
      try {
        let clean = latex.trim();
        if (clean.startsWith('\\[') && clean.endsWith('\\]')) clean = clean.slice(2, -2).trim();
        if (clean.startsWith('$$') && clean.endsWith('$$')) clean = clean.slice(2, -2).trim();
        if (clean.startsWith('\\(') && clean.endsWith('\\)')) clean = clean.slice(2, -2).trim();
        if (clean.startsWith('$') && clean.endsWith('$')) clean = clean.slice(1, -1).trim();
        return window.katex.renderToString(clean, {
          displayMode: isBlock,
          throwOnError: false,
          output: 'htmlAndMathml'
        });
      } catch (_) {}
    }
    return this.latexToMathML(latex, isBlock);
  }

  /**
   * Create an interactive Math Formula block with margin grip and editing tools
   */
  createMathBlock(latex = 'E = mc^2', rawMathML = null) {
    const block = document.createElement('div');
    block.className = 'canvas-block math-block';
    block.dataset.blockType = 'math';
    block.contentEditable = 'false';

    // Left hover grip for reordering or canvas detach
    const grip = document.createElement('div');
    grip.className = 'block-grip';
    grip.contentEditable = 'false';
    grip.textContent = ':::';
    grip.title = 'Drag to rearrange or drag out to detach equation';
    block.appendChild(grip);

    // Math Card container
    const card = document.createElement('div');
    card.className = 'math-card';
    card.contentEditable = 'false';

    // Formula Display Area
    const display = document.createElement('div');
    display.className = 'math-display';
    display.dataset.latex = latex;

    // Use Universal Formula Renderer (KaTeX + MathML fallback)
    display.innerHTML = this.renderFormulaHTML(latex, true, rawMathML);
    card.appendChild(display);

    // Live Editor Input (hidden by default)
    const editor = document.createElement('div');
    editor.className = 'math-editor';
    editor.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'math-latex-input';
    input.value = latex;
    input.placeholder = 'Type LaTeX formula (e.g. x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a})...';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'math-tool-btn primary';
    saveBtn.textContent = '✓ Done';

    editor.appendChild(input);
    editor.appendChild(saveBtn);
    card.appendChild(editor);

    // Floating Tool Buttons
    const tools = document.createElement('div');
    tools.className = 'math-tools-bar';
    tools.contentEditable = 'false';

    const editBtn = document.createElement('button');
    editBtn.className = 'math-tool-btn';
    editBtn.textContent = '✏ Edit';
    editBtn.title = 'Edit LaTeX Math Code';

    const delBtn = document.createElement('button');
    delBtn.className = 'math-tool-btn danger';
    delBtn.textContent = '× Delete';
    delBtn.title = 'Delete Equation';

    tools.appendChild(editBtn);
    tools.appendChild(delBtn);
    card.appendChild(tools);

    // Interactions: Toggle Edit mode
    const toggleEdit = (editing) => {
      if (editing) {
        display.style.display = 'none';
        editor.style.display = 'flex';
        input.value = display.dataset.latex || '';
        input.focus();
        input.select();
      } else {
        const newLatex = input.value.trim() || 'f(x) = y';
        display.dataset.latex = newLatex;
        display.innerHTML = this.renderFormulaHTML(newLatex, true);
        editor.style.display = 'none';
        display.style.display = 'flex';
        if (this.app.history) this.app.history.pushState('edit_math_formula');
      }
    };

    editBtn.onclick = (e) => {
      e.stopPropagation();
      toggleEdit(true);
    };

    display.ondblclick = (e) => {
      e.stopPropagation();
      toggleEdit(true);
    };

    saveBtn.onclick = (e) => {
      e.stopPropagation();
      toggleEdit(false);
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        toggleEdit(false);
      }
    };

    delBtn.onclick = (e) => {
      e.stopPropagation();
      block.remove();
      if (this.app.history) this.app.history.pushState('delete_math');
    };

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.app.selectObject(card, 'math');
    });

    block.appendChild(card);
    return block;
  }

  /**
   * Convert inline math \( ... \) or $ ... $ in an element to rendered math pills
   */
  renderInlineMath(element) {
    if (!element) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodesToReplace = [];

    // Match \( formula \) or $ formula $
    const mathPattern = /(\\\([^\)]+\\\)|\$[^$]+\$)/;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue && mathPattern.test(node.nodeValue)) {
        nodesToReplace.push(node);
      }
    }

    nodesToReplace.forEach(node => {
      const parent = node.parentNode;
      if (!parent || parent.closest('.math-block') || parent.classList?.contains('inline-math')) return;

      const parts = node.nodeValue.split(/(\\\([^\)]+\\\)|\$[^$]+\$)/g);
      const fragment = document.createDocumentFragment();

      parts.forEach(part => {
        let latex = null;

        // Check \( formula \)
        if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 4) {
          latex = part.slice(2, -2).trim();
        } else if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          // Check $ formula $ (ignore currency like $20)
          const candidate = part.slice(1, -1).trim();
          if (!/^\d+(?:\.\d+)?$/.test(candidate)) {
            latex = candidate;
          }
        }

        if (latex !== null && latex.length > 0) {
          const mathSpan = document.createElement('span');
          mathSpan.className = 'inline-math';
          mathSpan.contentEditable = 'false';
          mathSpan.title = `Formula: ${latex} (Double-click to edit)`;
          mathSpan.dataset.latex = latex;
          mathSpan.innerHTML = this.renderFormulaHTML(latex, false);

          mathSpan.ondblclick = (e) => {
            e.stopPropagation();
            const edited = prompt('Edit LaTeX math formula:', latex);
            if (edited !== null && edited.trim().length > 0) {
              mathSpan.dataset.latex = edited;
              mathSpan.innerHTML = this.renderFormulaHTML(edited, false);
              if (this.app.history) this.app.history.pushState('edit_inline_math');
            }
          };

          fragment.appendChild(mathSpan);
        } else if (part.length > 0) {
          fragment.appendChild(document.createTextNode(part));
        }
      });

      parent.replaceChild(fragment, node);
    });
  }
}

// Export for window
window.MathModule = MathModule;
