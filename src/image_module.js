/**
 * OneNote Spatial Canvas — Image & In-Place Crop Module
 * 
 * Responsibilities:
 * - Insert image from file picker, URL, or sample assets.
 * - Interactive 8-handle image resizing.
 * - Locked caption: caption is glued to image so moving/detaching keeps them together.
 * - Built-in crop tool: interactive crop dialog, box drag & resize, slice via Canvas.
 */

class ImageModule {
  constructor(app) {
    this.app = app;
    this.activeCropTarget = null;
    this.originalImageData = null;
    this.initCropModal();
  }

  /**
   * Create an image block element with locked caption and tools
   */
  createImageBlock(imageSrc, captionText = 'Click to add caption...') {
    const block = document.createElement('div');
    block.className = 'canvas-block image-block';
    block.dataset.blockType = 'image';
    block.contentEditable = 'false';

    // Hover Grip
    const grip = document.createElement('div');
    grip.className = 'block-grip';
    grip.contentEditable = 'false';
    grip.textContent = ':::';
    grip.title = 'Drag to rearrange or drag out to detach';
    block.appendChild(grip);

    // Image Card
    const card = document.createElement('div');
    card.className = 'image-card';
    card.contentEditable = 'false';

    // Container with tools
    const container = document.createElement('div');
    container.className = 'image-container';
    container.contentEditable = 'false';

    const img = document.createElement('img');
    img.src = imageSrc;
    img.dataset.originalSrc = imageSrc;
    img.style.width = '320px'; // default start width
    img.draggable = false;
    img.addEventListener('dragstart', (e) => e.preventDefault());

    // Clicking image selects card and activates universal handles & tools
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      this.app.selectObject(card, 'image');
    });

    // Dragging by grabbing the image itself moves the ENTIRE block (image + caption + tools)
    img.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.app.selectObject(card, 'image');

      const parentBoxEl = block.closest('.note-box');
      const parentBox = parentBoxEl ? this.app.findNoteBox(parentBoxEl.dataset.boxId) : null;
      if (parentBox) {
        this.app.flowEngine.pendingDrag = {
          blockEl: block,
          noteBox: parentBox,
          startX: e.clientX,
          startY: e.clientY
        };
      }
    });

    // Floating Tools Bar (Crop, Delete)
    const tools = document.createElement('div');
    tools.className = 'image-tools-bar';
    tools.contentEditable = 'false';

    const cropBtn = document.createElement('button');
    cropBtn.className = 'image-tool-btn';
    cropBtn.contentEditable = 'false';
    cropBtn.textContent = '✂ Crop';
    cropBtn.onclick = (e) => {
      e.stopPropagation();
      this.openCropModal(img);
    };

    const captionBtn = document.createElement('button');
    captionBtn.className = 'image-tool-btn caption-toggle-btn';
    captionBtn.contentEditable = 'false';
    captionBtn.textContent = captionText ? '💬 Caption' : '💬 + Caption';
    captionBtn.title = 'Add or Remove Caption';
    captionBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleCaption(card, captionBtn);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'image-tool-btn';
    delBtn.contentEditable = 'false';
    delBtn.textContent = '× Delete';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      block.remove();
    };

    tools.appendChild(cropBtn);
    tools.appendChild(captionBtn);
    tools.appendChild(delBtn);

    container.appendChild(img);
    container.appendChild(tools);
    card.appendChild(container);

    // Universal 8-Point Perimeter Resize Handles
    this.app.attachUniversalBoundaryHandles(
      card,
      (pos, dx, dy, startW) => {
        let newW = startW;
        if (pos.includes('e')) newW = Math.max(80, startW + dx);
        if (pos.includes('w')) newW = Math.max(80, startW - dx);
        if (pos === 'se' || pos === 'sw' || pos === 'ne' || pos === 'nw') {
          const scale = Math.max(0.2, (startW + dx) / startW);
          newW = Math.max(80, startW * scale);
        }
        img.style.width = `${Math.round(newW)}px`;
      },
      () => {
        if (this.app.history) this.app.history.pushState('resize_image');
      }
    );

    // Optional caption locked to image if provided
    if (captionText) {
      const captionWrapper = this.createCaptionWrapper(card, captionBtn, captionText);
      card.appendChild(captionWrapper);
    }

    block.appendChild(card);
    return block;
  }

  /**
   * Toggle caption on/off for an image card
   */
  toggleCaption(card, captionBtn, defaultText = 'Click to add caption...') {
    const existing = card.querySelector('.image-caption-wrapper');
    if (existing) {
      existing.remove();
      if (captionBtn) captionBtn.textContent = '💬 + Caption';
      if (this.app.history) this.app.history.pushState('remove_caption');
    } else {
      const wrapper = this.createCaptionWrapper(card, captionBtn, defaultText);
      card.appendChild(wrapper);
      const textEl = wrapper.querySelector('.image-caption');
      textEl.focus();
      const range = document.createRange();
      range.selectNodeContents(textEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      if (captionBtn) captionBtn.textContent = '💬 Caption';
      if (this.app.history) this.app.history.pushState('add_caption');
    }
  }

  /**
   * Create interactive caption wrapper with auto-remove & delete button
   */
  createCaptionWrapper(card, captionBtn, text = 'Click to add caption...') {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-caption-wrapper';
    wrapper.contentEditable = 'false';

    const caption = document.createElement('div');
    caption.className = 'image-caption';
    caption.contentEditable = 'true';
    caption.textContent = text;

    caption.addEventListener('input', () => {
      if (this.app.history) this.app.history.debouncePush('edit_caption');
    });

    // Auto-remove if backspace on empty caption
    caption.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && caption.innerText.trim().length === 0) {
        e.preventDefault();
        wrapper.remove();
        if (captionBtn) captionBtn.textContent = '💬 + Caption';
        if (this.app.history) this.app.history.pushState('remove_caption');
      }
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'caption-remove-btn';
    removeBtn.contentEditable = 'false';
    removeBtn.title = 'Remove Caption';
    removeBtn.textContent = '×';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      wrapper.remove();
      if (captionBtn) captionBtn.textContent = '💬 + Caption';
      if (this.app.history) this.app.history.pushState('remove_caption');
    };

    wrapper.appendChild(caption);
    wrapper.appendChild(removeBtn);
    return wrapper;
  }

  /**
   * Set up built-in Crop Modal Dialog and drag mechanics
   */
  initCropModal() {
    this.cropModal = document.getElementById('crop-modal');
    this.cropImg = document.getElementById('crop-target-img');
    this.cropBox = document.getElementById('crop-box');

    const btnCancel = document.getElementById('btn-crop-cancel');
    const btnReset = document.getElementById('btn-crop-reset');
    const btnApply = document.getElementById('btn-crop-apply');

    if (btnCancel) btnCancel.onclick = () => this.closeCropModal();
    if (btnReset) btnReset.onclick = () => this.resetCrop();
    if (btnApply) btnApply.onclick = () => this.applyCrop();

    this.bindCropBoxDrag();
  }

  openCropModal(targetImg) {
    this.activeCropTarget = targetImg;
    this.originalImageData = targetImg.dataset.originalSrc || targetImg.src;

    this.cropImg.src = targetImg.src;
    this.cropModal.style.display = 'flex';

    // Position crop box inside image bounds
    this.cropBox.style.top = '10%';
    this.cropBox.style.left = '10%';
    this.cropBox.style.width = '80%';
    this.cropBox.style.height = '80%';
  }

  closeCropModal() {
    this.cropModal.style.display = 'none';
    this.activeCropTarget = null;
  }

  resetCrop() {
    if (this.activeCropTarget && this.originalImageData) {
      this.activeCropTarget.src = this.originalImageData;
      this.cropImg.src = this.originalImageData;
      this.cropBox.style.top = '10%';
      this.cropBox.style.left = '10%';
      this.cropBox.style.width = '80%';
      this.cropBox.style.height = '80%';
    }
  }

  /**
   * Apply Crop: uses HTML5 Canvas to crop the source image precisely
   */
  applyCrop() {
    if (!this.activeCropTarget) return;

    const img = this.cropImg;
    const box = this.cropBox;

    const imgRect = img.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();

    const naturalW = img.naturalWidth || imgRect.width || 400;
    const naturalH = img.naturalHeight || imgRect.height || 240;
    const scaleX = imgRect.width ? naturalW / imgRect.width : 1;
    const scaleY = imgRect.height ? naturalH / imgRect.height : 1;

    const cropX = Math.max(0, (boxRect.left - imgRect.left) * scaleX);
    const cropY = Math.max(0, (boxRect.top - imgRect.top) * scaleY);
    const cropW = Math.max(20, Math.min(naturalW - cropX, (boxRect.width || 200) * scaleX));
    const cropH = Math.max(20, Math.min(naturalH - cropY, (boxRect.height || 150) * scaleY));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropW);
    canvas.height = Math.round(cropH);
    const ctx = canvas.getContext('2d');

    try {
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      const croppedUrl = canvas.toDataURL('image/png');
      this.activeCropTarget.src = croppedUrl;
    } catch (err) {
      console.warn('Direct canvas draw warning:', err);
    }

    this.closeCropModal();
    if (this.app.history) {
      this.app.history.pushState('crop_image');
    }
  }

  /**
   * Interactive crop box repositioning and 8-handle resizing
   */
  bindCropBoxDrag() {
    let isMoving = false;
    let isResizing = false;
    let activeHandle = null;
    let startX = 0;
    let startY = 0;
    let startRect = null;

    // Moving the whole crop box
    this.cropBox.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('crop-handle')) return;
      isMoving = true;
      startX = e.clientX;
      startY = e.clientY;
      startRect = {
        top: this.cropBox.offsetTop,
        left: this.cropBox.offsetLeft,
        width: this.cropBox.offsetWidth,
        height: this.cropBox.offsetHeight
      };
      e.preventDefault();
    });

    // Resizing via crop handles
    const handles = this.cropBox.querySelectorAll('.crop-handle');
    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        activeHandle = handle.dataset.handle;
        startX = e.clientX;
        startY = e.clientY;
        startRect = {
          top: this.cropBox.offsetTop,
          left: this.cropBox.offsetLeft,
          width: this.cropBox.offsetWidth,
          height: this.cropBox.offsetHeight
        };
      });
    });

    window.addEventListener('mousemove', (e) => {
      const container = document.getElementById('crop-stage-container');
      if (!container) return;
      const maxW = container.offsetWidth;
      const maxH = container.offsetHeight;

      if (isMoving && startRect) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = Math.max(0, Math.min(maxW - startRect.width, startRect.left + dx));
        let newTop = Math.max(0, Math.min(maxH - startRect.height, startRect.top + dy));
        this.cropBox.style.left = `${newLeft}px`;
        this.cropBox.style.top = `${newTop}px`;
      }

      if (isResizing && startRect && activeHandle) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let { top, left, width, height } = startRect;

        if (activeHandle.includes('e')) width = Math.max(40, width + dx);
        if (activeHandle.includes('s')) height = Math.max(40, height + dy);
        if (activeHandle.includes('w')) {
          const proposedW = width - dx;
          if (proposedW > 40) {
            left += dx;
            width = proposedW;
          }
        }
        if (activeHandle.includes('n')) {
          const proposedH = height - dy;
          if (proposedH > 40) {
            top += dy;
            height = proposedH;
          }
        }

        this.cropBox.style.left = `${left}px`;
        this.cropBox.style.top = `${top}px`;
        this.cropBox.style.width = `${width}px`;
        this.cropBox.style.height = `${height}px`;
      }
    });

    window.addEventListener('mouseup', () => {
      isMoving = false;
      isResizing = false;
      activeHandle = null;
    });
  }
}

// Export for modular usage
window.ImageModule = ImageModule;
