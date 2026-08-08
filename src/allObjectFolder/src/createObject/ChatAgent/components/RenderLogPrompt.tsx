import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const RenderLogPrompt: React.FC<{ prompt: string; isDark: boolean }> = ({ prompt, isDark }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const CHAR_LIMIT = 200;
  const LINE_LIMIT = 4;

  const lines = prompt.split('\n');
  const isLarge = prompt.length > CHAR_LIMIT || lines.length > LINE_LIMIT;

  // Simple slice for display text
  const displayText = isExpanded ? prompt : lines.slice(0, LINE_LIMIT).join('\n').slice(0, CHAR_LIMIT);

  return (
    <div className="relative group">
      <div
        className={`whitespace-pre-wrap break-words ${!isExpanded && isLarge ? 'line-clamp-4' : ''} ${
          isDark ? 'text-white/80' : 'text-[#586e75]'
        }`}>
        {displayText}
        {!isExpanded && isLarge && <span className="opacity-50">...</span>}
      </div>

      {isLarge && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            text-[10px] mt-1 font-medium transition-colors
            ${isDark ? 'text-white/40 hover:text-white/80' : 'text-[#93a1a1] hover:text-[#586e75]'}
          `}>
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};
