import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen, TZ } from "@/lib/format";
import { formatInTimeZone } from "date-fns-tz";
import { subDays, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Wallet, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PeriodSelector } from "./period-selector";
import { DashboardCharts } from "./dashboard-charts";

export const dynamic = "force-dynamic";

type Period = "today" | "yesterday" | "last_7_days" | "this_month" | "last_month";

function getPeriodRange(period: Period) {
  const now = new Date();
  const fmt = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd");
  const today = fmt(now);
  const thisMonthStart = formatInTimeZone(now, TZ, "yyyy-MM-01");
  const prevMonthEndDate = subDays(parseISO(thisMonthStart), 1);
  const prevMonthStart = formatInTimeZone(prevMonthEndDate, TZ, "yyyy-MM-01");
  const prevMonthEnd = fmt(prevMonthEndDate);

  switch (period) {
    case "today":
      return { start: today, end: today, prevStart: fmt(subDays(now, 1)), prevEnd: fmt(subDays(now, 1)) };
    case "yesterday": {
      const y = fmt(subDays(now, 1));
      return { start: y, end: y, prevStart: fmt(subDays(now, 2)), prevEnd: fmt(subDays(now, 2)) };
    }
    case "last_7_days":
      return {
        start: fmt(subDays(now, 6)), end: today,
        prevStart: fmt(subDays(now, 13)), prevEnd: fmt(subDays(now, 7)),
      };
    case "last_month": {
      const p2EndDate = subDays(parseISO(prevMonthStart), 1);
      const p2Start = formatInTimeZone(p2EndDate, TZ, "yyyy-MM-01");
      return { start: prevMonthStart, end: prevMonthEnd, prevStart: p2Start, prevEnd: fmt(p2EndDate) };
    }
    default: // this_month
      return { start: thisMonthStart, end: today, prevStart: prevMonthStart, prevEnd: prevMonthEnd };
  }
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function KpiCard({
  label,
  value,
  change,
  higherIsBetter = true,
  primary = false,
  sub,
}: {
  label: string;
  value: string;
  change?: number | null;
  higherIsBetter?: boolean;
  primary?: boolean;
  sub?: React.ReactNode;
}) {
  const isUp = change != null && change > 0;
  const isDown = change != null && change < 0;
  const isGood =
    change == null || change === 0
      ? null
      : isUp
        ? higherIsBetter
        : !higherIsBetter;

  const badgeCls =
    isGood === null
      ? "bg-zinc-100 text-zinc-400"
      : isGood
        ? "bg-emerald-50 text-emerald-600"
        : "bg-red-50 text-red-500";

  return (
    <Card className={primary ? "ring-2 ring-blue-200 bg-gradient-to-br from-blue-50/60 to-white" : "bg-white"}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-zinc-500 truncate">{label}</p>
        <p
          className={`mt-1.5 text-xl font-bold tabular-nums leading-tight ${primary ? "text-blue-700" : "text-zinc-900"}`}
        >
          {value}
        </p>
        {change != null ? (
          <div
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeCls}`}
          >
            {isUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : isDown ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {isUp ? "+" : ""}
            {change}%
          </div>
        ) : sub != null ? (
          <div className="mt-2 text-xs text-zinc-400">{sub}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = (params.period ?? "this_month") as Period;
  const range = getPeriodRange(period);

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  const [
    { data: salesCurr },
    { data: salesPrev },
    { data: salesChart },
    { data: stores },
    { data: allCash },
    { data: allBank },
    { data: expCurr },
    { data: expPrev },
    { data: salCurr },
    { data: salPrev },
  ] = await Promise.all([
    supabase
      .from("daily_sales")
      .select("store_id, customer_count, cash, qr_card, bank_transfer, total_revenue")
      .gte("sale_date", range.start)
      .lte("sale_date", range.end),
    supabase
      .from("daily_sales")
      .select("customer_count, total_revenue")
      .gte("sale_date", range.prevStart)
      .lte("sale_date", range.prevEnd),
    supabase
      .from("daily_sales")
      .select("sale_date, total_revenue, store_id")
      .gte("sale_date", range.start)
      .lte("sale_date", range.end)
      .order("sale_date"),
    supabase.from("stores").select("id, name_vi, name_ja, name_en").order("sort_order"),
    supabase.from("cash_movements").select("direction, amount"),
    supabase.from("bank_transactions").select("direction, amount, fee"),
    supabase
      .from("variable_expenses")
      .select("amount")
      .gte("expense_date", range.start)
      .lte("expense_date", range.end),
    supabase
      .from("variable_expenses")
      .select("amount")
      .gte("expense_date", range.prevStart)
      .lte("expense_date", range.prevEnd),
    supabase
      .from("salary_payments")
      .select("amount")
      .gte("period_month", range.start)
      .lte("period_month", range.end),
    supabase
      .from("salary_payments")
      .select("amount")
      .gte("period_month", range.prevStart)
      .lte("period_month", range.prevEnd),
  ]);

  // KPI calculations
  const revenue = (salesCurr ?? []).reduce((s, r) => s + (r.total_revenue ?? 0), 0);
  const revenuePrev = (salesPrev ?? []).reduce((s, r) => s + (r.total_revenue ?? 0), 0);
  const customers = (salesCurr ?? []).reduce((s, r) => s + (r.customer_count ?? 0), 0);
  const customersPrev = (salesPrev ?? []).reduce((s, r) => s + (r.customer_count ?? 0), 0);
  const avgPerCustomer = customers > 0 ? revenue / customers : 0;
  const avgPrevCustomer = customersPrev > 0 ? revenuePrev / customersPrev : 0;
  const expenses = (expCurr ?? []).reduce((s, e) => s + e.amount, 0);
  const expensesPrev = (expPrev ?? []).reduce((s, e) => s + e.amount, 0);
  const salary = (salCurr ?? []).reduce((s, p) => s + p.amount, 0);
  const salaryPrev = (salPrev ?? []).reduce((s, p) => s + p.amount, 0);
  const totalExpenses = expenses + salary;
  const totalExpensesPrev = expensesPrev + salaryPrev;
  const profit = revenue - totalExpenses;
  const profitPrev = revenuePrev - totalExpensesPrev;

  const totalCash = (allCash ?? []).reduce(
    (s, m) => (m.direction === "in" ? s + m.amount : s - m.amount),
    0,
  );
  const bankBalance = (allBank ?? []).reduce(
    (s, t) => (t.direction === "in" ? s + t.amount : s - (t.amount + (t.fee ?? 0))),
    0,
  );

  // Payment mix
  const cashTotal = (salesCurr ?? []).reduce((s, r) => s + (r.cash ?? 0), 0);
  const qrTotal = (salesCurr ?? []).reduce((s, r) => s + (r.qr_card ?? 0), 0);
  const bankTotal = (salesCurr ?? []).reduce((s, r) => s + (r.bank_transfer ?? 0), 0);

  // Store breakdown
  const storeRevMap: Record<string, number> = {};
  for (const r of salesCurr ?? []) {
    storeRevMap[r.store_id] = (storeRevMap[r.store_id] ?? 0) + (r.total_revenue ?? 0);
  }
  const storeOpts = (stores ?? []).map((s) => ({
    id: s.id,
    name: (s[nameField as "name_vi"] as string) ?? s.name_vi,
    revenue: storeRevMap[s.id] ?? 0,
  }));

  const PERIODS = [
    { key: "today", label: dict.common.today },
    { key: "yesterday", label: dict.common.yesterday },
    { key: "last_7_days", label: dict.dashboard.last7Days },
    { key: "this_month", label: dict.common.thisMonth },
    { key: "last_month", label: dict.common.lastMonth },
  ];

  const vsPrev = dict.dashboard.vsPrev;

  return (
    <div className="space-y-5">
      {/* Header + Period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-zinc-900">{dict.dashboard.title}</h1>
        <PeriodSelector periods={PERIODS} current={period} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label={dict.dashboard.revenue}
          value={formatYen(revenue)}
          change={pctChange(revenue, revenuePrev)}
          higherIsBetter
          primary
        />
        <KpiCard
          label={dict.dashboard.customers}
          value={customers.toLocaleString()}
          change={pctChange(customers, customersPrev)}
          higherIsBetter
        />
        <KpiCard
          label={dict.dashboard.avgPerCustomer}
          value={formatYen(avgPerCustomer)}
          change={pctChange(avgPerCustomer, avgPrevCustomer)}
          higherIsBetter
        />
        <KpiCard
          label={dict.dashboard.expenses}
          value={formatYen(totalExpenses)}
          change={pctChange(totalExpenses, totalExpensesPrev)}
          higherIsBetter={false}
        />
        <KpiCard
          label={dict.dashboard.profit}
          value={formatYen(profit)}
          change={pctChange(profit, profitPrev)}
          higherIsBetter
        />
        {/* Balance card: no comparison, show cash + bank breakdown */}
        <Card className="bg-zinc-900 text-white border-0">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-zinc-400">
              {dict.dashboard.currentBalance}
            </p>
            <p className="mt-1.5 text-xl font-bold tabular-nums">
              {formatYen(totalCash + bankBalance)}
            </p>
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-zinc-400">
                  <Wallet className="h-3 w-3" />
                  {dict.dashboard.totalCash}
                </span>
                <span className="tabular-nums text-zinc-300">{formatYen(totalCash)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-zinc-400">
                  <Landmark className="h-3 w-3" />
                  {dict.dashboard.bankBalance}
                </span>
                <span className="tabular-nums text-zinc-300">{formatYen(bankBalance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* "vs prev" hint */}
      <p className="text-xs text-zinc-400 -mt-2 px-0.5">{vsPrev}</p>

      {/* Charts */}
      <DashboardCharts
        chartData={salesChart ?? []}
        stores={storeOpts}
        paymentMix={{ cash: cashTotal, qr: qrTotal, bank: bankTotal }}
        dict={dict}
      />
    </div>
  );
}
