/** Spacious embedded presentation over the same New Tab prompt/tab controller. */
import type { ReactNode } from 'react';
import { FiEdit2, FiPlus, FiX } from 'react-icons/fi';
import type { TemporaryPromptComposerController } from './useTemporaryPromptComposer';
import { TemporaryPromptTabFavicon } from './TemporaryPromptTabFavicon';
export function TemporaryPromptComposerContent({ controller: c, title, rules, error, onEdit, onBack, pending, recipientIcon, headerTrailing }: {
  controller: TemporaryPromptComposerController; title?: string; rules: string; error?: string | null;
  onEdit?: () => void; onBack: () => void; pending: boolean;
  recipientIcon?: ReactNode;
  headerTrailing?: ReactNode;
}) {
  return <form ref={c.formRef} className="website-popup-prompt-composer"
    aria-label={`Prompt for ${title || 'Agent'}`} onSubmit={c.handleSubmit} onKeyDown={event => {
      if (event.defaultPrevented || event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (pending) return;
        onBack();
      } else if (event.key === 'Backspace' && event.target === c.textareaRef.current && !c.value && !c.attachedTabs.length) {
        event.preventDefault(); event.stopPropagation(); if (!pending) onBack();
      }
    }}>
    <header className="website-popup-prompt-composer__header">
      <span className="website-popup-prompt-composer__icon" aria-hidden="true">{recipientIcon}</span>
      <span className="website-popup-prompt-composer__title">{title || 'Send to Agent'}</span>
      {headerTrailing}
      <button type="button" className="website-popup-prompt-composer__icon" aria-label="Cancel prompt" disabled={pending} onClick={onBack}><FiX/></button>
    </header>
    <div className="website-popup-prompt-composer__body website-popup-custom-scrollbar">
      <div className="website-popup-prompt-composer__editor">
      <textarea ref={c.textareaRef} className="website-popup-prompt-composer__textarea website-popup-custom-scrollbar" rows={4}
        value={c.value} placeholder="Type your prompt here · @ to add tabs" aria-label="Temporary prompt" disabled={pending}
        onChange={event => { c.setValue(event.currentTarget.value); c.setCaret(event.currentTarget.selectionStart); c.setMentionDismissed(false); }}
        onSelect={c.updateCaret} onClick={c.updateCaret} onKeyUp={c.updateCaret} onKeyDown={c.handlePromptKeyDown}
        onFocus={() => c.setTextareaFocused(true)} onBlur={() => c.setTextareaFocused(false)}/>
      {!pending && c.mentionMenuOpen && <div className="website-popup-prompt-composer__tabs website-popup-custom-scrollbar" role="listbox" aria-label="Open tabs">
        {!c.filteredTabs.length && <div className="website-popup-prompt-composer__status">No matching open tabs</div>}
        {c.filteredTabs.map((tab, index) => <button key={tab.id} type="button" className="website-popup-prompt-composer__tab"
          role="option" aria-selected={c.highlightedIndex === index} title={tab.url} onMouseDown={event => event.preventDefault()}
          onMouseEnter={() => c.setHighlightedIndex(index)} onClick={() => c.attachTab(tab)}>
          <TemporaryPromptTabFavicon tab={tab} className="website-popup-prompt-composer__favicon"/>
          <span className="website-popup-prompt-composer__attachment-title">{tab.title || tab.url}</span>
        </button>)}
      </div>}
      </div>
      <div className="website-popup-prompt-composer__status" role={error ? 'alert' : 'status'} data-error={Boolean(error)}>
        {error || (pending ? 'Working…' : c.tabsLoading ? 'Loading tabs…' : c.tabsError || null)}
      </div>
      {c.tabsError && <button type="button" className="website-popup-prompt-composer__action" disabled={pending}
        onClick={() => { void c.reloadTabs(); }}>Retry tabs</button>}
      <div className="website-popup-prompt-composer__attachments website-popup-custom-scrollbar">
        <span className="website-popup-prompt-composer__attachment-label">{c.attachedTabs.length ? `Attached (${c.attachedTabs.length})` : 'Tabs · @'}</span>
        {c.attachedTabs.map(tab => <span key={tab.tabId} className="website-popup-create-option-placeholder" title={tab.url}>
          <TemporaryPromptTabFavicon tab={tab} className="website-popup-prompt-composer__favicon"/>
          <span className="website-popup-prompt-composer__attachment-title">{tab.title || tab.url}</span>
          <button type="button" aria-label={`Remove attached tab ${tab.title}`} disabled={pending} onClick={() => {
            c.setAttachedTabs(tabs => tabs.filter(value => value.tabId !== tab.tabId)); c.textareaRef.current?.focus({ preventScroll: true });
          }}><FiX/></button>
        </span>)}
        <button type="button" className="website-popup-prompt-composer__action" disabled={pending} onClick={c.beginAttachmentSearch}><FiPlus/> Add tab</button>
      </div>
      <div className="website-popup-prompt-composer__rules">
        <span className="website-popup-prompt-composer__attachment-label">Rules</span>
        <span className="website-popup-prompt-composer__rule-summary" title={rules}>{rules || 'No saved rules'}</span>
        {onEdit && <button type="button" className="website-popup-prompt-composer__icon" aria-label="Edit recipient" disabled={pending} onClick={onEdit}><FiEdit2/></button>}
      </div>
    </div>
    <footer className="website-popup-prompt-composer__footer">
      <button type="button" className="website-popup-prompt-composer__action" disabled={pending} onClick={onBack}>Cancel</button>
      <button type="submit" className="website-popup-create-footer__save" disabled={!c.canSend}>{pending ? 'Sending…' : 'Send'}</button>
    </footer>
  </form>;
}
