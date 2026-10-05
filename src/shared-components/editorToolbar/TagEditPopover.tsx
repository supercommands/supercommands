import * as React from 'react';
import type { TagRecord, TagUpdateInput, TagAppearanceDraft as Appearance } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import { validateTagAppearance } from '../../allObjectFolder/src/createObject/tags/tagAppearanceValidation';
import { TagAppearance, TAG_COLORS, TAG_ICONS, DEFAULT_TAG_APPEARANCE } from './TagAppearance';
import { createTagImageThumbnail } from './tagImageThumbnail';
import { useUIStore } from '../uiStateManager';

export function TagEditPopover({ tag, onSave, onCancel }: {
    tag: TagRecord;
    onSave: (updates: TagUpdateInput) => Promise<void>;
    onCancel: () => void;
}) {
    const [name, setName] = React.useState(tag.name);
    const [appearance, setAppearance] = React.useState<Appearance>(() => {
        try { return tag.appearance ? validateTagAppearance(tag.appearance) : DEFAULT_TAG_APPEARANCE; }
        catch { return DEFAULT_TAG_APPEARANCE; }
    });
    const [appearanceChanged, setAppearanceChanged] = React.useState(false);
    const chooseAppearance = (next: Appearance) => { setAppearanceChanged(true); setAppearance(next); };
    const [mode, setMode] = React.useState<Appearance['kind']>(appearance.kind);
    const [error, setError] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [processing, setProcessing] = React.useState(false);
    const pending = React.useRef(false);
    const uploadSequence = React.useRef(0);
    const input = React.useRef<HTMLInputElement>(null);
    const fileInput = React.useRef<HTMLInputElement>(null);
    const root = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const field = input.current;
        field?.focus();
        if (field) field.setSelectionRange(field.value.length, field.value.length);
        return () => { uploadSequence.current++; };
    }, []);
    React.useEffect(() => useUIStore.getState().registerEscapeInterceptor(() => {
        if (!pending.current) onCancel();
        return true;
    }), [onCancel]);
    const save = async () => {
        if (pending.current || processing) return;
        if (!name.trim()) { setError('Enter a tag name.'); input.current?.focus(); return; }
        if (mode !== appearance.kind) { setError('Choose an image before saving.'); return; }
        pending.current = true; setSaving(true); setError('');
        try {
            await onSave({ name: name.trim(), ...(tag.workspaceId && !tag.appearance && !appearanceChanged ? {} : { appearance }) });
        }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not save the tag. Try again.'); }
        finally { pending.current = false; setSaving(false); }
    };
    const buttonClass = 'flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-borderDefault)] text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50';
    return <div ref={root} role="dialog" aria-label="Edit tag" className="flex flex-col gap-3 p-3 text-xs text-[var(--color-textPrimary)]" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); e.nativeEvent.stopImmediatePropagation(); if (!pending.current) onCancel(); }
        if (e.key === 'Enter' && e.target === input.current && !e.nativeEvent.isComposing) { e.preventDefault(); void save(); }
        if (e.key === 'Tab') {
            const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([tabindex="-1"])') || []);
            const first = controls[0], last = controls[controls.length - 1];
            if (e.shiftKey && e.target === first) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && e.target === last) { e.preventDefault(); first?.focus(); }
        }
    }}>
      <div className="text-sm font-medium">Edit tag</div>
      <label className="flex flex-col gap-1.5 text-[var(--color-textMuted)]">Name
        <input ref={input} value={name} disabled={saving} onChange={e => { setName(e.target.value); setError(''); }} className="w-full rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 py-1.5 text-xs text-[var(--color-textPrimary)] outline-none focus:border-[var(--color-borderActive)] focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]"/>
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[var(--color-textMuted)]">Appearance</span>
        <div className="flex gap-1 rounded-lg border border-[var(--color-borderDefault)] p-1" role="group" aria-label="Tag appearance type">
          {(['color', 'icon', 'image'] as const).map(kind => <button key={kind} type="button" disabled={saving} aria-pressed={mode === kind} onClick={() => {
            uploadSequence.current++; setProcessing(false); setMode(kind); setError('');
            if (kind !== appearance.kind && kind !== 'image') chooseAppearance(kind === 'color' ? DEFAULT_TAG_APPEARANCE : { kind: 'icon', value: 'tag' });
          }} className={`flex-1 rounded-md px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${mode === kind ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]' : 'text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)]'}`}>{kind === 'color' ? 'Color dot' : kind === 'icon' ? 'Icon' : 'Upload'}</button>)}
        </div>
        {mode === 'color' && <div className="flex gap-2" role="group" aria-label="Tag colors">{TAG_COLORS.map(color => <button key={color.id} type="button" aria-label={color.label} aria-pressed={appearance.kind === 'color' && appearance.value === color.id} disabled={saving} className={buttonClass} style={{ backgroundColor: appearance.kind === 'color' && appearance.value === color.id ? 'var(--color-selectedBg)' : undefined }} onClick={() => chooseAppearance({kind: 'color', value: color.id})}><span className="h-3 w-3 rounded-full" style={{backgroundColor: `var(--color-${color.id})`}}/></button>)}</div>}
        {mode === 'icon' && <div className="grid grid-cols-5 gap-2" role="group" aria-label="Standard tag icons">{TAG_ICONS.map(({id, label, icon: Icon}) => <button key={id} type="button" title={label} aria-label={label} aria-pressed={appearance.kind === 'icon' && appearance.value === id} disabled={saving} className={buttonClass} style={{backgroundColor: appearance.kind === 'icon' && appearance.value === id ? 'var(--color-selectedBg)' : undefined}} onClick={() => chooseAppearance({kind: 'icon', value: id})}><Icon size={16}/></button>)}</div>}
        {mode === 'image' && <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-borderDefault)] p-3 text-[var(--color-textMuted)]">
          <button type="button" disabled={saving || processing} onClick={() => fileInput.current?.click()} className="rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-xs text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50">{appearance.kind === 'image' ? 'Replace image' : 'Choose image'}</button>
          <input ref={fileInput} type="file" tabIndex={-1} aria-label="Upload tag image" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" disabled={saving || processing} className="sr-only" onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
            const sequence = ++uploadSequence.current; setProcessing(true); setError('');
            try { const value = await createTagImageThumbnail(file); if (sequence === uploadSequence.current) chooseAppearance({kind: 'image', value}); }
            catch (e) { if (sequence === uploadSequence.current) setError(e instanceof Error ? e.message : 'Could not read the image.'); }
            finally { if (sequence === uploadSequence.current) setProcessing(false); }
          }}/>
          <span>{processing ? 'Preparing image…' : 'PNG, JPG, WebP, GIF or AVIF · up to 10 MB'}</span>
        </div>}
      </div>
      <div className="flex items-center gap-2 rounded-md bg-[var(--color-inputBg)] px-2 py-2" aria-label="Tag preview">{appearance.kind === 'image' && 'value' in appearance ? <img src={appearance.value} alt="" className="h-3.5 w-3.5 shrink-0 object-contain"/> : <TagAppearance tag={{id: tag.id, workspaceId: tag.workspaceId, appearance: tag.workspaceId && !tag.appearance && !appearanceChanged ? undefined : appearance}}/>}<span className="truncate">{name.trim() || 'Tag name'}</span></div>
      {error && <div role="alert" className="text-xs text-[var(--color-error)]">{error}</div>}
      <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={onCancel} className="rounded-md px-3 py-1.5 text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Cancel</button><button type="button" disabled={saving || processing || mode !== appearance.kind} onClick={() => void save()} className="rounded-md border border-[var(--color-borderActive)] bg-[var(--color-selectedBg)] px-3 py-1.5 font-medium text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">{saving ? 'Saving…' : 'Save'}</button></div>
    </div>;
}
