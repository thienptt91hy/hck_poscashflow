import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen, TZ } from "@/lib/format";
import { formatInTimeZone } from "date-fns-tz";
import { subDays, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { SalesRowActions } from "./sales-row-actions";
import { SalesFilters } from "./sales-filters";
import { SalesCharts } from "./sales-charts";

export const dynamic = "force-dynamic";

type Period = "today" | "yesterday" | "last_7_days" | "this_month" | "last_month";

function getPeriodRange(period: Period) {
  const now = new Date();
  const fmt = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd");
  const today = fmt(now);
  const thisMonthStart = formatInTimeZone(now, TZ, "yyyy-MM-01");
  const prevMonthEndDate = subDays(parseISO(thisMonthStart), 1);
  const prevMonthStart = formatInTimeZone(prevMonthEndDate, TZ, "yyyy-MM-01");

  // Last day of current month (consistent with monthly report which uses < first day of next month)
  const [yr, mo] = thisMonthStart.split("-").map(Number);
  const nextMonthStr = mo === 12 ? `${yr + 1}-01-01` : `${yr}-${String(mo + 1).padStart(2, "0")}-01`;
  const thisMonthEnd = fmt(subDays(parseISO(nextMonthStr), 1));

  switch (period) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = fmt(subDays(now, 1));
      return { start: y, end: y };
    }
    case "last_7_days":
      return { start: fmt(subDays(now, 6)), end: today };
    case "last_month":
      return { start: prevMonthStart, end: fmt(prevMonthEndDate) };
    default: // this_month — full month (same range as monthly report)
      return { start: thisMonthStart, end: thisMonthEnd };
  }
}

