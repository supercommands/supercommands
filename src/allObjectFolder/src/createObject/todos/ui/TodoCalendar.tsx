import * as React from 'react';
import { useState } from 'react';
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from 'react-icons/md';
import { FaPlus } from 'react-icons/fa';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  subMonths,
  addMonths,
  subDays,
  addDays,
  isSameDay,
  startOfWeek,
  endOfWeek,
  setMonth,
  setYear,
} from 'date-fns';

interface TodoItem {
  snippet_id: string;
  key: string;
  event_deadline: string;
  is_done: boolean;
}

interface TodoCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  tasks?: TodoItem[];
}

const TodoCalendar: React.FC<TodoCalendarProps> = ({ selectedDate, onDateChange, tasks = [] }) => {
  // We'll use startDate to track the beginning of our 2-week view
  const [startDate, setStartDate] = useState(startOfWeek(new Date()));
  const [showPicker, setShowPicker] = useState<'none' | 'month' | 'year'>('none');
  const isDarkMode = document.documentElement.classList.contains('dark');

  const handleDateClick = (date: Date) => {
    onDateChange(date);
  };

  const handlePreviousPeriod = () => {
    setStartDate(prev => subDays(prev, 14));
  };

  const handleNextPeriod = () => {
    setStartDate(prev => addDays(prev, 14));
  };

  const renderDaysOfWeek = () => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day, idx) => (
          <div
            key={`${day}-${idx}`}
            className={`text-center text-[10px] font-bold ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`}>
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderTwoWeeks = () => {
    const end = addDays(startDate, 13);
    const days = eachDayOfInterval({ start: startDate, end });

    return (
      <div className="grid grid-cols-7 gap-y-1">
        {days.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const hasTasks = tasks.some(t => !t.is_done && isSameDay(new Date(t.event_deadline), day));

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center transition-all duration-200 text-[11px] relative group ${
                isSelected
                  ? 'bg-neutral-800 dark:bg-white text-white dark:text-neutral-900 shadow-md'
                  : isDarkMode
                    ? 'text-neutral-300 hover:bg-white/5'
                    : 'text-neutral-800 hover:bg-black/5'
              } ${isToday && !isSelected ? 'font-bold text-blue-500' : ''}`}>
              {day.getDate()}
              {hasTasks && (
                <div
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? (isDarkMode ? 'bg-neutral-900' : 'bg-white') : 'bg-neutral-400 opacity-40'}`}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const handleMonthSelect = (mIndex: number) => {
    const newDate = setMonth(startDate, mIndex);
    setStartDate(startOfWeek(newDate));
    setShowPicker('none');
  };

  const handleYearSelect = (year: number) => {
    const newDate = setYear(startDate, year);
    setStartDate(startOfWeek(newDate));
    setShowPicker('none');
  };

  return (
    <div tabIndex={-1} className={`mt-4 pt-4 border-t relative calendar-container outline-none ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
      {/* Picker Overlay */}
      {showPicker !== 'none' && (
        <div
          className={`absolute inset-0 z-[200] p-4 rounded-xl backdrop-blur-md flex flex-col ${isDarkMode ? 'bg-[#0a0a0a]/95' : 'bg-white/95'}`}>
          <div className="flex items-center justify-between mb-4">
            <span
              className={`text-[10px] font-bold tracking-wider ${isDarkMode ? 'text-white/60' : 'text-slate-700'}`}>
              Select {showPicker === 'month' ? 'Month' : 'Year'}
            </span>
            <button
              onClick={() => setShowPicker('none')}
              className={`p-1 rounded-md hover:bg-neutral-500/10 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              <FaPlus size={10} className="rotate-45" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 flex-1">
            {showPicker === 'month'
              ? months.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => handleMonthSelect(i)}
                    className={`text-[11px] font-bold py-2 rounded-lg transition-all ${
                      isDarkMode
                        ? 'text-white/60 hover:bg-white/10 hover:text-white'
                        : 'text-slate-600 hover:bg-black/5 hover:text-slate-900'
                    }`}>
                    {m.slice(0, 3)}
                  </button>
                ))
              : [2024, 2025, 2026, 2027, 2028, 2029].map(y => (
                  <button
                    key={y}
                    onClick={() => handleYearSelect(y)}
                    className={`text-[11px] font-bold py-2 rounded-lg transition-all ${
                      isDarkMode
                        ? 'text-white/60 hover:bg-white/10 hover:text-white'
                        : 'text-neutral-600 hover:bg-black/5 hover:text-neutral-900'
                    }`}>
                    {y}
                  </button>
                ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPicker(showPicker === 'month' ? 'none' : 'month')}
            className={`text-xs font-bold px-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
            {format(startDate, 'MMM')}
            {format(startDate, 'yyyy-MM') !== format(addDays(startDate, 13), 'yyyy-MM') && (
              <span className="mx-1 opacity-80">- {format(addDays(startDate, 13), 'MMM')}</span>
            )}
          </button>
          <button
            onClick={() => setShowPicker(showPicker === 'year' ? 'none' : 'year')}
            className={`text-xs font-bold px-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
            {format(startDate, 'yyyy')}
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handlePreviousPeriod}
            className={`p-1 rounded-md transition-all ${isDarkMode ? 'hover:bg-white/5 text-neutral-400' : 'hover:bg-black/5 text-neutral-500'}`}>
            <MdKeyboardArrowLeft size={16} />
          </button>
          <button
            onClick={handleNextPeriod}
            className={`p-1 rounded-md transition-all ${isDarkMode ? 'hover:bg-white/5 text-neutral-400' : 'hover:bg-black/5 text-neutral-500'}`}>
            <MdKeyboardArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="relative">
        {renderDaysOfWeek()}
        {renderTwoWeeks()}
      </div>
    </div>
  );
};

export default TodoCalendar;
