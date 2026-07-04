import { formatInTimeZone } from "date-fns-tz";
import { subDays, parseISO, differenceInCalendarDays } from "date-fns";
import { TZ } from "./format";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve a {start, end} date range (yyyy-MM-dd, JST) from optional URL params.
 * Defaults to the current month (1st → today) when params are missing/invalid.
 */
export function resolveRange(from?: string, to?: string): { start: string; end: string } {
  const now = new Date();
  const today = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  const monthStart = formatInTimeZone(now, TZ, "yyyy-MM-01");

  let start = from && DATE_RE.test(from) ? from : monthStart;
  let end = to && DATE_RE.test(to) ? to : today;
  if (start > end) [start, end] = [end, start];
  return { start, end };
}

/**
 * The immediately-preceding window of the same length (for % comparisons).
 */
export function previousRange(
  start: string,
  end: string,
): { prevStart: string; prevEnd: string } {
  const len = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  const prevEnd = subDays(parseISO(start), 1);
  const prevStart = subDays(prevEnd, len - 1);
  const fmt = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd");
  return { prevStart: fmt(prevStart), prevEnd: fmt(prevEnd) };
}
