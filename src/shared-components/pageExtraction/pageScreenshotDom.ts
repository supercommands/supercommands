let screenshotStyleElement: HTMLStyleElement | null = null;
let screenshotOriginalScrollX = 0;
let screenshotOriginalScrollY = 0;
export async function copyImageDataUrlToClipboard(dataUrl: string) {
    window.focus();
    const res = await fetch(dataUrl);
    const arrayBuffer = await res.arrayBuffer();
    const pngBlob = new Blob([arrayBuffer], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
}
export function prepareFullPageScreenshot() {
    screenshotOriginalScrollX = window.scrollX;
    screenshotOriginalScrollY = window.scrollY;
    const docEl = document.documentElement;
    const body = document.body;
    const viewportWidth = Math.max(window.innerWidth || 0, docEl?.clientWidth || 0, body?.clientWidth || 0, 1);
    const viewportHeight = Math.max(window.innerHeight || 0, docEl?.clientHeight || 0, body?.clientHeight || 0, 1);
    const pageWidth = Math.max(docEl?.scrollWidth || 0, body?.scrollWidth || 0, docEl?.offsetWidth || 0, body?.offsetWidth || 0, viewportWidth);
    const pageHeight = Math.max(docEl?.scrollHeight || 0, body?.scrollHeight || 0, docEl?.offsetHeight || 0, body?.offsetHeight || 0, viewportHeight);
    const dpr = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    if (!screenshotStyleElement) {
        screenshotStyleElement = document.createElement('style');
        screenshotStyleElement.id = 'cmdos-screenshot-page-style';
        screenshotStyleElement.textContent = '::-webkit-scrollbar { display: none; } html { scrollbar-width: none; }';
        docEl.appendChild(screenshotStyleElement);
    }
    return {
        w: pageWidth,
        h: pageHeight,
        vw: viewportWidth,
        vh: viewportHeight,
        dpr,
    };
}
export function restoreFullPageScreenshot() {
    screenshotStyleElement?.remove();
    screenshotStyleElement = null;
    window.scrollTo(screenshotOriginalScrollX, screenshotOriginalScrollY);
}