export default async function SalesListPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; store?: string }>;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();

  const { period: periodParam, store: storeParam } = await searchParams;
  const period = (periodParam ?? "this_month") as Period;
  const selectedStore = storeParam ?? "all";

  const { start, end } = getPeriodRange(period);

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name_vi, name_ja, name_en, has_cafe_bakery")
    .eq("active", true)
    .order("sort_order");

  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";
  const storeOpts = (stores ?? []).map((s) => ({
    id: s.id,
    name: (s[nameField as "name_vi"] as string | null) ?? s.name_vi,
    has_cafe_bakery: s.has_cafe_bakery,
  }));

  // Build main query with date range
  let query = supabase
    .from("daily_sales")
    .select(
      "id, sale_date, store_id, revenue_stream, customer_count, cash, qr_card, bank_transfer, total_revenue, avg_per_customer, notes, stores(code, name_vi, name_ja, name_en)",
    )
    .gte("sale_date", start)
    .lte("sale_date", end)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (selectedStore !== "all") {
    query = query.eq("store_id", selectedStore);
  }

  const { data: rows } = await query;

  // KPI summaries
  const totalRevenue = (rows ?? []).reduce((s, r) => s + r.total_revenue, 0);
  const totalCustomers = (rows ?? []).reduce((s, r) => s + r.customer_count, 0);
  const avgPerCustomer = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;
  const totalDays = new Set((rows ?? []).map((r) => r.sale_date)).size;

  // Chart data
  const chartRows = (rows ?? []).map((r) => ({
    sale_date: r.sale_date,
    store_id: r.store_id,
    total_revenue: r.total_revenue,
    cash: r.cash,
    qr_card: r.qr_card,
    bank_transfer: r.bank_transfer,
    customer_count: r.customer_count,
  }));

  const periods = [
    { key: "today", label: dict.common.today },
    { key: "yesterday", label: dict.common.yesterday },
    { key: "last_7_days", label: dict.dashboard.last7Days },
    { key: "this_month", label: dict.common.thisMonth },
    { key: "last_month", label: dict.common.lastMonth },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-zinc-900">{dict.sales.title}</h1>
        <Link
          href="/sales/new"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusCircle className="h-4 w-4" />
          {dict.sales.newEntry}
        </Link>
      </div>

      {/* Filters */}
      <SalesFilters
        periods={periods}
        stores={storeOpts}
        currentPeriod={period}
        currentStore={selectedStore}
      />

      {/* KPI summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white border border-zinc-100 shadow-sm px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">{dict.sales.totalRevenue}</p>
          <p className="text-lg font-bold tabular-nums text-zinc-900">{formatYen(totalRevenue)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{totalDays} ngày</p>
        </div>
        <div className="rounded-xl bg-white border border-zinc-100 shadow-sm px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">{dict.sales.customerCount}</p>
          <p className="text-lg font-bold tabular-nums text-zinc-900">
            {totalCustomers.toLocaleString()}
            <span className="text-sm font-normal text-zinc-400 ml-1">{dict.sales.unit.customer}</span>
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{(rows ?? []).length} lượt nhập</p>
        </div>
        <div className="rounded-xl bg-white border border-zinc-100 shadow-sm px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">{dict.sales.avgPerCustomer}</p>
          <p className="text-lg font-bold tabular-nums text-zinc-900">{formatYen(avgPerCustomer)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">/khách</p>
        </div>
        <div className="rounded-xl bg-white border border-zinc-100 shadow-sm px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">{dict.sales.revenueStream}</p>
          <p className="text-lg font-bold tabular-nums text-zinc-900">
            {(rows ?? []).filter((r) => r.revenue_stream === "cafe_bakery").length > 0
              ? formatYen((rows ?? []).filter((r) => r.revenue_stream === "cafe_bakery").reduce((s, r) => s + r.total_revenue, 0))
              : "—"}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">cafe / bakery</p>
        </div>
      </div>

      {/* Charts */}
      {(rows ?? []).length > 0 && (
        <SalesCharts
          rows={chartRows}
          allStores={storeOpts}
          selectedStore={selectedStore}
          dict={dict}
        />
      )}

      {/* Table */}
      {(!rows || rows.length === 0) ? (
        <Card>
          <CardContent>
            <div className="py-12 text-center text-sm text-zinc-400">{dict.common.empty}</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">{dict.common.date}</th>
                    <th className="px-4 py-2.5 text-left font-medium">{dict.common.store}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{dict.sales.customerCount}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{dict.sales.cash}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{dict.sales.qrCard}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{dict.sales.bankTransfer}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{dict.sales.totalRevenue}</th>
                    <th className="px-4 py-2.5 text-center font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((r) => {
                    const store = r.stores as unknown as
                      | { name_vi: string; name_ja: string | null; name_en: string | null }
                      | null;
                    const storeName =
                      (store?.[nameField as "name_vi"] as string | null) ?? store?.name_vi ?? "—";
                    return (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2.5 tabular-nums">{r.sale_date}</td>
                        <td className="px-4 py-2.5">
                          {storeName}
                          {r.revenue_stream === "cafe_bakery" && (
                            <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                              cafe
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.customer_count}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                          {formatYen(r.cash)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-blue-700">
                          {formatYen(r.qr_card)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-violet-700">
                          {formatYen(r.bank_transfer)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {formatYen(r.total_revenue)}
                        </td>
                        <td className="px-4 py-2.5">
                          <SalesRowActions
                            row={{
                              id: r.id,
                              sale_date: r.sale_date,
                              store_id: r.store_id,
                              revenue_stream: r.revenue_stream,
                              customer_count: r.customer_count,
                              cash: r.cash,
                              qr_card: r.qr_card,
                              bank_transfer: r.bank_transfer,
                              notes: r.notes ?? null,
                            }}
                            stores={storeOpts}
                            dict={dict}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Summary footer */}
                <tfoot>
                  <tr className="bg-zinc-50 font-semibold text-sm border-t border-zinc-200">
                    <td colSpan={2} className="px-4 py-2.5 text-zinc-500">Tổng cộng</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{totalCustomers.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                      {formatYen((rows ?? []).reduce((s, r) => s + r.cash, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-700">
                      {formatYen((rows ?? []).reduce((s, r) => s + r.qr_card, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-violet-700">
                      {formatYen((rows ?? []).reduce((s, r) => s + r.bank_transfer, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(totalRevenue)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
