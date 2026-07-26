import { format, addDays, addHours } from 'date-fns';

export type DueDateValue = {
  date: string; // YYYY-MM-DD local calendar date
  time: string | null; // HH:mm or null for "Any time"
  timezone: string; // IANA timezone
};

export type ParsedDueDate =
  | {
      valid: true;
      value: DueDateValue;
      displayDate: string;
      displayTime: string;
    }
  | {
      valid: false;
      reason: 'empty' | 'incomplete' | 'invalid';
    };

function pad(val: number): string {
  return String(val).padStart(2, '0');
}

export function formatLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

export function displayDateFormatted(date: Date, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US'), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch (e) {
    return format(date, 'EEE, d MMM');
  }
}

export function displayTimeFormatted(timeStr: string | null, locale?: string): string {
  if (!timeStr) return 'Any time';
  const [hh, mm] = timeStr.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return 'Any time';
  const sample = new Date(2000, 0, 1, hh, mm);
  try {
    return new Intl.DateTimeFormat(locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US'), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(sample);
  } catch (e) {
    const hr12 = hh % 12 || 12;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    return `${hr12}:${pad(mm)} ${ampm}`;
  }
}

export function parseClock(text: string | undefined): { valid: boolean; time: string | null } {
  if (!text || !text.trim()) return { valid: true, time: null };
  const cleaned = text.trim().replace(/^at\s+/i, '');
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return { valid: false, time: null };

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3] ? match[3].toLowerCase() : null;

  if (minute > 59) return { valid: false, time: null };

  if (meridiem) {
    if (hour < 1 || hour > 12) return { valid: false, time: null };
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else {
    if (hour > 23) return { valid: false, time: null };
  }

  return { valid: true, time: `${pad(hour)}:${pad(minute)}` };
}

const numberWords: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
};

export function parseDueDateInput(
  inputRaw: string,
  options?: {
    now?: Date;
    timezone?: string;
    locale?: string;
  }
): ParsedDueDate {
  const now = options?.now || new Date();
  const timezone = options?.timezone || (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Asia/Kolkata';
  const locale = options?.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

  // Convert word numbers (two -> 2, three -> 3, etc.) and strip ordinal suffixes
  const cleaned = inputRaw
    .trim()
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, m => numberWords[m.toLowerCase()] || m);

  const input = cleaned
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .replace(/(\d+)([a-z]+)/gi, '$1 $2 ')
    .replace(/([a-z]+)(\d+)/gi, '$1 $2 ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!input) return { valid: false, reason: 'empty' };

  function buildResult(dateObj: Date, timeStr: string | null): ParsedDueDate {
    return {
      valid: true,
      value: {
        date: formatLocalISODate(dateObj),
        time: timeStr,
        timezone,
      },
      displayDate: displayDateFormatted(dateObj, locale),
      displayTime: displayTimeFormatted(timeStr, locale),
    };
  }

  // 1. "tomorrow [time]"
  let match = input.match(/^tomorrow(?:\s+(.+))?$/i);
  if (match) {
    const clock = parseClock(match[1]);
    if (!clock.valid) return { valid: false, reason: 'invalid' };
    const dateObj = addDays(now, 1);
    return buildResult(dateObj, clock.time);
  }

  // 2. "today [time]"
  match = input.match(/^today(?:\s+(.+))?$/i);
  if (match) {
    const clock = parseClock(match[1]);
    if (!clock.valid) return { valid: false, reason: 'invalid' };
    return buildResult(now, clock.time);
  }

  // 3. "[in] X days/weeks [time]" e.g., "3 days", "3d", "3day", "in 2 weeks 2pm"
  match = input.match(/^(?:in\s+)?(\d+)\s*(d|day|days|w|week|weeks)(?:\s+(.+))?$/i);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const days = unit.startsWith('w') ? amount * 7 : amount;
    const clock = parseClock(match[3]);
    if (!clock.valid) return { valid: false, reason: 'invalid' };
    const dateObj = addDays(now, days);
    return buildResult(dateObj, clock.time);
  }

  // 4. "Xh / X hours" e.g., "24h", "48 hours"
  match = input.match(/^(\d+)\s*(h|hr|hrs|hour|hours)$/i);
  if (match) {
    const hoursCount = Number(match[1]);
    const dateObj = addHours(now, hoursCount);
    const timeStr = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
    return buildResult(dateObj, timeStr);
  }

  // 5. "YYYY-MM-DD [time]" e.g. "2026-07-25 14:00"
  match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(.+))?$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const dateObj = new Date(year, month - 1, day);
    const validDate = dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day;
    const clock = parseClock(match[4]);
    if (!validDate || !clock.valid) return { valid: false, reason: 'invalid' };
    return buildResult(dateObj, clock.time);
  }

  // 6. Absolute Month & Day (with optional Year and optional Time)
  // e.g. "26 June 2027", "28thjuly2026", "27 july 26", "Jul 27 2026", "25 Jul 2pm"
  const monthNames: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  // Pattern A: Day Month [Year] [Time] e.g., "26 June 2027", "28 july 2026", "27 july 26"
  let dayNum: number | null = null;
  let monthName: string | null = null;
  let yearNum: number | null = null;
  let clockText: string | undefined = undefined;

  const matchDayMonth = input.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{2,4}))?(?:\s+(.+))?$/i);
  if (matchDayMonth && matchDayMonth[2].toLowerCase() in monthNames) {
    dayNum = Number(matchDayMonth[1]);
    monthName = matchDayMonth[2].toLowerCase();
    if (matchDayMonth[3]) {
      const parsedY = Number(matchDayMonth[3]);
      yearNum = parsedY < 100 ? 2000 + parsedY : parsedY;
    }
    clockText = matchDayMonth[4];
  } else {
    // Pattern B: Month Day [Year] [Time] e.g., "June 26 2027", "july 28 2026", "Jul 27 26"
    const matchMonthDay = input.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{2,4}))?(?:\s+(.+))?$/i);
    if (matchMonthDay && matchMonthDay[1].toLowerCase() in monthNames) {
      monthName = matchMonthDay[1].toLowerCase();
      dayNum = Number(matchMonthDay[2]);
      if (matchMonthDay[3]) {
        const parsedY = Number(matchMonthDay[3]);
        yearNum = parsedY < 100 ? 2000 + parsedY : parsedY;
      }
      clockText = matchMonthDay[4];
    }
  }

  if (dayNum !== null && monthName !== null && monthName in monthNames) {
    const month = monthNames[monthName];
    const day = dayNum;
    let year = yearNum !== null ? yearNum : now.getFullYear();

    let dateObj = new Date(year, month, day);
    if (dateObj.getMonth() !== month || dateObj.getDate() !== day) {
      return { valid: false, reason: 'invalid' };
    }

    if (yearNum === null) {
      const todayNoTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dateObj < todayNoTime) {
        year += 1;
        dateObj = new Date(year, month, day);
      }
    }

    const clock = parseClock(clockText);
    if (!clock.valid) return { valid: false, reason: 'invalid' };
    return buildResult(dateObj, clock.time);
  }

  return { valid: false, reason: 'invalid' };
}
