import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth-server";
import { getBankBalance, getCashBalance, getPeriodFinance } from "@/lib/finance-server";
import { BreakdownCard } from "@/components/breakdown-card";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen } from "@/lib/format";
import { resolveRange, previousRange } from "@/lib/date-range";
import { TrendingUp, TrendingDown, Minus, Wallet, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/date-range-picker";
import { DashboardCharts } from "./dashboard-charts";

export const dynamic = "force-dynamic";

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
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { start, end } = resolveRange(params.from, params.to);
  const { prevStart, prevEnd } = previousRange(start, end);
  const range = { start, end, prevStart, prevEnd };

  await requireRole("/dashboard");
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  const [{ data: salesChart }, { data: stores }, curr, prev, cashBal, bankBal] = await Promise.all([
    supabase
      .from("daily_sales")
      .select("sale_date, total_revenue, store_id")
      .gte("sale_date", range.start)
      .lte("sale_date", range.end)
      .order("sale_date"),
    supabase.from("stores").select("id, name_vi, name_ja, name_en").order("sort_order"),
    // Revenue / expenses / profit: one shared definition (lib/finance.ts, spec finance-formulas.md)
    getPeriodFinance(supabase, range.start, range.end),
    getPeriodFinance(supabase, range.prevStart, range.prevEnd),
    getCashBalance(supabase),
    getBankBalance(supabase),
  ]);

  // KPI calculations
  const revenue = curr.revenue; // retail + wholesale
  const revenuePrev = prev.revenue;
  const customers = Number(curr.totals.customers) || 0;
  const customersPrev = Number(prev.totals.customers) || 0;
  // Avg per customer stays on retail revenue (wholesale has no walk-in customers)
  const avgPerCustomer = customers > 0 ? curr.retail / customers : 0;
  const avgPrevCustomer = customersPrev > 0 ? prev.retail / customersPrev : 0;
  const totalExpenses = curr.expenses.total;
  const totalExpensesPrev = prev.expenses.total;
  const profit = curr.profit;
  const profitPrev = prev.profit;

  const totalCash = cashBal.total;
  const bankBalance = bankBal.total;

  // Payment mix
  const cashTotal = Number(curr.totals.cash) || 0;
  const qrTotal = Number(curr.totals.qr_card) || 0;
  const bankTotal = Number(curr.totals.bank_transfer) || 0;

  // Store breakdown
  const storeRevMap: Record<string, number> = {};
  for (const r of salesChart ?? []) {
    storeRevMap[r.store_id] = (storeRevMap[r.store_id] ?? 0) + (r.total_revenue ?? 0);
  }
  const storeOpts = (stores ?? []).map((s) => ({
    id: s.id,
    name: (s[nameField as "name_vi"] as string) ?? s.name_vi,
    revenue: storeRevMap[s.id] ?? 0,
  }));
  const f = dict.finance;
  const vsPrev = dict.dashboard.vsPrev;

  return (
    <div className="space-y-5">
      {/* Header + Period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-zinc-900">{dict.dashboard.title}</h1>
        <DateRangePicker basePath="/dashboard" from={range.start} to={range.end} dict={dict} locale={locale} />
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

      {/* Profit = Revenue − Expenses, itemised */}
      <BreakdownCard
        title={f.profitBreakdown}
        formula={f.profitFormula}
        items={[
          { label: f.revenueRetail, amount: curr.retail },
          { label: f.revenueWholesale, amount: curr.wholesale },
          ...curr.expenses.lines.map((l) => ({ label: f[`exp_${l.key}` as keyof typeof f], amount: -l.amount })),
        ]}
        totalLabel={f.profit}
        total={profit}
      />

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
