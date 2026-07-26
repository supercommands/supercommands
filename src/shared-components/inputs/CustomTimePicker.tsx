import React, { useState, useEffect, useRef } from 'react';

interface CustomTimePickerProps {
  value: string; // 'HH:mm'
  onChange: (val: string) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  focusedColumn?: number;
}

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange, isOpen, setIsOpen }) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  let [hh, mm] = (value || '09:00').split(':');
  if (!hh) hh = '09';
  if (!mm) mm = '00';

  let hrNum = parseInt(hh);
  const isPM = hrNum >= 12;
  let hr12 = hrNum % 12;
  if (hr12 === 0) hr12 = 12;

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;

    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleHourChange = (newHr: number) => updateTime(newHr, mm, isPM);
  const handleMinChange = (newMin: string) => updateTime(hr12, newMin, isPM);
  const handleMeridiemChange = (newIsPM: boolean) => updateTime(hr12, mm, newIsPM);

  return (
    <div ref={popupRef} className="absolute right-0 top-full mt-2 bg-[#141414] border border-white/10 rounded-xl p-2 shadow-2xl z-[10000] flex gap-2 text-white font-sans" onClick={e => e.stopPropagation()}>
      {/* Hours */}
      <div className="flex flex-col gap-1 w-12 h-40 overflow-y-auto custom-scrollbar pr-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
          <button
            key={h}
            type="button"
            onClick={() => handleHourChange(h)}
            className={`w-full text-center py-1.5 rounded-lg text-sm transition-colors ${hr12 === h ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/10 hover:text-white'}`}
          >
            {String(h).padStart(2, '0')}
          </button>
        ))}
      </div>

      <div className="flex flex-col justify-center text-neutral-500 font-bold">:</div>

      {/* Minutes */}
      <div className="flex flex-col gap-1 w-12 h-40 overflow-y-auto custom-scrollbar pr-1">
        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => handleMinChange(m)}
            className={`w-full text-center py-1.5 rounded-lg text-sm transition-colors ${mm === m ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/10 hover:text-white'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="w-px bg-white/10 mx-1"></div>

      {/* AM/PM */}
      <div className="flex flex-col gap-1 w-12 justify-center">
        <button
          type="button"
          onClick={() => handleMeridiemChange(false)}
          className={`w-full text-center py-2 rounded-lg text-sm transition-colors ${!isPM ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/10 hover:text-white'}`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => handleMeridiemChange(true)}
          className={`w-full text-center py-2 rounded-lg text-sm transition-colors ${isPM ? 'bg-white/20 text-white font-medium' : 'text-neutral-400 hover:bg-white/10 hover:text-white'}`}
        >
          PM
        </button>
      </div>
    </div>
  );
};

export default CustomTimePicker;
