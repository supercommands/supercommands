(function () {
  const bridgeToken = {};
  window.__TASKLABS_DOCS_INSERT_BRIDGE_TOKEN__ = bridgeToken;
  window.__TASKLABS_DOCS_INSERT_READY__ = true;
  console.info('[cmdOS Snippets][Docs Injected] Script ready');
  window.dispatchEvent(new CustomEvent('TASKLABS_DOCS_INSERT_READY'));

  const handleInsert = payload => {
    if (window.__TASKLABS_DOCS_INSERT_BRIDGE_TOKEN__ !== bridgeToken) return;
    if (!payload || payload.type !== 'TASKLABS_INSERT_TEXT') return;

    const { text, html, deleteCount = 0 } = payload;
    const target = document.activeElement || document.body;

    try {
      window.focus();
      if (target && typeof target.focus === 'function') {
        target.focus();
      }
    } catch (e) {
      console.warn('[cmdOS Snippets][Docs Injected] Failed to restore iframe focus', e);
    }

    console.info('[cmdOS Snippets][Docs Injected] Insert message received', {
      textLength: typeof text === 'string' ? text.length : 0,
      htmlLength: typeof html === 'string' ? html.length : 0,
      deleteCount,
      activeElement: target?.tagName,
      activeElementClass: target?.className,
    });

    const dispatchToEditor = createEvent => {
      try {
        target.dispatchEvent(createEvent());
      } catch (e) {
        console.warn('[cmdOS Snippets][Docs Injected] Event dispatch failed', e);
      }
    };

    // 1. Remove trigger text using Backspace events
    const dispatchBackspace = () => {
      dispatchToEditor(() =>
        new KeyboardEvent('keydown', {
          key: 'Backspace',
          code: 'Backspace',
          keyCode: 8,
          which: 8,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
      dispatchToEditor(() =>
        new KeyboardEvent('keyup', {
          key: 'Backspace',
          code: 'Backspace',
          keyCode: 8,
          which: 8,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
      dispatchToEditor(() =>
        new InputEvent('beforeinput', {
          data: null,
          inputType: 'deleteContentBackward',
          bubbles: true,
          cancelable: true,
        }),
      );
      dispatchToEditor(() =>
        new InputEvent('input', {
          data: null,
          inputType: 'deleteContentBackward',
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    const dispatchTextKey = char => {
      if (char === '\n') {
        dispatchToEditor(() =>
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        dispatchToEditor(() =>
          new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        return;
      }

      const charCode = char.length === 1 ? char.charCodeAt(0) : 0;
      const upper = char.toUpperCase();
      const code =
        /^[a-z]$/i.test(char)
          ? `Key${upper}`
          : /^[0-9]$/.test(char)
            ? `Digit${char}`
            : '';

      dispatchToEditor(() =>
        new KeyboardEvent('keydown', {
          key: char,
          code,
          keyCode: charCode,
          which: charCode,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
      dispatchToEditor(() =>
        new KeyboardEvent('keypress', {
          key: char,
          code,
          keyCode: charCode,
          which: charCode,
          charCode,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );

      try {
        if (typeof window.TextEvent === 'function') {
          dispatchToEditor(() => {
            const textInputEvent = document.createEvent('TextEvent');
            textInputEvent.initTextEvent('textInput', true, true, window, char, 0, 'en-US');
            return textInputEvent;
          });
        } else {
          dispatchToEditor(() =>
            new InputEvent('textInput', {
              data: char,
              inputType: 'insertText',
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      } catch (e) {
        dispatchToEditor(() => {
          const fallback = document.createEvent('Event');
          fallback.initEvent('textInput', true, true);
          fallback.data = char;
          return fallback;
        });
      }

      dispatchToEditor(() =>
        new KeyboardEvent('keyup', {
          key: char,
          code,
          keyCode: charCode,
          which: charCode,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    };

    for (let i = 0; i < deleteCount; i++) {
      dispatchBackspace();
    }

    // Google Docs can report execCommand success against the iframe BODY without updating
    // the visible document model, so use the Docs-specific hidden-iframe sequence directly.
    console.info('[cmdOS Snippets][Docs Injected] Using keypress/textInput character dispatch');
    for (const char of text) {
      dispatchTextKey(char);
    }
  };

  window.addEventListener('message', event => {
    if (event.data?.type !== 'TASKLABS_INSERT_TEXT') return;
    handleInsert(event.data);
  });

  window.addEventListener('TASKLABS_INSERT_TEXT', event => {
    handleInsert(event.detail);
  });
})();
