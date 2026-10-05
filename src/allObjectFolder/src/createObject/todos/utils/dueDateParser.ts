import { format, addDays, addHours } from 'date-fns';
export type DueDateValue = {
    date: string; // YYYY-MM-DD local calendar date
    time: string | null; // HH:mm or null for "Any time"
    timezone: string; // IANA timezone
};
export type ParsedDueDateType = 'absolute-date-time' | 'relative-days' | 'today' | 'tomorrow' | 'weekday' | 'relative-minutes' | 'time-only' | null;
export type ParsedDueDate = {
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
} | {
    valid: false;
    reason: 'empty' | 'incomplete' | 'invalid' | 'past';
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
    if (!timeStr)
        return 'Any time';
    const [hh, mm] = timeStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm))
        return 'Any time';
    const sample = new Date(2000, 0, 1, hh, mm);
    return format(sample, 'h:mm a');
}
export function parseClock(text: string | undefined): {
    valid: boolean;
    time: string | null;
    explicit: boolean;
} {
    if (!text || !text.trim())
        return { valid: true, time: null, explicit: false };
    const cleaned = text.trim().replace(/^at\s+/i, '');
    if (/^noon$/i.test(cleaned))
        return { valid: true, time: '12:00', explicit: true };
    if (/^(?:midnight|12\s*am)$/i.test(cleaned))
        return { valid: true, time: '00:00', explicit: true };
    const militaryTimeMatch = cleaned.match(/^(\d{3,4})$/);
    if (militaryTimeMatch) {
        const digits = militaryTimeMatch[1].padStart(4, '0');
        const hour = Number(digits.slice(0, 2));
        const minute = Number(digits.slice(2));
        if (hour <= 23 && minute <= 59) {
            return { valid: true, time: `${pad(hour)}:${pad(minute)}`, explicit: true };
        }
    }
    const match = cleaned.match(/^(\d{1,2})(?:(?::|\s+)(\d{2}))?\s*(am|pm)?$/i);
    const compactMeridiemMatch = cleaned.match(/^(\d{1,2})(\d{2})\s*(am|pm)$/i);
    const resolvedMatch = match || compactMeridiemMatch;
    if (!resolvedMatch)
        return { valid: false, time: null, explicit: false };
    let hour = Number(resolvedMatch[1]);
    const minute = Number(resolvedMatch[2] || 0);
    const meridiem = resolvedMatch[3] ? resolvedMatch[3].toLowerCase() : null;
    if (minute > 59)
        return { valid: false, time: null, explicit: false };
    if (meridiem) {
        if (hour < 1 || hour > 12)
            return { valid: false, time: null, explicit: false };
        if (meridiem === 'pm' && hour !== 12)
            hour += 12;
        if (meridiem === 'am' && hour === 12)
            hour = 0;
    }
    else {
        if (hour > 23)
            return { valid: false, time: null, explicit: false };
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
export function resolveWeekdayDate(targetWeekday: number, // 0 = Sun, 1 = Mon, ..., 6 = Sat
explicitTime: {
    hours: number;
    minutes: number;
} | null, now: Date): Date {
    const currentDay = now.getDay(); // 0 = Sun, ..., 6 = Sat
    let daysUntilTarget = (targetWeekday - currentDay + 7) % 7;
    if (daysUntilTarget === 0) {
        if (!explicitTime) {
            // Date-only same weekday: always select the next future occurrence (+7 days)
            daysUntilTarget = 7;
        }
        else {
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
    }
    else {
        result.setHours(0, 0, 0, 0);
    }
    return result;
}
const monthNames: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
    dec: 11, december: 11,
};
const isValidDateParts = (year: number, month: number, day: number): boolean => {
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
};
const addMonthsClamped = (date: Date, count: number) => {
    const result = new Date(date);
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + count);
    result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
    return result;
};
const addYearsClamped = (date: Date, count: number) => {
    const result = new Date(date);
    const month = result.getMonth();
    const day = result.getDate();
    result.setDate(1);
    result.setFullYear(result.getFullYear() + count);
    result.setMonth(month);
    result.setDate(Math.min(day, new Date(result.getFullYear(), month + 1, 0).getDate()));
    return result;
};
const addBusinessDays = (date: Date, count: number) => {
    const result = new Date(date);
    let remaining = count;
    while (remaining > 0) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6)
            remaining -= 1;
    }
    return result;
};
const extractClockPhrase = (text: string): {
    remaining: string;
    time: string;
} | null => {
    const clock = '(?:noon|midnight|\\d{1,2}(?::\\d{2}|\\s+\\d{2})\\s*(?:am|pm)?|\\d{1,2}\\s*(?:am|pm)|\\d{3,4}\\s*(?:am|pm)|\\d{3,4})';
    const atHour = text.match(/^at\s+(\d{1,2})\s+(.+)$/i);
    if (atHour) {
        const parsed = parseClock(atHour[1]);
        if (parsed.valid && parsed.time)
            return { remaining: atHour[2], time: parsed.time };
    }
    const trailingAtHour = text.match(/^(.+?)\s+at\s+(\d{1,2})$/i);
    if (trailingAtHour) {
        const parsed = parseClock(trailingAtHour[2]);
        if (parsed.valid && parsed.time) {
            let [hour, minute] = parsed.time.split(':').map(Number);
            if (/\b(?:night|tonight|evening)\b/i.test(trailingAtHour[1]) && hour < 12)
                hour += 12;
            if (/\bafternoon\b/i.test(trailingAtHour[1]) && hour < 12)
                hour += 12;
            if (/\b(?:morning)\b/i.test(trailingAtHour[1]) && hour === 0)
                hour = 9;
            return { remaining: trailingAtHour[1], time: `${pad(hour)}:${pad(minute)}` };
        }
    }
    const leading = text.match(new RegExp(`^(?:at\\s+)?(${clock})\\s+(.+)$`, 'i'));
    if (leading && !/^(?:19|20)\d{2}$/.test(leading[1].trim())) {
        const parsed = parseClock(leading[1]);
        if (parsed.valid && parsed.time)
            return { remaining: leading[2], time: parsed.time };
    }
    const trailing = text.match(new RegExp(`^(.+?)\\s+(?:at\\s+)?(${clock})$`, 'i'));
    if (trailing) {
        if (/^(?:19|20)\d{2}$/.test(trailing[2].trim()))
            return null;
        const parsed = parseClock(trailing[2]);
        if (parsed.valid && parsed.time)
            return { remaining: trailing[1], time: parsed.time };
    }
    return null;
};
export function parseDueDateInput(inputRaw: string, options?: {
    now?: Date;
    timezone?: string;
    locale?: string;
}): ParsedDueDate {
    const now = options?.now || new Date();
    const timezone = options?.timezone || (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Asia/Kolkata';
    const locale = options?.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-GB');
    const cleanedRaw = inputRaw.trim();
    if (!cleanedRaw)
        return { valid: false, reason: 'empty' };
    // Convert word numbers (two -> 2, etc.) and normalize spaces
    const cleaned = cleanedRaw.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, m => numberWords[m.toLowerCase()] || m);
    const input = cleaned
        .replace(/\bhalf an hour\b/gi, '30 minutes')
        .replace(/\b(?:tomorow|tomorroww|tormorrw|tormorrow|tommorow|tomoroww)\b/gi, 'tomorrow')
        .replace(/\b(?:tmrw|tmr|trw|tomo)\b/gi, 'tomorrow')
        .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
        .replace(/,/g, ' ')
        .replace(/(\d+)([a-z]+)/gi, '$1 $2 ')
        .replace(/([a-z]+)(\d+)/gi, '$1 $2 ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!input)
        return { valid: false, reason: 'empty' };
    function buildResult(dateObj: Date, timeStr: string | null, type: ParsedDueDateType, customLabels?: {
        label: string;
        secondaryLabel: string | null;
    }): ParsedDueDate {
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        if (timeStr) {
            const [targetHour, targetMinute] = timeStr.split(':').map(Number);
            const targetDateTime = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), targetHour, targetMinute, 0, 0);
            if (targetDateTime.getTime() <= now.getTime()) {
                return { valid: false, reason: 'past' };
            }
        }
        else if (targetDate.getTime() < todayDate.getTime()) {
            return { valid: false, reason: 'past' };
        }
        const formattedDate = displayDateFormatted(dateObj, locale);
        const formattedTime = displayTimeFormatted(timeStr, locale);
        const hasExplicitTime = timeStr !== null;
        let defaultLabel = formattedDate;
        let defaultSecondary: string | null = hasExplicitTime ? formattedTime : 'Any time';
        // Compute relative labels if not provided
        if (!customLabels) {
            const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
                if (hasExplicitTime) {
                    defaultLabel = formattedDate;
                    defaultSecondary = formattedTime;
                }
                else {
                    defaultLabel = 'Today';
                    defaultSecondary = formattedDate;
                }
            }
            else if (diffDays === 1) {
                if (hasExplicitTime) {
                    defaultLabel = 'Tomorrow';
                    defaultSecondary = formattedTime;
                }
                else {
                    defaultLabel = 'Tomorrow';
                    defaultSecondary = formattedDate;
                }
            }
            else if (diffDays === 7) {
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
    // Pick an explicit clock out of either side of the date phrase, so both
    // “Thursday 5 PM” and “5 PM Thursday” resolve through the same path.
    const clockPhrase = extractClockPhrase(input);
    let naturalInput = clockPhrase ? clockPhrase.remaining : input;
    let explicitTime = clockPhrase?.time;
    const monthTimeDay = input.match(/^([a-z]+)\s+(\d{1,2})\s*(am|pm)\s+(\d{1,2})$/i);
    if (monthTimeDay && monthTimeDay[1].toLowerCase() in monthNames) {
        const parsedClock = parseClock(`${monthTimeDay[2]} ${monthTimeDay[3]}`);
        if (parsedClock.valid && parsedClock.time) {
            naturalInput = `${monthTimeDay[1]} ${monthTimeDay[4]}`.toLowerCase();
            explicitTime = parsedClock.time;
        }
    }
    const timeTonight = input.match(/^(\d{1,2})\s+tonight$/i);
    if (timeTonight) {
        const hour = Number(timeTonight[1]);
        if (hour < 1 || hour > 12)
            return { valid: false, reason: 'invalid' };
        naturalInput = 'today';
        explicitTime = `${pad(hour === 12 ? 0 : hour + 12)}:00`;
    }
    naturalInput = naturalInput.toLowerCase();
    let dayPartTime: string | null = null;
    const dayPartPatterns: Array<[
        RegExp,
        string
    ]> = [
        [/\b(?:end of day|eod)\b/i, '23:59'],
        [/\bafter work\b/i, '17:00'],
        [/\b(?:before lunch)\b/i, '11:30'],
        [/\b(?:noon|lunchtime)\b/i, '12:00'],
        [/\b(?:midnight)\b/i, '00:00'],
        [/\b(?:morning)\b/i, '09:00'],
        [/\b(?:afternoon)\b/i, '15:00'],
        [/\b(?:evening)\b/i, '18:00'],
        [/\b(?:tonight|night)\b/i, '20:00']
    ];
    for (const [pattern, time] of dayPartPatterns) {
        if (pattern.test(naturalInput)) {
            dayPartTime = time;
            naturalInput = naturalInput.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
            break;
        }
    }
    if (naturalInput === 'this' || naturalInput === 'by' || naturalInput === 'by today')
        naturalInput = 'today';
    if (!naturalInput && dayPartTime)
        naturalInput = 'today';
    const selectedTime = explicitTime || dayPartTime;
    // Named calendar boundaries and colloquial day names.
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (/^(?:the\s+)?day after tomorrow$/.test(naturalInput)) {
        return buildResult(addDays(today, 2), selectedTime, 'relative-days');
    }
    if (/^(?:by\s+)?(?:end of day|eod)$/.test(naturalInput)) {
        return buildResult(today, selectedTime || '17:00', 'today');
    }
    if (/^(?:this\s+)?weekend$/.test(naturalInput) || /^next weekend$/.test(naturalInput)) {
        const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
        const offset = naturalInput.startsWith('next') ? daysUntilSaturday + 7 : daysUntilSaturday;
        return buildResult(addDays(today, offset), selectedTime, 'relative-days');
    }
    const nextMonthOffset = /\bnext month\b/.test(naturalInput) ? 1 : 0;
    if (/^(?:the\s+)?first day of (?:next|this) month$/.test(naturalInput)) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() + nextMonthOffset, 1);
        return buildResult(monthStart, selectedTime, 'absolute-date-time');
    }
    if (/^(?:the\s+)?last day of (?:next|this) month$/.test(naturalInput)) {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + nextMonthOffset + 1, 0);
        return buildResult(monthEnd, selectedTime, 'absolute-date-time');
    }
    const nextMonthDay = naturalInput.match(/^next month on the (\d{1,2})(?:st|nd|rd|th)?$/);
    if (nextMonthDay) {
        const date = new Date(now.getFullYear(), now.getMonth() + 1, Number(nextMonthDay[1]));
        if (date.getDate() !== Number(nextMonthDay[1]))
            return { valid: false, reason: 'invalid' };
        return buildResult(date, selectedTime, 'absolute-date-time');
    }
    const firstWeekdayNextMonth = naturalInput.match(/^the first ([a-z]+) of next month$/);
    if (firstWeekdayNextMonth && firstWeekdayNextMonth[1] in weekdayMap) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const offset = (weekdayMap[firstWeekdayNextMonth[1]] - monthStart.getDay() + 7) % 7;
        return buildResult(addDays(monthStart, offset), selectedTime, 'absolute-date-time');
    }
    // Parse numeric dates explicitly. Ambiguous slash/dot dates follow the
    // user's locale (en-US is month/day; other locales default to day/month).
    const numericDate = naturalInput.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/);
    if (numericDate) {
        const [first, second, third] = numericDate.slice(1).map(Number);
        let year: number;
        let month: number;
        let day: number;
        if (numericDate[1].length === 4) {
            [year, month, day] = [first, second, third];
        }
        else {
            year = third < 100 ? (third >= 50 ? 1900 + third : 2000 + third) : third;
            const monthFirst = first <= 12 && second <= 12 ? /^en-US/i.test(locale) : first <= 12;
            [month, day] = monthFirst ? [first, second] : [second, first];
        }
        if (month < 1 || month > 12 || !isValidDateParts(year, month - 1, day)) {
            return { valid: false, reason: 'invalid' };
        }
        return buildResult(new Date(year, month - 1, day), selectedTime, 'absolute-date-time');
    }
    const monthNextYear = naturalInput.match(/^([a-z]+)\s+(\d{1,2})\s+next year$/i);
    const yearMonthDay = naturalInput.match(/^(\d{4})\s+([a-z]+)\s+(\d{1,2})$/i);
    const monthDayYear = naturalInput.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{2,4})$/i);
    const dayMonthYear = naturalInput.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/i);
    const monthDay = naturalInput.match(/^([a-z]+)\s+(\d{1,2})$/i);
    let absoluteYear: number | null = null;
    let absoluteMonth: number | null = null;
    let absoluteDay: number | null = null;
    if (monthNextYear && monthNextYear[1] in monthNames) {
        absoluteMonth = monthNames[monthNextYear[1]];
        absoluteDay = Number(monthNextYear[2]);
        absoluteYear = now.getFullYear() + 1;
    }
    else if (yearMonthDay && yearMonthDay[2].toLowerCase() in monthNames) {
        absoluteYear = Number(yearMonthDay[1]);
        absoluteMonth = monthNames[yearMonthDay[2].toLowerCase()];
        absoluteDay = Number(yearMonthDay[3]);
    }
    else if (monthDayYear && monthDayYear[1].toLowerCase() in monthNames) {
        absoluteMonth = monthNames[monthDayYear[1].toLowerCase()];
        absoluteDay = Number(monthDayYear[2]);
        absoluteYear = Number(monthDayYear[3]);
        if (absoluteYear < 100)
            absoluteYear += absoluteYear < 50 ? 2000 : 1900;
    }
    else if (dayMonthYear && dayMonthYear[2].toLowerCase() in monthNames) {
        absoluteDay = Number(dayMonthYear[1]);
        absoluteMonth = monthNames[dayMonthYear[2].toLowerCase()];
        absoluteYear = Number(dayMonthYear[3]);
        if (absoluteYear < 100)
            absoluteYear += absoluteYear < 50 ? 2000 : 1900;
    }
    else if (monthDay && monthDay[1].toLowerCase() in monthNames) {
        absoluteMonth = monthNames[monthDay[1].toLowerCase()];
        absoluteDay = Number(monthDay[2]);
    }
    if (absoluteMonth !== null && absoluteDay !== null) {
        let year = absoluteYear ?? now.getFullYear();
        if (!isValidDateParts(year, absoluteMonth, absoluteDay))
            return { valid: false, reason: 'invalid' };
        let date = new Date(year, absoluteMonth, absoluteDay);
        if (absoluteYear === null && date < today) {
            year += 1;
            date = new Date(year, absoluteMonth, absoluteDay);
        }
        return buildResult(date, selectedTime, 'absolute-date-time');
    }
    // Relative durations, including mixed units and business days.
    const durationText = naturalInput
        .replace(/^(?:in|after)\s+/i, '')
        .replace(/\s+(?:from now|later)$/i, '')
        .trim();
    const durationPattern = /(\d+)\s*(business\s*days?|working\s*days?|minutes?|mins?|hours?|hrs?|weeks?|days?|months?|years?|m|h|w|d)\b/gi;
    const durationMatches = [...durationText.matchAll(durationPattern)];
    if (durationMatches.length) {
        const residue = durationText.replace(durationPattern, '').replace(/\band\b/gi, '').replace(/[\s,]+/g, '');
        if (!residue) {
            let due = new Date(now);
            let hasClockUnit = false;
            for (const duration of durationMatches) {
                const amount = Number(duration[1]);
                const unit = duration[2].toLowerCase().replace(/\s+/g, '');
                if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10000)
                    return { valid: false, reason: 'invalid' };
                if (unit.startsWith('business') || unit.startsWith('working')) {
                    due = addBusinessDays(due, amount);
                }
                else if (unit === 'm' || unit.startsWith('min')) {
                    due = new Date(due.getTime() + amount * 60000);
                    hasClockUnit = true;
                }
                else if (unit === 'h' || unit.startsWith('hr') || unit.startsWith('hour')) {
                    due = new Date(due.getTime() + amount * 3600000);
                    hasClockUnit = true;
                }
                else if (unit === 'd' || unit.startsWith('day')) {
                    due.setDate(due.getDate() + amount);
                }
                else if (unit === 'w' || unit.startsWith('week')) {
                    due.setDate(due.getDate() + amount * 7);
                }
                else if (unit.startsWith('month')) {
                    due = addMonthsClamped(due, amount);
                }
                else if (unit.startsWith('year')) {
                    due = addYearsClamped(due, amount);
                }
            }
            if (selectedTime) {
                const [hour, minute] = selectedTime.split(':').map(Number);
                due.setHours(hour, minute, 0, 0);
                hasClockUnit = true;
            }
            const resultTime = hasClockUnit ? `${pad(due.getHours())}:${pad(due.getMinutes())}` : null;
            return buildResult(due, resultTime, hasClockUnit ? 'relative-minutes' : 'relative-days');
        }
    }
    // Weekday names can be written before or after the time. “Next” means the
    // next occurrence; “this” allows today when the named weekday is today.
    const weekdayExpression = naturalInput.match(/^(?:(next|this)\s+)?([a-z]+)$/i);
    if (weekdayExpression && weekdayExpression[2].toLowerCase() in weekdayMap) {
        const modifier = weekdayExpression[1]?.toLowerCase();
        const targetDay = weekdayMap[weekdayExpression[2].toLowerCase()];
        let offset = (targetDay - now.getDay() + 7) % 7;
        if (offset === 0 && (modifier === 'next' || (!modifier && !selectedTime)))
            offset = 7;
        const date = addDays(today, offset);
        if (selectedTime) {
            const [hour, minute] = selectedTime.split(':').map(Number);
            date.setHours(hour, minute, 0, 0);
        }
        return buildResult(date, selectedTime, 'weekday');
    }
    // Relative dayparts, e.g. “tomorrow evening” and “tomorrow before lunch”.
    const dayReference = naturalInput.match(/^(today|tomorrow)$/i);
    if (dayReference) {
        const date = dayReference[1].toLowerCase() === 'tomorrow' ? addDays(today, 1) : today;
        if (selectedTime) {
            const [hour, minute] = selectedTime.split(':').map(Number);
            date.setHours(hour, minute, 0, 0);
        }
        return buildResult(date, selectedTime, dayReference[1].toLowerCase() === 'today' ? 'today' : 'tomorrow');
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
        if (!validDate || !clock.valid)
            return { valid: false, reason: 'invalid' };
        return buildResult(dateObj, clock.time, 'absolute-date-time');
    }
    // 1B. Absolute Month & Day e.g., "26 June 2026 2:00 PM", "June 26 2026 2pm"
    let dayNum: number | null = null;
    let monthName: string | null = null;
    let yearNum: number | null = null;
    let clockText: string | undefined = undefined;
    const matchYearMonthDay = input.match(/^(\d{4})\s+([a-z]+)\s+(\d{1,2})(?:\s+(.+))?$/i);
    if (matchYearMonthDay && matchYearMonthDay[2].toLowerCase() in monthNames) {
        yearNum = Number(matchYearMonthDay[1]);
        monthName = matchYearMonthDay[2].toLowerCase();
        dayNum = Number(matchYearMonthDay[3]);
        clockText = matchYearMonthDay[4];
    }
    const matchDayMonth = input.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{2,4}))?(?:\s+(.+))?$/i);
    if (dayNum === null && matchDayMonth && matchDayMonth[2].toLowerCase() in monthNames) {
        dayNum = Number(matchDayMonth[1]);
        monthName = matchDayMonth[2].toLowerCase();
        if (matchDayMonth[3]) {
            const parsedY = Number(matchDayMonth[3]);
            yearNum = parsedY < 100 ? 2000 + parsedY : parsedY;
        }
        clockText = matchDayMonth[4];
    }
    else {
        const matchMonthDay = input.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{2,4}))?(?:\s+(.+))?$/i);
        if (dayNum === null && matchMonthDay && matchMonthDay[1].toLowerCase() in monthNames) {
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
        if (!clock.valid)
            return { valid: false, reason: 'invalid' };
        return buildResult(dateObj, clock.time, 'absolute-date-time');
    }
    // ----------------------------------------------------
    // PRECEDENCE 2: Existing Relative Calendar-Day Expressions
    // e.g. "2 days 2:00 PM", "in 3 days", "4 days 1:00 PM", "24h"
    // ----------------------------------------------------
    match = input.match(/^(?:in\s+)?(\d+)\s*(d|day|days|w|week|weeks)(?:\s+from\s+now)?(?:\s+(.+))?$/i);
    if (match) {
        const amount = Number(match[1]);
        if (!Number.isInteger(amount) || amount <= 0)
            return { valid: false, reason: 'invalid' };
        const unit = match[2].toLowerCase();
        const days = unit.startsWith('w') ? amount * 7 : amount;
        const clock = parseClock(match[3]);
        if (!clock.valid)
            return { valid: false, reason: 'invalid' };
        const dateObj = addDays(now, days);
        return buildResult(dateObj, clock.time, 'relative-days');
    }
    match = input.match(/^(?:in\s+)?(\d+)\s*(h|hr|hrs|hour|hours)(?:\s+from\s+now)?$/i);
    if (match) {
        const hoursCount = Number(match[1]);
        if (!Number.isInteger(hoursCount) || hoursCount <= 0)
            return { valid: false, reason: 'invalid' };
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
        if (!clock.valid)
            return { valid: false, reason: 'invalid' };
        const dateObj = addDays(now, 1);
        return buildResult(dateObj, clock.time, 'tomorrow');
    }
    match = input.match(/^today(?:\s+(.+))?$/i);
    if (match) {
        const clock = parseClock(match[1]);
        if (!clock.valid)
            return { valid: false, reason: 'invalid' };
        if (clock.time) {
            const [h, m] = clock.time.split(':').map(Number);
            const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            if (targetTime.getTime() < now.getTime()) {
                // Requested time has passed today -> past-time validation
                return { valid: false, reason: 'past' };
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
            if (!clock.valid)
                return { valid: false, reason: 'invalid' };
            let explicitTime: {
                hours: number;
                minutes: number;
            } | null = null;
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
            const formattedTime = displayTimeFormatted(clock.time, locale);
            const hasExplicitTime = clock.time !== null;
            if (diffDays === 0) {
                label = formattedDate; // e.g., "Thu, 30 Jul"
                secondaryLabel = hasExplicitTime ? formattedTime : 'Today';
            }
            else if (diffDays === 1) {
                label = 'Tomorrow';
                secondaryLabel = hasExplicitTime ? formattedTime : formattedDate; // e.g., "3:00 PM" or "Fri, 31 Jul"
            }
            else if (diffDays === 7) {
                label = 'In one week';
                secondaryLabel = hasExplicitTime ? formattedTime : formattedDate; // e.g., "3:00 PM" or "Thu, 6 Aug"
            }
            else {
                label = formattedDate;
                secondaryLabel = hasExplicitTime ? formattedTime : null;
            }
            return buildResult(dateObj, clock.time, 'weekday', { label, secondaryLabel });
        }
    }
    // ----------------------------------------------------
    // PRECEDENCE 5: Relative-Minute Expression
    // e.g. "1 minute", "43 minutes", "in 10 minutes", "after 3 mins", "43m"
    // ----------------------------------------------------
    const minutePatterns = [
        /^(?:in\s+)?(\d+)\s*(?:minute|minutes|min|mins)(?:\s+from\s+now)?$/i,
        /^after\s+(\d+)\s*(?:minute|minutes|min|mins)$/i,
        /^(\d+)\s*m$/i
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
            }
            else if (diffDays === 1) {
                secondaryLabel = `Tomorrow at ${formattedTime}`;
            }
            else {
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
export function isPastDueDateInput(inputRaw: string, now: Date = new Date()): boolean {
    const input = inputRaw
        .trim()
        .replace(/\b(?:tmrw|tmr|trw|tomo)\b/gi, 'tomorrow')
        .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
        .replace(/(\d+)([a-z]+)/gi, '$1 $2 ')
        .replace(/([a-z]+)(\d+)/gi, '$1 $2 ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!input)
        return false;
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
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const yearOnlyMatch = input.match(/^(\d{4})$/);
    if (yearOnlyMatch) {
        return Number(yearOnlyMatch[1]) < currentYear;
    }
    const monthYearMatch = input.match(/^([a-z]+)\s+(\d{4})$/i) ||
        input.match(/^(\d{4})\s+([a-z]+)$/i);
    if (monthYearMatch) {
        const first = monthYearMatch[1].toLowerCase();
        const second = monthYearMatch[2].toLowerCase();
        const monthName = first in monthNames ? first : second;
        const yearText = first in monthNames ? second : first;
        const year = Number(yearText);
        if (Number.isFinite(year) && monthName in monthNames) {
            return year < currentYear || (year === currentYear && monthNames[monthName] < currentMonth);
        }
    }
    const numericMonthYearMatch = input.match(/^(\d{1,2})[/-](\d{4})$/) ||
        input.match(/^(\d{4})[/-](\d{1,2})$/);
    if (numericMonthYearMatch) {
        const first = Number(numericMonthYearMatch[1]);
        const second = Number(numericMonthYearMatch[2]);
        const year = numericMonthYearMatch[1].length === 4 ? first : second;
        const month = numericMonthYearMatch[1].length === 4 ? second : first;
        if (month >= 1 && month <= 12) {
            return year < currentYear || (year === currentYear && month - 1 < currentMonth);
        }
    }
    const parsed = parseDueDateInput(inputRaw, { now });
    return !parsed.valid && parsed.reason === 'past';
}
