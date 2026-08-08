export class ImageDownloader {
  private validImages: HTMLImageElement[] = [];
  private selectedImages = new Set<number>();
  private addedImageSources = new Set<string>();
  private mainContainer: HTMLDivElement | null = null;
  private dialogBox: HTMLDivElement | null = null;
  private imageList: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private mutationObserver: MutationObserver | null = null;
  private refreshInterval: number | null = null;
  private isRefreshing = false;

  constructor() {
    // Listener for messages from background or AltS
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'execute_image_download') {
        this.start({ ...request.options, downloadType: request.downloadType });
        sendResponse({ ok: true });
      }
      return false;
    });
  }

  public async start(options: any = {}) {
    // Remove existing if any
    this.cleanup();

    const { limit, downloadType } = options;

    // Initial scrape
    await this.scrapeImages();

    if (downloadType === 'limit' && limit > 0) {
      this.validImages = this.validImages.slice(0, limit);
    }

    this.createUI(downloadType, limit);
    this.setupObservers();
  }

  private async scrapeImages() {
    const images = document.querySelectorAll('img');
    const pictureSources = document.querySelectorAll('picture source[srcset], picture source[src]');

    // Optimized background image search
    const elementsWithBgImages: HTMLImageElement[] = [];
    const potentialBgContainers = document.querySelectorAll(
      'div[style*="background-image"], section[style*="background-image"], span[style*="background-image"], a[style*="background-image"], header[style*="background-image"], footer[style*="background-image"], [class*="bg-"], [class*="background-image"]',
    );

    potentialBgContainers.forEach(el => {
      try {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
          const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('data:')) {
            const tempImg = document.createElement('img');
            tempImg.src = urlMatch[1];
            tempImg.style.display = 'none';
            elementsWithBgImages.push(tempImg);
          }
        }
      } catch (e) {}
    });

    const allSources: HTMLImageElement[] = [];

    // Process <img> tags
    images.forEach(img => {
      allSources.push(img as HTMLImageElement);
    });

    // Process <picture> sources
    pictureSources.forEach(source => {
      const srcset = source.getAttribute('srcset');
      const src = source.getAttribute('src');
      const url = srcset ? srcset.split(',')[0].trim().split(' ')[0] : src;
      if (url && !url.startsWith('data:')) {
        const tempImg = document.createElement('img');
        tempImg.src = url;
        tempImg.style.display = 'none';
        allSources.push(tempImg);
      }
    });

    // Add background images
    elementsWithBgImages.forEach(img => allSources.push(img));

    this.validImages = allSources.filter(img => this.isValidImage(img));

    // Track added sources to avoid duplicates during refreshes
    this.validImages.forEach(img => {
      const src = img.src || img.getAttribute('data-src') || '';
      if (src) this.addedImageSources.add(this.normalizeImageUrl(src));
    });
  }

  private isValidImage(img: HTMLImageElement): boolean {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.srcset;
    if (!src) return false;

    if (src.startsWith('data:')) {
      return this.isDataUrlLargeEnough(src);
    }

    const style = window.getComputedStyle(img);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    const width = img.naturalWidth || img.width || img.offsetWidth || 0;
    const height = img.naturalHeight || img.height || img.offsetHeight || 0;

    // Reasonable size check
    if (width > 0 && height > 0 && width < 10 && height < 10) return false;

    return true;
  }

  private isDataUrlLargeEnough(dataUrl: string): boolean {
    try {
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) return false;
      const sizeInKB = (base64Data.length * 3) / 4 / 1024;
      return sizeInKB >= 0.5;
    } catch {
      return true;
    }
  }

  private normalizeImageUrl(url: string): string {
    try {
      const urlObj = new URL(url, window.location.href);
      ['w', 'h', 'q', 's', 'usqp', 'fit', 'crop', 'ixid', 'ixlib'].forEach(p => urlObj.searchParams.delete(p));
      return urlObj.toString();
    } catch {
      return url.split('?')[0];
    }
  }

  private createUI(downloadType: string, limit?: number) {
    this.styleElement = document.createElement('style');
    this.styleElement.innerHTML = this.getStyles();
    document.head.appendChild(this.styleElement);

    this.mainContainer = document.createElement('div');
    this.mainContainer.id = 'tasklabs-image-main-container';
    this.mainContainer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.1); z-index: 2147483647;
      display: flex; align-items: center; justify-content: flex-end;
      font-family: system-ui, -apple-system, sans-serif;
      padding-right: 20px; box-sizing: border-box;
    `;

    this.dialogBox = document.createElement('div');
    this.dialogBox.id = 'tasklabs-image-dialog';
    this.dialogBox.style.cssText = `
      width: 400px; max-width: 90vw; height: 90vh; max-height: 90vh;
      background: rgb(235 235 235 / 75%); backdrop-filter: blur(30px) saturate(180%);
      -webkit-backdrop-filter: blur(30px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 16px;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: -10px 0 40px -10px rgba(0, 0, 0, 0.1);
      animation: tasklabs-slide-in 0.4s cubic-bezier(0.19, 1, 0.22, 1);
    `;

    // Header
    const header = document.createElement('div');
    header.className = 'tasklabs-header';
    const title = document.createElement('span');
    title.className = 'tasklabs-title';
    title.textContent = `Export Images (${this.validImages.length}${limit ? ` of ${limit}` : ''})`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tasklabs-close-button';
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = () => this.cleanup();

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.dialogBox.appendChild(header);

    // Subheader
    const subheader = document.createElement('div');
    subheader.className = 'tasklabs-subheader';

    const selectAllContainer = document.createElement('div');
    selectAllContainer.className = 'tasklabs-select-all-container';
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.className = 'tasklabs-image-checkbox';
    selectAllCheckbox.onchange = () => this.toggleAll(selectAllCheckbox.checked);

    const selectAllLabel = document.createElement('span');
    selectAllLabel.textContent = 'Select All';
    selectAllContainer.appendChild(selectAllCheckbox);
    selectAllContainer.appendChild(selectAllLabel);

    const clearAll = document.createElement('span');
    clearAll.className = 'tasklabs-clear-all';
    clearAll.textContent = 'Clear All';
    clearAll.onclick = () => this.toggleAll(false);

    subheader.appendChild(selectAllContainer);
    subheader.appendChild(clearAll);
    this.dialogBox.appendChild(subheader);

    // List
    this.imageList = document.createElement('div');
    this.imageList.id = 'tasklabs-image-list';
    this.dialogBox.appendChild(this.imageList);

    if (this.validImages.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No images found on this page';
      empty.style.cssText = 'text-align: center; padding: 40px 20px; color: #6b7280;';
      this.imageList.appendChild(empty);
    } else {
      this.validImages.forEach((img, idx) => this.addImageUI(img, idx));
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'tasklabs-download-options';

    const jpgBtn = document.createElement('button');
    jpgBtn.className = 'tasklabs-download-button disabled';
    jpgBtn.id = 'tasklabs-jpg-download';
    jpgBtn.textContent = '📥 JPG';
    jpgBtn.onclick = () => this.download('jpg');

    const pngBtn = document.createElement('button');
    pngBtn.className = 'tasklabs-download-button disabled';
    pngBtn.id = 'tasklabs-png-download';
    pngBtn.textContent = '📥 PNG';
    pngBtn.onclick = () => this.download('png');

    footer.appendChild(jpgBtn);
    footer.appendChild(pngBtn);
    this.dialogBox.appendChild(footer);

    this.mainContainer.appendChild(this.dialogBox);
    document.body.appendChild(this.mainContainer);

    this.mainContainer.onclick = e => {
      if (e.target === this.mainContainer) this.cleanup();
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cleanup();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  private addImageUI(img: HTMLImageElement, index: number) {
    if (!this.imageList) return;

    const item = document.createElement('div');
    item.className = 'tasklabs-image-item';
    item.id = `tasklabs-image-item-${index}`;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'tasklabs-image-checkbox';
    cb.id = `tasklabs-checkbox-${index}`;
    cb.onchange = () => this.toggleImage(index, cb.checked);

    const preview = document.createElement('img');
    preview.className = 'tasklabs-image-preview';
    preview.src = img.src || img.getAttribute('data-src') || '';
    preview.onerror = () => {
      const fallback = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (fallback) preview.src = fallback;
    };

    const info = document.createElement('div');
    info.className = 'tasklabs-image-info';
    const label = document.createElement('div');
    label.className = 'tasklabs-image-label';
    label.textContent = `Image ${index + 1}`;
    const dims = document.createElement('div');
    dims.className = 'tasklabs-image-dimensions';
    dims.textContent = img.naturalWidth ? `${img.naturalWidth} × ${img.naturalHeight}px` : 'Loading...';
    img.onload = () => {
      dims.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
    };

    info.appendChild(label);
    info.appendChild(dims);
    item.appendChild(cb);
    item.appendChild(preview);
    item.appendChild(info);

    item.onclick = e => {
      if (e.target !== cb) cb.click();
    };

    this.imageList.appendChild(item);
  }

  private toggleImage(index: number, selected: boolean) {
    const item = document.getElementById(`tasklabs-image-item-${index}`);
    const img = this.validImages[index];
    if (selected) {
      this.selectedImages.add(index);
      item?.classList.add('selected');
      if (img) {
        img.scrollIntoView({ behavior: 'smooth', block: 'center' });
        img.style.border = '3px solid #dc2626';
        img.style.borderRadius = '4px';
      }
    } else {
      this.selectedImages.delete(index);
      item?.classList.remove('selected');
      if (img) {
        img.style.border = '';
        img.style.borderRadius = '';
      }
    }
    this.updateDownloadButtons();
  }

  private toggleAll(selected: boolean) {
    this.validImages.forEach((_, idx) => {
      const cb = document.getElementById(`tasklabs-checkbox-${idx}`) as HTMLInputElement;
      if (cb && cb.checked !== selected) {
        cb.checked = selected;
        this.toggleImage(idx, selected);
      }
    });
  }

  private updateDownloadButtons() {
    const disabled = this.selectedImages.size === 0;
    ['tasklabs-jpg-download', 'tasklabs-png-download'].forEach(id => {
      const btn = document.getElementById(id) as HTMLButtonElement;
      if (btn) {
        btn.disabled = disabled;
        btn.classList.toggle('disabled', disabled);
      }
    });
  }

  private async download(format: string) {
    if (this.selectedImages.size === 0) return;

    const hostname = window.location.hostname.replace(/[^a-zA-Z0-9]/g, '_');
    const folder = `cmdOS_Exports/${hostname}_`;
    const indices = Array.from(this.selectedImages).sort((a, b) => a - b);

    const CHUNK_SIZE = 5;
    let count = 1;
    for (let i = 0; i < indices.length; i += CHUNK_SIZE) {
      const chunk = indices.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async idx => {
          const img = this.validImages[idx];
          let url = img.src || img.getAttribute('data-src') || '';
          if (!url) return;

          // Ensure absolute URL
          if (url.startsWith('//')) url = window.location.protocol + url;
          else if (url.startsWith('/')) url = window.location.origin + url;
          else if (!url.startsWith('http') && !url.startsWith('data:')) {
            url = new URL(url, window.location.href).href;
          }

          const ext = format === 'jpg' ? 'jpg' : format === 'png' ? 'png' : this.getExt(url);
          const filename = `${folder}/image_${count++}.${ext}`;

          chrome.runtime.sendMessage({
            action: 'TASKLABS_DOWNLOAD_IMAGE',
            url,
            filename,
          });
        }),
      );
      await new Promise(r => setTimeout(r, 100));
    }

    setTimeout(() => this.cleanup(), 1000);
  }

  private getExt(url: string): string {
    if (url.startsWith('data:image/')) return url.match(/data:image\/([a-zA-Z]+);/)?.[1] || 'png';
    return url.match(/\.([a-zA-Z0-9]+)(\?|$)/)?.[1] || 'jpg';
  }

  private setupObservers() {
    this.mutationObserver = new MutationObserver(mutations => {
      let found = false;
      mutations.forEach(m => {
        if (this.mainContainer?.contains(m.target)) return;
        m.addedNodes.forEach(n => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            const el = n as Element;
            if (el.tagName === 'IMG' || el.querySelector('img')) found = true;
          }
        });
      });
      if (found) this.debouncedRefresh();
    });

    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    this.refreshInterval = window.setInterval(() => this.debouncedRefresh(), 10000);
  }

  private refreshTimer: any = null;
  private debouncedRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), 2000);
  }

  private async refresh() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const newImages = document.querySelectorAll('img');
    const addedImages: HTMLImageElement[] = [];

    newImages.forEach(img => {
      const src = img.src || img.getAttribute('data-src') || '';
      if (!src) return;
      const norm = this.normalizeImageUrl(src);
      if (!this.addedImageSources.has(norm) && this.isValidImage(img as HTMLImageElement)) {
        this.addedImageSources.add(norm);
        addedImages.push(img as HTMLImageElement);
      }
    });

    if (addedImages.length > 0) {
      addedImages.forEach(img => {
        const idx = this.validImages.length;
        this.validImages.push(img);
        this.addImageUI(img, idx);
      });
      const title = document.querySelector('.tasklabs-title');
      if (title) title.textContent = `Export Images (${this.validImages.length})`;
    }

    this.isRefreshing = false;
  }

  private cleanup() {
    if (this.mutationObserver) this.mutationObserver.disconnect();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.mainContainer && document.body.contains(this.mainContainer)) {
      document.body.removeChild(this.mainContainer);
    }
    if (this.styleElement && document.head.contains(this.styleElement)) {
      document.head.removeChild(this.styleElement);
    }
    this.validImages.forEach(img => {
      img.style.border = '';
      img.style.borderRadius = '';
    });
    this.validImages = [];
    this.selectedImages.clear();
    this.addedImageSources.clear();
  }

  private getStyles() {
    return `
      @keyframes tasklabs-slide-in {
        from { opacity: 0; transform: translateX(40px) scale(0.98); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      .tasklabs-header {
        padding: 20px 24px; border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        display: flex; justify-content: space-between; align-items: center;
        background: rgba(255, 255, 255, 0.3);
      }
      .tasklabs-title { font-size: 18px; font-weight: 600; color: #111827; }
      .tasklabs-close-button {
        background: rgba(0, 0, 0, 0.05); color: #4b5563; border: none;
        border-radius: 8px; width: 32px; height: 32px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
      .tasklabs-subheader {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 24px; background: rgba(255, 255, 255, 0.2);
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }
      .tasklabs-select-all-container { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; }
      .tasklabs-clear-all { font-size: 13px; color: #ef4444; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
      #tasklabs-image-list { flex: 1; overflow-y: auto; padding: 16px 24px; }
      .tasklabs-image-item {
        display: flex; align-items: center; padding: 12px; border-radius: 12px;
        margin-bottom: 8px; background: rgba(255, 255, 255, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.6); cursor: pointer; transition: all 0.2s;
      }
      .tasklabs-image-item:hover { background: rgba(255, 255, 255, 0.7); }
      .tasklabs-image-item.selected { background: rgba(139, 92, 246, 0.1); border-color: rgba(139, 92, 246, 0.3); }
      .tasklabs-image-checkbox { width: 18px; height: 18px; accent-color: #8b5cf6; margin-right: 16px; }
      .tasklabs-image-preview { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; margin-right: 16px; background: rgba(0,0,0,0.1); }
      .tasklabs-image-info { display: flex; flex-direction: column; flex-grow: 1; }
      .tasklabs-image-label { font-weight: 500; color: #111827; font-size: 14px; }
      .tasklabs-image-dimensions { font-size: 12px; color: #6b7280; }
      .tasklabs-download-options { display: flex; gap: 12px; padding: 20px 24px; background: rgba(255, 255, 255, 0.3); border-top: 1px solid rgba(0, 0, 0, 0.05); }
      .tasklabs-download-button {
        display: flex; align-items: center; justify-content: center; flex: 1;
        padding: 12px 20px; border: 1px solid rgba(0, 0, 0, 0.05); border-radius: 10px;
        font-size: 14px; font-weight: 600; color: #111827; background: rgba(255, 255, 255, 0.6);
        cursor: pointer; transition: all 0.2s;
      }
      .tasklabs-download-button:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-1px); }
      .tasklabs-download-button.disabled { opacity: 0.5; pointer-events: none; }
      #tasklabs-image-list::-webkit-scrollbar { width: 8px; }
      #tasklabs-image-list::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 4px; }
    `;
  }
}
