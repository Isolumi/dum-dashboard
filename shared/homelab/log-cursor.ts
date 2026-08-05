const RFC3339_CURSOR =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/;
const MAX_CURSOR_LENGTH = 35;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidCalendarTimestamp(match: RegExpExecArray): boolean {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1]! &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

export function normalizePodLogCursor(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_CURSOR_LENGTH) {
    return null;
  }
  const match = RFC3339_CURSOR.exec(value);
  if (!match || !isValidCalendarTimestamp(match) || !Number.isFinite(Date.parse(value)))
    return null;
  return value;
}

export function podLogCursorFromLine(line: string): string | null {
  const separator = line.search(/\s/);
  const candidate = separator === -1 ? line : line.slice(0, separator);
  return normalizePodLogCursor(candidate);
}
