import * as chrono from 'chrono-node';

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeText(text: string): string {
  const fixes: Array<[RegExp, string]> = [
    [/\btomm?o?r+o?w\b/gi, 'tomorrow'],
    [/\bday\s*after\s*tomorrow\b/gi, 'day after tomorrow'],
    [/\bdayafter\s*tomorrow\b/gi, 'day after tomorrow'],
  ];
  let result = text;
  for (const [pattern, replacement] of fixes) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function getNextWeekday(targetDow: number, from: Date): Date {
  const result = new Date(from);
  const todayDow = result.getDay();
  let diff = (targetDow - todayDow + 7) % 7;
  // If target is today, schedule for next week (very next Friday, etc.)
  if (diff === 0) diff = 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function setTime(base: Date, timeSource: Date): Date {
  const dt = new Date(base);
  dt.setHours(timeSource.getHours(), timeSource.getMinutes(), timeSource.getSeconds(), timeSource.getMilliseconds());
  return dt;
}

function formatDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function createEventUrlFromText(text: string, now: Date = new Date()): { url: string } | { error: string } {
  const original = text.trim();
  const normalized = normalizeText(original);

  const parsed = chrono.parse(normalized, now)[0];
  if (!parsed) return { error: "Couldn't understand the date/time" };

  // Extract title by removing parsed span and common connectors
  const titleRaw = original
    .replace(parsed.text, '')
    .replace(/\b(on|at|by|for)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const title = titleRaw.length > 0 ? titleRaw : 'Event';

  const lower = normalized.toLowerCase();
  const hasTomorrow = /\btomorrow\b/.test(lower);
  const hasDayAfter = /\bday\s*after\s*tomorrow\b/.test(lower);
  const weekdayMatch = lower.match(
    /\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/,
  );

  // Base dates from Chrono (time likely correct even when date isn't)
  let start = parsed.start.date();
  let end = parsed.end ? parsed.end.date() : new Date(start.getTime() + 60 * 60 * 1000);

  // Adjust date based on relative keywords if Chrono didn't apply them
  if (hasDayAfter) {
    const base = new Date(now);
    base.setDate(base.getDate() + 2);
    start = setTime(base, start);
    if (parsed.end) end = setTime(new Date(base), end);
  } else if (hasTomorrow) {
    const base = new Date(now);
    base.setDate(base.getDate() + 1);
    start = setTime(base, start);
    if (parsed.end) end = setTime(new Date(base), end);
  } else if (weekdayMatch) {
    const word = weekdayMatch[0];
    let key = word;
    if (key.startsWith('tues')) key = 'tuesday';
    if (key.startsWith('thu')) key = 'thursday';
    if (key.startsWith('sat')) key = 'saturday';
    if (key.startsWith('sun')) key = 'sunday';
    if (key.startsWith('mon')) key = 'monday';
    if (key.startsWith('wed')) key = 'wednesday';
    if (key.startsWith('fri')) key = 'friday';
    const targetDow = WEEKDAYS[key];
    if (typeof targetDow === 'number') {
      const base = getNextWeekday(targetDow, now);
      start = setTime(base, start);
      if (parsed.end) end = setTime(new Date(base), end);
    }
  }

  // Validate future-only
  if (start.getTime() <= now.getTime()) {
    return { error: "Can't schedule for past dates" };
  }

  const url =
    'https://calendar.google.com/calendar/render?' +
    `action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDate(start)}/${formatDate(end)}`;
  return { url };
}
