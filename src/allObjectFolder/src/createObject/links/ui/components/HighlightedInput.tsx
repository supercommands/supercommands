import * as React from 'react';
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface HighlightedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Pass any specific props if needed
}

const HighlightedInput = forwardRef<HTMLInputElement, HighlightedInputProps>(
  ({ className = '', value, onChange, onScroll, ...props }, ref) => {
    const mirrorRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Expose the input ref to the parent
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
      if (mirrorRef.current && inputRef.current) {
        mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
      }
      if (onScroll) onScroll(e);
    };

    const renderContent = () => {
      const valStr = String(value || '');
      if (!valStr) return null; // If empty, mirror is empty.

      // Split by {query} or [query]
      const parts = valStr.split(/(\{query\}|\[query\])/gi);
      return parts.map((part, i) => {
        if (/^\{query\}$/i.test(part) || /^\[query\]$/i.test(part)) {
          return (
            <span key={i} className="text-[#3b82f6] dark:text-[#60a5fa] font-semibold">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    };

    return (
      <div className={`relative ${className?.includes('w-full') ? 'w-full' : ''}`} style={{ isolation: 'isolate' }}>
        {/* Mirror div */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={className}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'transparent',
            borderColor: 'transparent',
            boxShadow: 'none',
            // Allow text to be visible
            color: 'inherit',
            display: 'flex', // To match input vertical alignment usually
            alignItems: 'center',
            whiteSpace: 'pre',
            overflow: 'hidden',
          }}>
          {renderContent()}
        </div>

        {/* Actual Input */}
        <input
          ref={inputRef}
          value={value}
          onChange={onChange}
          onScroll={handleScroll}
          className={`${className} !text-transparent caret-neutral-800 dark:caret-white`}
          {...props}
          style={{
            // If value is empty, we want placeholder to be visible.
            // But color:transparent hides it.
            // We can conditionally set color if empty vs not.
            color: !value ? undefined : 'transparent',
            ...(props.style || {}),
          }}
        />
      </div>
    );
  },
);
HighlightedInput.displayName = 'HighlightedInput';

export { HighlightedInput };
