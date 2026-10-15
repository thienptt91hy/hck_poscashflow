import { formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface BreakdownItem {
  label: string;
  /** Signed amount: + adds, − subtracts. */
  amount: number;
}

/**
 * Collapsible "how this number is computed" card. Server component, no JS:
 * uses native <details> so it works for every role and on mobile.
 */
export function BreakdownCard({
  title,
  items,
  totalLabel,
  total,
  formula,
  open = false,
  className,
}: {
  title: string;
  items: BreakdownItem[];
  totalLabel: string;
  total: number;
  formula?: string;
  open?: boolean;
  className?: string;
}) {
  return (
    <details
      open={open}
      className={cn("group rounded-xl border border-zinc-200 bg-white text-sm shadow-sm", className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-zinc-800 select-none">
        <span>🧮 {title}</span>
        <span className="text-xs text-zinc-400 transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="border-t border-zinc-100">
        {formula && <p className="px-4 pt-3 text-xs text-zinc-500">{formula}</p>}
        <table className="w-full">
          <tbody className="divide-y divide-zinc-100">
            {items.map((it) => {
              // -0 (a zero subtraction) still renders as "−" so expense rows read consistently
              const neg = it.amount < 0 || Object.is(it.amount, -0);
              return (
              <tr key={it.label}>
                <td className="px-4 py-2 text-zinc-600">
                  <span className={cn("mr-2 inline-block w-3 font-mono", neg ? "text-red-500" : "text-emerald-600")}>
                    {neg ? "−" : "+"}
                  </span>
                  {it.label}
                </td>
                <td className={cn("px-4 py-2 text-right tabular-nums", neg ? "text-red-600" : "text-zinc-800")}>
                  {formatYen(Math.abs(it.amount))}
                </td>
              </tr>
              );
            })}
            <tr className="bg-zinc-50 font-semibold">
              <td className="px-4 py-2.5">= {totalLabel}</td>
              <td className={cn("px-4 py-2.5 text-right tabular-nums", total < 0 ? "text-red-600" : "text-zinc-900")}>
                {total < 0 ? "−" : ""}
                {formatYen(Math.abs(total))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}
