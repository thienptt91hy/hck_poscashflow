"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface PeriodOption {
  key: string;
  label: string;
}

export function PeriodSelector({
  periods,
  current,
}: {
  periods: PeriodOption[];
  current: string;
}) {
  const router = useRouter();

  return (
    <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1 gap-0.5 overflow-x-auto">
      {periods.map((p) => (
        <button
          key={p.key}
          onClick={() => router.replace(`/dashboard?period=${p.key}`)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap touch-manipulation",
            p.key === current
              ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
              : "text-zinc-500 hover:text-zinc-700 hover:bg-white/60",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
