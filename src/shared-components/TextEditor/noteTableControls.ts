import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Plus, Ellipsis, Columns3, Rows3 } from 'lucide-react';

export function insertNoteTable(quill: any) {
    if (!quill.isEnabled()) return;
    const module = quill.getModule('table');
    const range = quill.getSelection(true);
    if (!range || module.getTable(range)[0]) return;
    let index = range.index;
    if (range.length) {
        const end = Math.min(range.index + range.length, quill.getLength() - 1);
        const [line, offset] = quill.getLine(end);
        const afterLine = end - offset + (line?.length() || 1);
        const atEnd = afterLine >= quill.getLength();
        index = Math.min(afterLine, quill.getLength() - 1);
        quill.insertText(index, '\n', 'user');
        if (atEnd) index += 1;
    } else {
        const [, offset] = quill.getLine(index);
        if (offset) {
            quill.insertText(index, '\n', 'user');
            index += 1;
        }
        quill.insertText(index, '\n', 'user');
    }
    quill.setSelection(index, 0, 'silent');
    module.insertTable(2, 2);
    quill.setSelection(index, 0, 'user');
}

export function setupNoteTableControls(quill: any, container: HTMLElement, Quill: any) {
    const module = quill.getModule('table');
    const host = container.closest<HTMLElement>('[data-note-editor-surface]') || container;
    const controls: HTMLDivElement[] = [];
    let cell: HTMLTableCellElement | null = null;
    let frame = 0;
    let pointerMode = false;
    let hoveredControl = -1;
    const makeControl = (label: string, icon: typeof Plus, action: () => void) => {
        const root = document.createElement('div');
        root.className = 'note-table-control';
        root.setAttribute('popover', 'manual');
        const button = document.createElement('button');
        button.type = 'button';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = renderToStaticMarkup(createElement(icon, { 'aria-hidden': true }));
        button.onclick = action;
        root.addEventListener('mousedown', event => event.preventDefault());
        root.appendChild(button);
        host.appendChild(root);
        controls.push(root);
        return root;
    };
    const selectCell = (target: HTMLTableCellElement | null) => {
        if (!target?.isConnected || !quill.isEnabled()) return false;
        const blot = Quill.find(target);
        if (!blot) return false;
        quill.setSelection(quill.getIndex(blot), 0, 'silent');
        return true;
    };
    const run = (method: string, target = cell) => {
        if (!selectCell(target)) return;
        module[method]();
        quill.focus();
        schedule();
    };
    const rowPlus = makeControl('Add row', Plus, () => {
        const table = cell?.closest('table');
        run('insertRowBelow', table?.rows[table.rows.length - 1]?.cells[0] || null);
    });
    const columnPlus = makeControl('Add column', Plus, () => {
        const row = cell?.parentElement as HTMLTableRowElement | null;
        run('insertColumnRight', row?.cells[row.cells.length - 1] || null);
    });
    const hideMenus = () => controls.forEach(root => {
        const panel = root.querySelector<HTMLElement>('.note-table-menu');
        if (panel) panel.hidden = true;
        root.querySelector('button')?.setAttribute('aria-expanded', 'false');
    });
    const menu = (label: string, icon: typeof Plus, actions: Array<[string, string]>) => {
        const root = makeControl(label, icon, () => {
            const opening = panel.hidden;
            hideMenus();
            panel.hidden = !opening;
            root.querySelector('button')?.setAttribute('aria-expanded', String(opening));
            position();
        });
        root.querySelector('button')?.setAttribute('aria-haspopup', 'menu');
        const panel = document.createElement('div');
        panel.className = 'note-table-menu custom-scrollbar-thin';
        panel.hidden = true;
        panel.setAttribute('role', 'menu');
        actions.forEach(([title, method]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = title;
            button.setAttribute('role', 'menuitem');
            button.onclick = () => {
                if (!cell || !quill.isEnabled()) return;
                const table = cell.closest('table');
                const row = cell.parentElement as HTMLTableRowElement;
                const affected = method === 'deleteTable' ? Array.from(table?.rows || []).flatMap(r => Array.from(r.cells))
                    : method === 'deleteRow' ? Array.from(row.cells)
                    : method === 'deleteColumn' ? Array.from(table?.rows || []).map(r => r.cells[cell!.cellIndex]) : [];
                if (affected.some(c => c && (c.textContent?.trim() || c.querySelector('img'))) && !window.confirm(`${title}? This removes its content.`)) return;
                hideMenus();
                run(method);
            };
            panel.appendChild(button);
        });
        root.appendChild(panel);
        return root;
    };
    const rowMenu = menu('Row options', Rows3, [['Insert row above', 'insertRowAbove'], ['Insert row below', 'insertRowBelow'], ['Delete row', 'deleteRow']]);
    const columnMenu = menu('Column options', Columns3, [['Insert column left', 'insertColumnLeft'], ['Insert column right', 'insertColumnRight'], ['Delete column', 'deleteColumn']]);
    const tableMenu = menu('Table options', Ellipsis, [['Delete table', 'deleteTable']]);
    const hide = () => {
        hideMenus();
        controls.forEach(root => { if (root.matches(':popover-open')) root.hidePopover(); });
    };
    const position = () => {
        const table = cell?.closest('table');
        if (!table?.isConnected || !quill.isEnabled()) { hide(); return; }
        const rect = table.getBoundingClientRect();
        const editor = quill.root.parentElement.getBoundingClientRect();
        if (rect.bottom < editor.top || rect.top > editor.bottom) { hide(); return; }
        const active = cell!.getBoundingClientRect();
        const places = [[rect.left + rect.width / 2, rect.bottom], [rect.right, active.top], [rect.left, active.top], [active.left, rect.top], [rect.right, rect.top]];
        controls.forEach((root, index) => {
            const openMenu = root.querySelector<HTMLElement>('.note-table-menu:not([hidden])');
            const focused = root.contains((root.getRootNode() as Document | ShadowRoot).activeElement);
            if (pointerMode && index !== hoveredControl && !openMenu && !focused) {
                if (root.matches(':popover-open')) root.hidePopover();
                return;
            }
            if (!root.matches(':popover-open')) root.showPopover();
            const size = root.firstElementChild!.getBoundingClientRect();
            let [left, top] = places[index];
            if (index === 2) left -= size.width;
            if (index >= 3) top -= size.height;
            root.style.left = `${Math.max(0, Math.min(left, window.innerWidth - size.width))}px`;
            root.style.top = `${Math.max(0, Math.min(top, window.innerHeight - size.height))}px`;
            const panel = root.querySelector<HTMLElement>('.note-table-menu');
            if (panel && !panel.hidden) {
                panel.style.left = '0px'; panel.style.top = `${size.height}px`;
                const bounds = panel.getBoundingClientRect();
                panel.style.left = `${Math.min(0, window.innerWidth - bounds.right)}px`;
                if (bounds.bottom > window.innerHeight) panel.style.top = `${-bounds.height}px`;
            }
        });
    };
    const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            // Inserting at the same cursor index need not emit selection-change.
            if (quill.hasFocus() && !pointerMode) {
                const [, , blot] = module.getTable();
                const next = blot?.domNode || null;
                if (next !== cell) hideMenus();
                cell = next;
            }
            position();
        });
    };
    const selection = (range: any) => {
        if (!range) return;
        if (pointerMode && controls.some(root => root.querySelector('.note-table-menu:not([hidden])'))) return;
        const [, , blot] = module.getTable(range);
        const next = blot?.domNode || null;
        if (next !== cell) hideMenus();
        cell = next;
        schedule();
    };
    const pointerMove = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        pointerMode = true;
        const controlIndex = controls.findIndex(root => event.composedPath().includes(root));
        if (controlIndex >= 0) { hoveredControl = controlIndex; position(); return; }
        // Keep the menu's original row/column target while moving into its popup.
        if (controls.some(root => root.querySelector('.note-table-menu:not([hidden])'))) return;
        const target = event.composedPath()[0] as HTMLElement;
        const pointedCell = target.closest?.('td') as HTMLTableCellElement | null;
        if (pointedCell && quill.root.contains(pointedCell)) cell = pointedCell;
        const table = cell?.closest('table');
        hoveredControl = -1;
        if (table) {
            const rect = table.getBoundingClientRect();
            const reach = parseFloat(getComputedStyle(controls[0].firstElementChild!).width);
            const { clientX: x, clientY: y } = event;
            if (x >= rect.left - reach && x <= rect.right + reach && y >= rect.top - reach && y <= rect.bottom + reach) {
                const rows = Array.from(table.rows);
                const row = rows.find(r => { const b = r.getBoundingClientRect(); return y >= b.top && y <= b.bottom; });
                if (row && !pointedCell) cell = row.cells[cell?.cellIndex || 0] || row.cells[0];
                if (y >= rect.bottom - reach / 2) hoveredControl = 0;
                else if (x >= rect.right - reach / 2 && y >= rect.top) hoveredControl = 1;
                else if (y <= rect.top + reach / 2) {
                    const column = Array.from(table.rows[0].cells).find(c => { const b = c.getBoundingClientRect(); return x >= b.left && x <= b.right; });
                    if (column) cell = column;
                    hoveredControl = x >= rect.right ? 4 : 3;
                } else hoveredControl = 2;
            }
        }
        position();
    };
    const pointerDown = (event: PointerEvent) => {
        pointerMode = event.pointerType === 'mouse';
        if (!pointerMode) schedule();
        outside(event);
    };
    const keyboard = () => { pointerMode = false; hoveredControl = -1; schedule(); };
    const leaveWindow = () => { hoveredControl = -1; position(); };
    const outside = (event: Event) => {
        if (controls.some(root => event.composedPath().includes(root))) return;
        const target = event.composedPath()[0] as HTMLElement;
        if (quill.root.contains(target)) return;
        cell = null; hide();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { hideMenus(); quill.focus(); } };
    quill.on('selection-change', selection);
    quill.on('text-change', schedule);
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('pointermove', pointerMove, true);
    document.addEventListener('keydown', keyboard, true);
    document.documentElement.addEventListener('pointerleave', leaveWindow);
    document.addEventListener('focusin', outside, true);
    host.addEventListener('keydown', escape);
    document.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(quill.root);
    return () => {
        cancelAnimationFrame(frame); observer.disconnect();
        quill.off('selection-change', selection); quill.off('text-change', schedule);
        document.removeEventListener('pointerdown', pointerDown, true); document.removeEventListener('focusin', outside, true);
        document.removeEventListener('pointermove', pointerMove, true); document.removeEventListener('keydown', keyboard, true);
        document.documentElement.removeEventListener('pointerleave', leaveWindow);
        host.removeEventListener('keydown', escape); document.removeEventListener('scroll', schedule, true);
        window.removeEventListener('resize', schedule);
        controls.forEach(root => root.remove());
    };
}
