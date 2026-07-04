"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  parseISO,
  subDays,
  subMonths,
  subYears,
  startOfMonth,
  endOfMonth,
  addMonths,
  getDay,
  isSameMonth,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TZ } from "@/lib/format";
import type { Dictionary } from "@/i18n/dictionaries";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");
const display = (s: string) => format(parseISO(s), "dd/MM/yyyy");

const WEEKDAYS: Record<string, string[]> = {
  vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  ja: ["月", "火", "水", "木", "金", "土", "日"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

function monthLabel(locale: string, d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (locale === "ja") return `${y}年${m}月`;
  if (locale === "en") {
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    return `${mon} ${y}`;
  }
  return `Th${m} ${y}`;
}

export function DateRangePicker({
  basePath,
  from,
  to,
  dict,
  locale,
}: {
  basePath: string;
  from: string;
  to: string;
  dict: Dictionary;
  locale: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Today anchored to the app timezone (JST), as a local-midnight Date
  const today = useMemo(() => parseISO(formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")), []);

  const [pStart, setPStart] = useState(from);
  const [pEnd, setPEnd] = useState<string | null>(to);
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(parseISO(from)));

  const r = dict.range;

  const presets = useMemo(
    () => [
      { key: "today", label: r.today, calc: (): [Date, Date] => [today, today] },
      { key: "yesterday", label: r.yesterday, calc: (): [Date, Date] => [subDays(today, 1), subDays(today, 1)] },
      { key: "last7", label: r.last7Days, calc: (): [Date, Date] => [subDays(today, 6), today] },
      { key: "last14", label: r.last14Days, calc: (): [Date, Date] => [subDays(today, 13), today] },
      { key: "last30", label: r.last30Days, calc: (): [Date, Date] => [subDays(today, 29), today] },
      { key: "last90", label: r.last90Days, calc: (): [Date, Date] => [subDays(today, 89), today] },
      { key: "thisMonth", label: r.thisMonth, calc: (): [Date, Date] => [startOfMonth(today), today] },
      {
        key: "lastMonth",
        label: r.lastMonth,
        calc: (): [Date, Date] => [startOfMonth(subMonths(today, 1)), endOfMonth(subMonths(today, 1))],
      },
      { key: "lastYear", label: r.lastYear, calc: (): [Date, Date] => [subYears(today, 1), today] },
    ],
    [today, r],
  );

  const reset = () => {
    setPStart(from);
    setPEnd(to);
    setViewMonth(startOfMonth(parseISO(from)));
  };

  const openPicker = () => {
    reset();
    setOpen(true);
  };

  const cancel = () => {
    reset();
    setOpen(false);
  };

  const apply = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("from", pStart);
    params.set("to", pEnd ?? pStart);
    params.delete("period");
    router.replace(`${basePath}?${params.toString()}`);
    setOpen(false);
  };

  const pickPreset = (calc: () => [Date, Date]) => {
    const [s, e] = calc();
    setPStart(fmt(s));
    setPEnd(fmt(e));
    setViewMonth(startOfMonth(s));
  };

  const pickDay = (dstr: string) => {
    if (!pStart || pEnd) {
      setPStart(dstr);
      setPEnd(null);
    } else if (dstr < pStart) {
      setPStart(dstr);
      setPEnd(null);
    } else {
      setPEnd(dstr);
    }
  };

  // Build calendar grid (Monday-first)
  const monthStart = startOfMonth(viewMonth);
  const leadingBlanks = (getDay(monthStart) + 6) % 7; // 0 = Monday
  const daysInMonth = endOfMonth(viewMonth).getDate();
  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];

  const rangeEnd = pEnd ?? pStart;
  const inRange = (dstr: string) => pStart && rangeEnd && dstr >= pStart && dstr <= rangeEnd;
  const isEndpoint = (dstr: string) => dstr === pStart || dstr === pEnd;

  const activePreset = presets.find((p) => {
    const [s, e] = p.calc();
    return fmt(s) === pStart && fmt(e) === (pEnd ?? pStart);
  });

  return (
    <div className="relative">
      <button
        onClick={openPicker}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        <CalendarDays className="h-4 w-4 text-zinc-400" />
        <span className="tabular-nums">
          {display(from)} <span className="text-zinc-400">–</span> {display(to)}
        </span>
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            onClick={cancel}
            aria-label="close"
          />
          <div className="absolute right-0 z-50 mt-2 w-[300px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl sm:w-[500px]">
            <div className="flex flex-col sm:flex-row">
              {/* Presets */}
              <div className="flex flex-row flex-wrap gap-1 border-b border-zinc-100 p-2 sm:w-[150px] sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => pickPreset(p.calc)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors",
                      activePreset?.key === p.key
                        ? "bg-blue-50 text-blue-700"
                        : "text-zinc-600 hover:bg-zinc-100",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Calendar */}
              <div className="flex-1 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    onClick={() => setViewMonth((m) => subMonths(m, 1))}
                    className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    aria-label="previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold text-zinc-800">
                    {monthLabel(locale, viewMonth)}
                  </span>
                  <button
                    onClick={() => setViewMonth((m) => addMonths(m, 1))}
                    className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    aria-label="next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {(WEEKDAYS[locale] ?? WEEKDAYS.vi).map((w) => (
                    <div key={w} className="py-1 text-[11px] font-medium text-zinc-400">
                      {w}
                    </div>
                  ))}
                  {cells.map((d, i) => {
                    if (!d) return <div key={`b${i}`} />;
                    const dstr = fmt(d);
                    const selected = isEndpoint(dstr);
                    const within = inRange(dstr) && !selected;
                    const isToday = isSameMonth(d, today) && dstr === fmt(today);
                    return (
                      <button
                        key={dstr}
                        onClick={() => pickDay(dstr)}
                        className={cn(
                          "mx-auto flex h-8 w-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                          selected
                            ? "bg-blue-600 font-semibold text-white"
                            : within
                              ? "bg-blue-50 text-blue-700"
                              : "text-zinc-700 hover:bg-zinc-100",
                          isToday && !selected && "ring-1 ring-blue-300",
                        )}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2.5">
              <span className="text-xs tabular-nums text-zinc-500">
                {display(pStart)} <span className="text-zinc-300">–</span>{" "}
                {display(pEnd ?? pStart)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={cancel}
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                >
                  {r.cancel}
                </button>
                <button
                  onClick={apply}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {r.apply}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
