(function () {
  window.addEventListener('message', event => {
    // Ensure the message is from the same window (content script -> page context)
    if (event.source !== window) return;
    if (event.data?.type !== 'TASKLABS_INSERT_TEXT') return;

    const { text, html, deleteCount = 0 } = event.data;
    const target = document.activeElement || document.body;

    // 1. Remove trigger text using Backspace events
    const dispatchBackspace = () => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          code: 'Backspace',
          keyCode: 8,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
      target.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'Backspace',
          code: 'Backspace',
          keyCode: 8,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    };

    for (let i = 0; i < deleteCount; i++) {
      dispatchBackspace();
    }

    // 2. Insert text
    // Try execCommand first (works in many editors if they intercept it)
    // We wrap in a try-catch just in case
    try {
      if (html && document.execCommand('insertHTML', false, html)) {
        return;
      }
      if (document.execCommand('insertText', false, text)) {
        return;
      }
    } catch (e) {
      // Ignore
    }

    // Fallback: Dispatch InputEvents mimicking typing
    for (const char of text) {
      const evt = new InputEvent('input', {
        data: char,
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
        view: window,
      });
      target.dispatchEvent(evt);
    }
  });
})();
