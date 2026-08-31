import { format, addDays, addHours } from 'date-fns';

export type DueDateValue = {
  date: string; // YYYY-MM-DD local calendar date
  time: string | null; // HH:mm or null for "Any time"
  timezone: string; // IANA timezone
};

export type ParsedDueDateType =
  | 'absolute-date-time'
  | 'relative-days'
  | 'today'
  | 'tomorrow'
  | 'weekday'
  | 'relative-minutes'
  | 'time-only'
  | null;

export type ParsedDueDate =
  | {
      valid: true;
      type: ParsedDueDateType;
      value: DueDateValue;
      displayDate: string;
      displayTime: string;
      label: string;
      secondaryLabel: string | null;
      originalInput: string;
      hasExplicitTime: boolean;
      isDateOnly: boolean;
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

export function displayDateFormatted(date: Date, _locale?: string): string {
  const showYear = date.getFullYear() !== new Date().getFullYear();
  return format(date, showYear ? 'EEE, d MMM yyyy' : 'EEE, d MMM');
}

export function displayTimeFormatted(timeStr: string | null, _locale?: string): string {
  if (!timeStr) return 'Any time';
  const [hh, mm] = timeStr.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return 'Any time';
  const sample = new Date(2000, 0, 1, hh, mm);
  return format(sample, 'h:mm a');
}

export function parseClock(text: string | undefined): { valid: boolean; time: string | null; explicit: boolean } {
  if (!text || !text.trim()) return { valid: true, time: null, explicit: false };
  const cleaned = text.trim().replace(/^at\s+/i, '');
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return { valid: false, time: null, explicit: false };

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3] ? match[3].toLowerCase() : null;

  if (minute > 59) return { valid: false, time: null, explicit: false };

  if (meridiem) {
    if (hour < 1 || hour > 12) return { valid: false, time: null, explicit: false };
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else {
    if (hour > 23) return { valid: false, time: null, explicit: false };
  }

  return { valid: true, time: `${pad(hour)}:${pad(minute)}`, explicit: true };
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

const weekdayMap: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

export function resolveWeekdayDate(
  targetWeekday: number, // 0 = Sun, 1 = Mon, ..., 6 = Sat
  explicitTime: { hours: number; minutes: number } | null,
  now: Date
): Date {
  const currentDay = now.getDay(); // 0 = Sun, ..., 6 = Sat
  let daysUntilTarget = (targetWeekday - currentDay + 7) % 7;

  if (daysUntilTarget === 0) {
    if (!explicitTime) {
      // Date-only same weekday: always select the next future occurrence (+7 days)
      daysUntilTarget = 7;
    } else {
      // With explicit time: check if requested time has already passed today
      const targetTimeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), explicitTime.hours, explicitTime.minutes, 0, 0);
      if (targetTimeDate.getTime() <= now.getTime()) {
        daysUntilTarget = 7;
      }
    }
  }

  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilTarget);
  if (explicitTime) {
    result.setHours(explicitTime.hours, explicitTime.minutes, 0, 0);
  } else {
    result.setHours(0, 0, 0, 0);
  }
  return result;
}

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
  const locale = options?.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-GB');

  const cleanedRaw = inputRaw.trim();
  if (!cleanedRaw) return { valid: false, reason: 'empty' };

  // Convert word numbers (two -> 2, etc.) and normalize spaces
  const cleaned = cleanedRaw.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, m => numberWords[m.toLowerCase()] || m);

  const input = cleaned
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .replace(/(\d+)([a-z]+)/gi, '$1 $2 ')
    .replace(/([a-z]+)(\d+)/gi, '$1 $2 ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!input) return { valid: false, reason: 'empty' };

  function buildResult(
    dateObj: Date,
    timeStr: string | null,
    type: ParsedDueDateType,
    customLabels?: { label: string; secondaryLabel: string | null }
  ): ParsedDueDate {
    const formattedDate = displayDateFormatted(dateObj, locale);
    const formattedTime = displayTimeFormatted(timeStr, locale);
    const hasExplicitTime = timeStr !== null;

    let defaultLabel = formattedDate;
    let defaultSecondary: string | null = hasExplicitTime ? formattedTime : 'Any time';

    // Compute relative labels if not provided
    if (!customLabels) {
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        if (hasExplicitTime) {
          defaultLabel = formattedDate;
          defaultSecondary = 'Today';
        } else {
          defaultLabel = 'Today';
          defaultSecondary = formattedDate;
        }
      } else if (diffDays === 1) {
        if (hasExplicitTime) {
          defaultLabel = 'Tomorrow';
          defaultSecondary = formattedDate;
        } else {
          defaultLabel = 'Tomorrow';
          defaultSecondary = formattedDate;
        }
      } else if (diffDays === 7) {
        defaultLabel = 'In one week';
        defaultSecondary = formattedDate;
      }
    }

    const finalLabel = customLabels ? customLabels.label : defaultLabel;
    const finalSecondaryLabel = customLabels ? customLabels.secondaryLabel : defaultSecondary;

    return {
      valid: true,
      type,
      value: {
        date: formatLocalISODate(dateObj),
        time: timeStr,
        timezone,
      },
      displayDate: formattedDate,
      displayTime: formattedTime,
      label: finalLabel,
      secondaryLabel: finalSecondaryLabel,
      originalInput: cleanedRaw,
      hasExplicitTime,
      isDateOnly: !hasExplicitTime,
    };
  }

  // ----------------------------------------------------
  // PRECEDENCE 1: Absolute Date with optional time
  // YYYY-MM-DD or Month/Day formats
  // ----------------------------------------------------

  // 1A. "YYYY-MM-DD [time]"
  let match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(.+))?$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const dateObj = new Date(year, month - 1, day);
    const validDate = dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day;
    const clock = parseClock(match[4]);
    if (!validDate || !clock.valid) return { valid: false, reason: 'invalid' };
    return buildResult(dateObj, clock.time, 'absolute-date-time');
  }

  // 1B. Absolute Month & Day e.g., "26 June 2026 2:00 PM", "June 26 2026 2pm"
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
    return buildResult(dateObj, clock.time, 'absolute-date-time');
  }

  // ----------------------------------------------------
  // PRECEDENCE 2: Existing Relative Calendar-Day Expressions
  // e.g. "2 days 2:00 PM", "in 3 days", "4 days 1:00 PM", "24h"
  // ----------------------------------------------------

  match = input.match(/^(?:in\s+)?(\d+)\s*(d|day|days|w|week|weeks)(?:\s+(.+))?$/i);
  if (match) {
    const amount = Number(match[1]);
    if (!Number.isInteger(amount) || amount <= 0) return { valid: false, reason: 'invalid' };
    const unit = match[2].toLowerCase();
    const days = unit.startsWith('w') ? amount * 7 : amount;
    const clock = parseClock(match[3]);
    if (!clock.valid) return { valid: false, reason: 'invalid' };
    const dateObj = addDays(now, days);
    return buildResult(dateObj, clock.time, 'relative-days');
  }

  match = input.match(/^(\d+)\s*(h|hr|hrs|hour|hours)$/i);
  if (match) {
    const hoursCount = Number(match[1]);
    if (!Number.isInteger(hoursCount) || hoursCount <= 0) return { valid: false, reason: 'invalid' };
    const dateObj = addHours(now, hoursCount);
    const timeStr = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
    return buildResult(dateObj, timeStr, 'relative-days');
  }

  // ----------------------------------------------------
  // PRECEDENCE 3: Today or Tomorrow with optional time
  // e.g. "today 3pm", "tomorrow 4:30pm"
  // ----------------------------------------------------

  match = input.match(/^tomorrow(?:\s+(.+))?$/i);
  if (match) {
    const clock = parseClock(match[1]);
    if (!clock.valid) return { valid: false, reason: 'invalid' };
    const dateObj = addDays(now, 1);
    return buildResult(dateObj, clock.time, 'tomorrow');
  }

  match = input.match(/^today(?:\s+(.+))?$/i);
  if (match) {
    const clock = parseClock(match[1]);
    if (!clock.valid) return { valid: false, reason: 'invalid' };
    if (clock.time) {
      const [h, m] = clock.time.split(':').map(Number);
      const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      if (targetTime.getTime() < now.getTime()) {
        // Requested time has passed today -> past-time validation
        return { valid: false, reason: 'invalid' };
      }
    }
    return buildResult(now, clock.time, 'today');
  }

  // ----------------------------------------------------
  // PRECEDENCE 4: Weekday Name with optional time
  // e.g. "thursday", "thursday 3pm", "friday at 10:30 AM"
  // ----------------------------------------------------

  const weekdayMatch = input.match(/^([a-z]+)(?:\s+(.+))?$/i);
  if (weekdayMatch) {
    const token = weekdayMatch[1].toLowerCase();
    if (token in weekdayMap) {
      const targetWkday = weekdayMap[token];
      const clockText = weekdayMatch[2];
      const clock = parseClock(clockText);
      if (!clock.valid) return { valid: false, reason: 'invalid' };

      let explicitTime: { hours: number; minutes: number } | null = null;
      if (clock.time) {
        const [h, m] = clock.time.split(':').map(Number);
        explicitTime = { hours: h, minutes: m };
      }

      const dateObj = resolveWeekdayDate(targetWkday, explicitTime, now);

      // Determine label layout
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

      let label: string;
      let secondaryLabel: string | null;

      const formattedDate = displayDateFormatted(dateObj, locale);

      if (diffDays === 0) {
        label = formattedDate; // e.g., "Thu, 30 Jul"
        secondaryLabel = 'Today';
      } else if (diffDays === 1) {
        label = 'Tomorrow';
        secondaryLabel = formattedDate; // e.g., "Fri, 31 Jul"
      } else if (diffDays === 7) {
        label = 'In one week';
        secondaryLabel = formattedDate; // e.g., "Thu, 6 Aug"
      } else {
        label = formattedDate;
        secondaryLabel = null;
      }

      return buildResult(dateObj, clock.time, 'weekday', { label, secondaryLabel });
    }
  }

  // ----------------------------------------------------
  // PRECEDENCE 5: Relative-Minute Expression
  // e.g. "1 minute", "43 minutes", "in 10 minutes", "after 3 mins", "43m"
  // ----------------------------------------------------

  const minutePatterns = [
    /^(?:in\s+)?(\d+)\s*(?:minute|minutes|min|mins)$/i,
    /^after\s+(\d+)\s*(?:minute|minutes|min|mins)$/i,
    /^(\d+)\s*m$/i,
  ];

  for (const pattern of minutePatterns) {
    const minMatch = input.match(pattern);
    if (minMatch) {
      const minutes = Number(minMatch[1]);
      if (!Number.isInteger(minutes) || minutes <= 0) {
        return { valid: false, reason: 'invalid' };
      }

      const dueDate = new Date(now.getTime() + minutes * 60 * 1000);
      const timeStr = `${pad(dueDate.getHours())}:${pad(dueDate.getMinutes())}`;

      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

      const formattedTime = displayTimeFormatted(timeStr, locale);
      const formattedDate = displayDateFormatted(dueDate, locale);

      const label = `In ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
      let secondaryLabel: string;

      if (diffDays === 0) {
        secondaryLabel = `Today at ${formattedTime}`;
      } else if (diffDays === 1) {
        secondaryLabel = `Tomorrow at ${formattedTime}`;
      } else {
        secondaryLabel = `${formattedDate} at ${formattedTime}`;
      }

      return buildResult(dueDate, timeStr, 'relative-minutes', { label, secondaryLabel });
    }
  }

  // ----------------------------------------------------
  // PRECEDENCE 6 & 7: Time-Only or other shortcuts
  // e.g. "3pm", "14:00"
  // ----------------------------------------------------
  const clock = parseClock(input);
  if (clock.valid && clock.time) {
    // If it's a valid time only, set for today if time is in future today
    const [h, m] = clock.time.split(':').map(Number);
    const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    let dateObj = now;
    if (targetTime.getTime() < now.getTime()) {
      // If time passed today, move to tomorrow or invalidate
      dateObj = addDays(now, 1);
    }
    return buildResult(dateObj, clock.time, 'time-only');
  }

  return { valid: false, reason: 'invalid' };
}
