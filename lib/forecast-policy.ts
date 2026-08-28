type Window = { start: string; end: string };

export function isDateInRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export function areWindowsDisjoint(left: Window, right: Window) {
  return left.end < right.start || right.end < left.start;
}

export function isCoverageWindowValid(dataStart: string | null, dataEnd: string | null, windowStart: string, windowEnd: string) {
  return Boolean(dataStart && dataEnd && dataStart <= windowStart && dataEnd >= windowEnd);
}
