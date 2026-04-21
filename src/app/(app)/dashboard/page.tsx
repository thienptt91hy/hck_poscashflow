import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen, todayJST, TZ } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyRevenueChart } from "@/components/charts/daily-revenue-chart";
import { formatInTimeZone } from "date-fns-tz";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();

  const today = todayJST();
  const monthStart = formatInTimeZone(new Date(), TZ, "yyyy-MM-01");
  const thirtyDaysAgo = formatInTimeZone(subDays(new Date(), 30), TZ, "yyyy-MM-dd");

  const [
    { data: salesToday },
    { data: salesMonth },
    { data: salesChart },
    { data: stores },
    { data: cashMovements },
    { data: bankTxs },
    { data: varExpenses },
    { data: salariesMonth },
  ] = await Promise.all([
    supabase.from("daily_sales").select("total_revenue").eq("sale_date", today),
    supabase.from("daily_sales").select("total_revenue").gte("sale_date", monthStart).lte("sale_date", today),
    supabase.from("daily_sales").select("sale_date, total_revenue, store_id")
      .gte("sale_date", thirtyDaysAgo).lte("sale_date", today).order("sale_date"),
    supabase.from("stores").select("id, code, name_vi, name_ja, name_en").order("sort_order"),
    supabase.from("cash_movements").select("direction, amount"),
    supabase.from("bank_transactions").select("direction, amount, fee"),
    supabase.from("variable_expenses").select("amount").gte("expense_date", monthStart).lte("expense_date", today),
    supabase.from("salary_payments").select("amount").gte("period_month", monthStart).lte("period_month", today),
  ]);

  const todayTotal = (salesToday ?? []).reduce((s, r) => s + (r.total_revenue ?? 0), 0);
  const monthTotal = (salesMonth ?? []).reduce((s, r) => s + (r.total_revenue ?? 0), 0);

  const totalCash = (cashMovements ?? []).reduce((s, m) =>
    m.direction === "in" ? s + m.amount : s - m.amount, 0);
  const bankBalance = (bankTxs ?? []).reduce((s, t) =>
    t.direction === "in" ? s + t.amount : s - (t.amount + (t.fee ?? 0)), 0);

  const expensesMonth = (varExpenses ?? []).reduce((s, e) => s + e.amount, 0);
  const salaryMonth = (salariesMonth ?? []).reduce((s, p) => s + p.amount, 0);
  const profit = monthTotal - expensesMonth - salaryMonth;

  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.dashboard.title}</h1>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label={dict.dashboard.revenueToday}   value={formatYen(todayTotal)} />
        <KpiCard label={dict.dashboard.revenueThisMonth} value={formatYen(monthTotal)} accent />
        <KpiCard label={dict.dashboard.totalCash}      value={formatYen(totalCash)}
          color={totalCash < 0 ? "text-red-600" : "text-emerald-700"} />
        <KpiCard label={dict.dashboard.bankBalance}    value={formatYen(bankBalance)}
          color={bankBalance < 0 ? "text-red-600" : "text-blue-700"} />
        <KpiCard label={dict.dashboard.expensesThisMonth} value={formatYen(expensesMonth + salaryMonth)}
          color="text-red-600" />
        <KpiCard label={dict.dashboard.profit}         value={formatYen(profit)}
          color={profit < 0 ? "text-red-600" : "text-emerald-700"} />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{dict.dashboard.last30Days}</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyRevenueChart
            data={salesChart ?? []}
            stores={(stores ?? []).map((s) => ({
              id: s.id,
              name: (s[nameField as "name_vi"] as string) ?? s.name_vi,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  color,
}: {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className="text-xs text-zinc-500 leading-tight">{label}</div>
        <div className={`mt-2 text-xl font-semibold tabular-nums leading-none ${color ?? (accent ? "text-blue-700" : "text-zinc-900")}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
