import { formatInTimeZone } from "date-fns-tz";

export const TZ = "Asia/Tokyo";

export function formatYen(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "¥0";
  return "¥" + Math.round(value).toLocaleString("en-US");
}

export function formatJST(date: Date | string, pattern = "yyyy-MM-dd HH:mm"): string {
  return formatInTimeZone(new Date(date), TZ, pattern);
}

export function formatDateJST(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "yyyy-MM-dd");
}

export function todayJST(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}
