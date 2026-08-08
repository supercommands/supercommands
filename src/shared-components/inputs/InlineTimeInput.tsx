import * as React from 'react';
import { useRef, useEffect } from 'react';

interface InlineTimeInputProps {
  value: string; // 'HH:mm' in 24h
  onChange: (val: string) => void;
  onExitRight?: () => void;
  onExitLeft?: () => void;
}

const InlineTimeInput: React.FC<InlineTimeInputProps> = ({ value, onChange, onExitRight, onExitLeft }) => {
  let [hh, mm] = (value || '09:00').split(':');
  let hr24 = parseInt(hh, 10);
  const isPM = hr24 >= 12;
  let hr12 = hr24 % 12 || 12;

  const hrRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const ampmRef = useRef<HTMLInputElement>(null);

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;
    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, segment: 'hr' | 'min' | 'ampm') => {
    if (e.key === 'ArrowRight') {
      if (segment === 'hr' && hrRef.current?.selectionEnd === hrRef.current?.value.length) { e.preventDefault(); minRef.current?.focus(); }
      else if (segment === 'min' && minRef.current?.selectionEnd === minRef.current?.value.length) { e.preventDefault(); ampmRef.current?.focus(); }
      else if (segment === 'ampm' && ampmRef.current?.selectionEnd === ampmRef.current?.value.length) { e.preventDefault(); onExitRight?.(); }
    } else if (e.key === 'ArrowLeft') {
      if (segment === 'ampm' && ampmRef.current?.selectionStart === 0) { e.preventDefault(); minRef.current?.focus(); }
      else if (segment === 'min' && minRef.current?.selectionStart === 0) { e.preventDefault(); hrRef.current?.focus(); }
      else if (segment === 'hr' && hrRef.current?.selectionStart === 0) { e.preventDefault(); onExitLeft?.(); }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (segment === 'hr') updateTime(e.key === 'ArrowUp' ? (hr12 === 12 ? 1 : hr12 + 1) : (hr12 === 1 ? 12 : hr12 - 1), mm, isPM);
      else if (segment === 'min') {
        let m = parseInt(mm, 10);
        m = e.key === 'ArrowUp' ? (m + 1) % 60 : (m - 1 + 60) % 60;
        updateTime(hr12, String(m).padStart(2, '0'), isPM);
      }
      else if (segment === 'ampm') updateTime(hr12, mm, !isPM);
    } else if (e.key === 'Tab') {
      if (!e.shiftKey) {
        if (segment === 'hr') { e.preventDefault(); minRef.current?.focus(); }
        else if (segment === 'min') { e.preventDefault(); ampmRef.current?.focus(); }
      } else {
        if (segment === 'ampm') { e.preventDefault(); minRef.current?.focus(); }
        else if (segment === 'min') { e.preventDefault(); hrRef.current?.focus(); }
      }
    }
  };

  return (
    <div className="flex items-center text-neutral-300 text-[13px] inline-time-input" onClick={e => e.stopPropagation()}>
      <input
        ref={hrRef}
        type="text"
        value={String(hr12).padStart(2, '0')}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 12) num = parseInt(val.slice(-1), 10);
            if (num === 0 && val.length > 1) num = 12;
            updateTime(num || 12, mm, isPM);
            if (val.length === 2 && num >= 1) minRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'hr')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm font-medium text-[13px]"
      />
      <span className="opacity-50 pb-[2px] font-medium">:</span>
      <input
        ref={minRef}
        type="text"
        value={mm}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 59) num = parseInt(val.slice(-1), 10);
            updateTime(hr12, String(num).padStart(2, '0'), isPM);
            if (val.length === 2) ampmRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'min')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm font-medium text-[13px]"
      />
      <input
        ref={ampmRef}
        type="text"
        value={isPM ? 'PM' : 'AM'}
        onChange={e => {
          const val = e.target.value.toUpperCase();
          if (val.includes('A')) updateTime(hr12, mm, false);
          if (val.includes('P')) updateTime(hr12, mm, true);
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'ampm')}
        className="w-[22px] ml-1 bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm text-[11px] font-bold tracking-wider"
      />
    </div>
  );
};


export default InlineTimeInput;
