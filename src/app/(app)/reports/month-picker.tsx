"use client";

import { useRouter, usePathname } from "next/navigation";

export function MonthPicker({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <input
      type="month"
      defaultValue={current}
      onChange={(e) => {
        if (e.target.value) router.push(`${pathname}?month=${e.target.value}`);
      }}
      className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}
