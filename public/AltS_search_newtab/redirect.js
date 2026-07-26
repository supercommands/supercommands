const search = window.location.search || '';
const hash = window.location.hash || '';
window.location.replace(chrome.runtime.getURL('newtab.html') + search + hash);
