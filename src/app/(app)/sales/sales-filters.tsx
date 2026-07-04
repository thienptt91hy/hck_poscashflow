"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/date-range-picker";
import type { Dictionary } from "@/i18n/dictionaries";

export interface StoreOption {
  id: string;
  name: string;
}

export function SalesFilters({
  stores,
  currentStore,
  from,
  to,
  dict,
  locale,
}: {
  stores: StoreOption[];
  currentStore: string;
  from: string;
  to: string;
  dict: Dictionary;
  locale: string;
}) {
  const router = useRouter();

  const setStore = (val: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("store", val);
    router.replace(`/sales?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Date range */}
      <div className="flex">
        <DateRangePicker basePath="/sales" from={from} to={to} dict={dict} locale={locale} />
      </div>

      {/* Store filter */}
      {stores.length > 1 && (
        <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 gap-0.5 overflow-x-auto">
          <button
            onClick={() => setStore("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap touch-manipulation",
              currentStore === "all"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-white/60",
            )}
          >
            🏪 Tất cả
          </button>
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => setStore(s.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap touch-manipulation",
                s.id === currentStore
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-white/60",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
