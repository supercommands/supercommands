import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Type, ChevronDown, Check } from 'lucide-react';

export function setupNoteFooterMenus(quill: any, toolbar: HTMLElement) {
    const more = toolbar.querySelector<HTMLElement>('.note-more-panel');
    const trigger = toolbar.querySelector<HTMLButtonElement>('.note-more-button');
    if (!more || !trigger) return () => {};
    // Apply after the selection menu has been cloned so its overflow remains complete.
    more.classList.add('note-footer-menu');
    const styleTrigger = document.createElement('button');
    styleTrigger.type = 'button';
    styleTrigger.className = 'note-footer-style-trigger';
    styleTrigger.title = 'Paragraph style';
    styleTrigger.setAttribute('aria-label', 'Paragraph style');
    styleTrigger.innerHTML = [Type, ChevronDown].map(icon => renderToStaticMarkup(createElement(icon, { 'aria-hidden': true }))).join('');
    trigger.parentElement!.insertBefore(styleTrigger, trigger);
    const styles = document.createElement('span');
    styles.className = 'note-more-panel note-footer-style-panel custom-scrollbar-thin';
    styles.setAttribute('role', 'menu');
    styles.setAttribute('aria-label', 'Paragraph styles');
    styles.hidden = true;
    more.querySelectorAll<HTMLButtonElement>('.note-heading-option').forEach(original => {
        const button = original.cloneNode(true) as HTMLButtonElement;
        button.classList.add('note-footer-style-option');
        const check = document.createElement('span');
        check.className = 'note-style-check';
        check.innerHTML = renderToStaticMarkup(createElement(Check, { 'aria-hidden': true }));
        button.appendChild(check);
        button.onclick = () => { original.click(); close(); quill.focus(); };
        styles.appendChild(button);
    });
    toolbar.appendChild(styles);
    const menus: Array<[HTMLElement, HTMLButtonElement]> = [[more, trigger], [styles, styleTrigger]];
    menus.forEach(([panel, button]) => {
        panel.setAttribute('popover', 'manual');
        panel.classList.add('note-footer-popover');
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
    });
    const close = () => menus.forEach(([panel, button]) => {
        if (panel.matches(':popover-open')) panel.hidePopover();
        panel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
    });
    const position = () => menus.forEach(([panel, button]) => {
        if (panel.hidden) return;
        const anchor = button.getBoundingClientRect();
        const bounds = panel.getBoundingClientRect();
        const below = window.innerHeight - anchor.bottom;
        const above = anchor.top;
        const down = below >= bounds.height || below >= above;
        panel.style.maxHeight = `${Math.max(0, down ? below : above)}px`;
        panel.style.left = `${Math.max(0, Math.min(anchor.left, window.innerWidth - bounds.width))}px`;
        panel.style.top = `${down ? anchor.bottom : Math.max(0, anchor.top - Math.min(bounds.height, above))}px`;
    });
    const toggle = (event: Event) => {
        const button = event.currentTarget as HTMLButtonElement;
        const panel = menus.find(([, b]) => b === button)![0];
        const opening = panel.hidden;
        close();
        if (!opening || !quill.isEnabled()) return;
        const header = quill.getFormat().header || false;
        styles.querySelectorAll<HTMLButtonElement>('button').forEach(option => {
            const action = option.dataset.noteAction;
            const active = action === 'normal' ? header === false : header === Number(action?.split('-')[1]);
            option.classList.toggle('ql-active', active);
            option.setAttribute('aria-checked', String(active));
            option.setAttribute('role', 'menuitemradio');
        });
        panel.hidden = false;
        panel.style.maxHeight = '';
        panel.showPopover();
        button.setAttribute('aria-expanded', 'true');
        position();
    };
    const preserve = (event: MouseEvent) => event.preventDefault();
    const outside = (event: Event) => {
        if (!menus.some(([panel, button]) => event.composedPath().includes(panel) || event.composedPath().includes(button))) close();
    };
    const choice = (event: Event) => { if ((event.target as HTMLElement).closest('button')) close(); };
    const keydown = (event: KeyboardEvent) => {
        const entry = menus.find(([panel]) => !panel.hidden);
        if (!entry) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); quill.focus(); }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const buttons = Array.from(entry[0].querySelectorAll<HTMLButtonElement>('button')).filter(b => b.getClientRects().length && !b.disabled);
        const active = (toolbar.getRootNode() as Document | ShadowRoot).activeElement;
        const index = buttons.indexOf(active as HTMLButtonElement);
        const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
    };
    menus.forEach(([panel, button]) => {
        button.addEventListener('mousedown', preserve); button.addEventListener('click', toggle);
        panel.addEventListener('mousedown', preserve); panel.addEventListener('click', choice);
    });
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
        close();
        menus.forEach(([panel, button]) => {
            button.removeEventListener('mousedown', preserve); button.removeEventListener('click', toggle);
            panel.removeEventListener('mousedown', preserve); panel.removeEventListener('click', choice);
        });
        document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', keydown, true);
        document.removeEventListener('scroll', position, true); window.removeEventListener('resize', position);
        more.removeAttribute('popover'); more.classList.remove('note-footer-menu', 'note-footer-popover');
        styles.remove(); styleTrigger.remove();
    };
}
