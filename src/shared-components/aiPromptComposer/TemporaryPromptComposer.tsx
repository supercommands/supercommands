/** Shared existing prompt controls and modal presentation; chrome/theme services stay host-owned. */
import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FiChevronDown, FiChevronRight, FiEdit2, FiMaximize2, FiMinimize2, FiPlus, FiX } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { TemporaryPromptTabFavicon as TabFavicon } from './TemporaryPromptTabFavicon';
import { useTemporaryPromptComposer, type TemporaryPromptComposerOptions } from './useTemporaryPromptComposer';
import { TemporaryPromptComposerContent } from './TemporaryPromptComposerContent';
export interface TemporaryPromptComposerProps extends TemporaryPromptComposerOptions {
    title?: string;
    rules?: string;
    themeVariables?: CSSProperties;
    onEdit?: () => void;
    presentation?: 'modal' | 'embedded';
    error?: string | null;
    recipientIcon?: ReactNode;
    headerTrailing?: ReactNode;
}
const getRulesPreview = (rules: string) => String(rules || '')
    .replace(/<\/(?:p|div|li)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export function TemporaryPromptComposer({ title, rules, themeVariables, onEdit, presentation = 'modal', error, recipientIcon, headerTrailing, ...options }: TemporaryPromptComposerProps) {
    const { onClose, isSending = false } = options;
    const rulesPreview = useMemo(() => getRulesPreview(rules || ''), [rules]);
    const controller = useTemporaryPromptComposer(options);
    const { value, setValue, setCaret, attachedTabs, setAttachedTabs, setTextareaFocused,
        setMentionDismissed, highlightedIndex, setHighlightedIndex, expanded, setExpanded,
        rulesExpanded, setRulesExpanded, formRef, textareaRef, canSend, filteredTabs,
        mentionMenuOpen, updateCaret, attachTab, beginAttachmentSearch, handlePromptKeyDown,
        handleSubmit } = controller;
    if (presentation === 'embedded') return <TemporaryPromptComposerContent controller={controller} title={title}
      rules={rulesPreview} error={error} onEdit={onEdit} onBack={onClose} pending={isSending} recipientIcon={recipientIcon} headerTrailing={headerTrailing}/>;
    const layerStyle = {
        paddingTop: 'var(--website-popup-viewport-inset)',
        paddingRight: 'var(--website-popup-viewport-inset)',
        paddingBottom: 'var(--website-popup-viewport-inset)',
        paddingLeft: 'var(--website-popup-viewport-inset)',
    } as CSSProperties;
    const surfaceStyle = {
        width: `min(${expanded ? 'var(--website-popup-width)' : 'calc(var(--website-popup-width) - var(--website-popup-trailing-max-width))'}, calc(100vw - var(--website-popup-viewport-space)))`,
        height: expanded ? 'var(--website-popup-height)' : 'auto',
        maxHeight: '100%',
        borderRadius: 'var(--website-popup-radius)',
        background: 'var(--color-altsPopupBg, var(--color-popupBg))',
        boxShadow: 'inset 0 0 0 var(--website-popup-outline-width) var(--color-altsBorderColor, var(--color-borderDefault))',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
    } as CSSProperties;
    return (<div className="website-popup-token-scope fixed inset-0 z-[2147483647] box-border flex h-[100dvh] w-screen items-center justify-center text-[var(--color-altsTextPrimary,var(--color-textPrimary))]" style={{ ...layerStyle, ...themeVariables }}>
      <button type="button" tabIndex={-1} aria-label="Close prompt input" className="absolute inset-0 cursor-default bg-transparent" onClick={onClose} disabled={isSending}/>
      <form ref={formRef} role="dialog" aria-modal="true" aria-label={title || 'AI Prompt'} onSubmit={handleSubmit} className="relative z-10 grid min-h-0 overflow-hidden font-[var(--website-popup-font-family)]" style={{ ...surfaceStyle, gridTemplateRows: 'var(--website-popup-header-height) minmax(0, 1fr) var(--website-popup-footer-height)' }}>
        <div className="flex min-w-0 items-center gap-[var(--website-popup-navigation-gap)] border-b border-[var(--color-altsDividerColor,var(--color-borderDefault))] bg-[var(--color-altsSearchBg,var(--color-inputBg))] px-[var(--website-popup-header-padding-x)]">
          <span className="flex h-[var(--website-popup-navigation-size)] w-[var(--website-popup-navigation-size)] shrink-0 items-center justify-center text-[var(--color-altsIconColor,var(--color-iconDefault))]" aria-hidden="true">
            <LuSparkles className="h-4 w-4"/>
          </span>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold" title={title || 'AI Prompt'}>
            {title || 'AI Prompt'}
          </div>
          <button type="button" aria-label={expanded ? 'Collapse prompt editor' : 'Expand prompt editor'} title={expanded ? 'Collapse prompt editor' : 'Expand prompt editor'} aria-pressed={expanded} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--website-popup-key-radius)] text-[var(--color-altsTextSecondary,var(--color-textSecondary))] hover:bg-[var(--color-altsRowHoverBg,var(--color-hoverBg))] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-altsFocusColor,var(--color-focusRing))]" onClick={() => setExpanded(current => !current)}>
            {expanded ? <FiMinimize2 size={16}/> : <FiMaximize2 size={16}/>}
          </button>
          <button type="button" aria-label="Close prompt input" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--website-popup-key-radius)] text-[var(--color-altsTextSecondary,var(--color-textSecondary))] transition-colors hover:bg-[var(--color-altsRowHoverBg,var(--color-hoverBg))] hover:text-[var(--color-altsTextPrimary,var(--color-textPrimary))]" onClick={onClose} disabled={isSending}>
            <FiX size={17}/>
          </button>
        </div>

        <div className="website-popup-custom-scrollbar relative flex min-h-0 flex-col gap-2 overflow-y-auto bg-[var(--color-altsListBg,var(--color-popupBg))] px-[var(--website-popup-header-padding-x)] py-3">
          <textarea ref={textareaRef} rows={4} aria-label="Prompt" style={{ minHeight: 'calc(var(--website-popup-search-line-height) * 4)', maxHeight: expanded ? 'var(--website-popup-height)' : 'var(--website-popup-create-composer-max-height)' }} value={value} onChange={event => {
            setValue(event.target.value);
            setCaret(event.target.selectionStart ?? event.target.value.length);
            setMentionDismissed(false);
        }} onSelect={updateCaret} onClick={updateCaret} onKeyUp={updateCaret} onKeyDown={handlePromptKeyDown} onFocus={() => setTextareaFocused(true)} onBlur={() => window.setTimeout(() => setTextareaFocused(false), 0)} className="w-full shrink-0 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-base leading-6 text-[var(--color-altsTextPrimary,var(--color-textPrimary))] placeholder:text-[var(--color-altsTextPlaceholder,var(--color-textPlaceholder))] outline-none shadow-none focus:border-0 focus:outline-none focus:ring-0" placeholder="Type your prompt here" disabled={isSending}/>

          {mentionMenuOpen ? (<div className="website-popup-custom-scrollbar z-20 box-border shrink-0 overflow-x-hidden overflow-y-auto rounded-[var(--website-popup-row-radius)] border border-[var(--color-altsBorderColor,var(--color-borderDefault))] bg-[var(--color-altsSearchBg,var(--color-inputBg))] p-1" style={{
                width: '100%',
                maxHeight: 'var(--website-popup-tab-picker-height)',
            }} role="listbox" aria-label="Open tabs">
              {filteredTabs.map((tab, index) => (<button key={tab.id} type="button" role="option" aria-selected={index === highlightedIndex} title={`${tab.title}\n${tab.url}`} className={`flex h-10 w-full min-w-0 items-center gap-3 rounded-[var(--website-popup-key-radius)] px-3 text-left text-sm ${index === highlightedIndex
                    ? 'bg-[var(--color-altsRowSelectedBg,var(--color-hoverBg))] text-[var(--color-altsTextPrimary,var(--color-textPrimary))]'
                    : 'text-[var(--color-altsTextSecondary,var(--color-textSecondary))] hover:bg-[var(--color-altsRowHoverBg,var(--color-hoverBg))]'}`} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setHighlightedIndex(index)} onClick={() => attachTab(tab)}>
                  <TabFavicon tab={tab} className="h-4 w-4"/>
                  <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                </button>))}
            </div>) : null}

          <div className="flex min-h-8 shrink-0 items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-xs text-[var(--color-altsTextSecondary,var(--color-textSecondary))]" title="Type @ to search open tabs">{attachedTabs.length ? `Attached (${attachedTabs.length})` : 'Tabs · @'}</span>
            {attachedTabs.map(tab => (<span key={tab.id} className="group flex h-7 max-w-48 shrink-0 items-center gap-1.5 rounded-[var(--website-popup-key-radius)] border border-[var(--color-altsBorderColor,var(--color-borderDefault))] bg-[var(--color-altsSearchBg,var(--color-inputBg))] px-2 text-xs text-[var(--color-altsTextSecondary,var(--color-textSecondary))]" title={`${tab.title}\n${tab.url}`}>
                <TabFavicon tab={tab} className="h-3.5 w-3.5"/>
                <span className="min-w-0 truncate">{tab.title}</span>
                <button type="button" aria-label={`Remove attached tab ${tab.title}`} disabled={isSending} className="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[var(--color-altsRowHoverBg,var(--color-hoverBg))] focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100" onClick={() => {
                setAttachedTabs(current => current.filter(candidate => candidate.tabId !== tab.tabId));
                textareaRef.current?.focus({ preventScroll: true });
            }}>
                  <FiX size={11}/>
                </button>
              </span>))}
            <button type="button" className="flex h-7 shrink-0 items-center gap-1 rounded-[var(--website-popup-key-radius)] px-2 text-xs text-[var(--color-altsTextSecondary,var(--color-textSecondary))] hover:bg-[var(--color-altsRowHoverBg,var(--color-hoverBg))] hover:text-[var(--color-altsTextPrimary,var(--color-textPrimary))]" onClick={beginAttachmentSearch} disabled={isSending}>
              <FiPlus size={12}/>
              Add tab
            </button>
          </div>

          {onEdit || rulesPreview ? (<div className="shrink-0">
            <div className="grid h-8 w-full min-w-0 shrink-0 items-center gap-2 overflow-hidden" style={{ gridTemplateColumns: 'auto minmax(0, 1fr) var(--website-popup-navigation-size)' }}>
              <button type="button" aria-expanded={rulesExpanded} aria-controls="prompt-rules-preview" onClick={() => setRulesExpanded(current => !current)} className="flex items-center gap-1 text-xs text-[var(--color-altsTextSecondary,var(--color-textSecondary))] hover:text-[var(--color-altsTextPrimary,var(--color-textPrimary))]"> {rulesExpanded ? <FiChevronDown /> : <FiChevronRight />} Rules</button>
              <span className="block min-w-0 truncate text-xs text-[var(--color-altsTextSecondary,var(--color-textSecondary))]" title={rulesPreview}>
                {rulesPreview}
              </span>
               {onEdit ? <button type="button" aria-label="Edit this prompt" title="Edit prompt" className="flex h-6 w-6 shrink-0 items-center justify-self-end justify-center rounded-[var(--website-popup-key-radius)] text-[var(--color-altsTextSecondary,var(--color-textSecondary))] hover:bg-[var(--color-altsRowHoverBg,var(--color-hoverBg))] hover:text-[var(--color-altsTextPrimary,var(--color-textPrimary))] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-altsFocusColor,var(--color-focusRing))]" onClick={onEdit} disabled={isSending}>
                <FiEdit2 size={14}/>
              </button>
                : null} </div> {rulesExpanded ? <div id="prompt-rules-preview" className="website-popup-custom-scrollbar overflow-y-auto whitespace-pre-wrap break-words px-2 py-2 text-xs leading-5 text-[var(--color-altsTextSecondary,var(--color-textSecondary))]" style={{ maxHeight: 'var(--website-popup-create-composer-max-height)' }}>{rulesPreview || 'No saved rules.'}</div> : null}
            </div>) : null}
        </div>

        <div className="flex h-[var(--website-popup-footer-height)] items-center justify-end gap-2 border-t border-[var(--color-altsDividerColor,var(--color-borderDefault))] bg-[var(--color-altsSearchBg,var(--color-inputBg))] px-[var(--website-popup-header-padding-x)]">
          <span className="mr-auto hidden min-w-0 truncate text-xs text-[var(--color-altsTextSecondary,var(--color-textSecondary))] sm:block">{!canSend && !isSending ? 'Enter a prompt to send' : 'Ctrl / ⌘ + Enter'}</span>
          <button type="button" className="inline-flex h-7 items-center justify-center rounded-[var(--website-popup-key-radius)] border border-[var(--color-altsBorderColor,var(--color-borderDefault))] px-3 text-xs font-semibold text-[var(--color-altsTextSecondary,var(--color-textSecondary))] hover:bg-[var(--color-altsRowHoverBg,var(--color-hoverBg))] hover:text-[var(--color-altsTextPrimary,var(--color-textPrimary))]" onClick={onClose} disabled={isSending}>
            Cancel
          </button>
          <button type="submit" className="inline-flex h-7 items-center justify-center rounded-[var(--website-popup-key-radius)] bg-[var(--color-altsFocusColor,var(--color-accent))] px-3 text-xs font-semibold text-[var(--color-altsTextPrimary,var(--color-textPrimary))] disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSend}>
            {isSending ? 'Sending…' : 'Send prompt'}
          </button>
        </div>
      </form>
    </div>);
}
