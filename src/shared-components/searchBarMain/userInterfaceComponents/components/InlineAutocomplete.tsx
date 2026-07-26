import React from 'react';
import type { AnyCommandId } from '../../utilityFunctions/types';

interface InlineAutocompleteProps {
  inlineAutocomplete: string | null;
  highlightIndex: number;
  inlineComposerActive: boolean;
  lockedCommand: AnyCommandId | null;
  showAtCommandMenu: boolean;
  value: string;
  inputLeftPaddingPx: number;
}

export const InlineAutocomplete: React.FC<InlineAutocompleteProps> = ({
  inlineAutocomplete,
  highlightIndex,
  inlineComposerActive,
  lockedCommand,
  showAtCommandMenu,
  value,
  inputLeftPaddingPx,
}) => {
  if (
    !inlineAutocomplete ||
    highlightIndex !== 0 ||
    inlineComposerActive ||
    lockedCommand ||
    showAtCommandMenu ||
    value.trim().length === 0
  ) {
    return null;
  }

  const isMatch =
    inlineAutocomplete.toLowerCase().startsWith(value.toLowerCase()) ||
    inlineAutocomplete.split('|URL|')[0].toLowerCase().startsWith(value.toLowerCase());

  if (!isMatch) return null;

  const [titlePart, urlPart] = inlineAutocomplete.includes('|URL|')
    ? inlineAutocomplete.split('|URL|')
    : [inlineAutocomplete, ''];

  const isTitleMatch = titlePart.toLowerCase().startsWith(value.toLowerCase());
  const completionPart = isTitleMatch ? titlePart.slice(value.length) : '';

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 right-0 flex items-center py-3 rounded-t-xl overflow-hidden text-[16px] min-[1680px]:text-[18px] min-[1880px]:text-[20px] min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px]"
      style={{ paddingLeft: inputLeftPaddingPx }}
    >
      {/* Invisible typed portion (placeholder for alignment) */}
      <span className="text-transparent whitespace-pre">{value}</span>

      {/* 2 Spaces Gap */}
      <span className="text-transparent whitespace-pre">{' '.repeat(2)}</span>

      {/* Highlighted completion portion with selection style */}
      {completionPart && (
        <span
          className="bg-blue-600/30 dark:bg-blue-400/45 text-neutral-900 dark:text-neutral-200 whitespace-pre"
          style={{
            borderRadius: '2px',
            paddingTop: '1.5px',
            paddingBottom: '1.5px',
          }}
        >
          {completionPart}
        </span>
      )}

      {/* URL part - No highlight, blue link style */}
      {urlPart && (
        <span className="text-blue-600 dark:text-blue-400 whitespace-pre ml-2 font-normal opacity-90">
          {' - '}
          {urlPart}
        </span>
      )}
    </div>
  );
};
