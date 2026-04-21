import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen, TZ } from "@/lib/format";
import { formatInTimeZone } from "date-fns-tz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportPrintButton } from "./report-print-button";
import { MonthPicker } from "./month-picker";

export const dynamic = "force-dynamic";

type Store = { id: string; code: string; name_vi: string; name_ja: string | null; name_en: string | null };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  const params = await searchParams;
  const selectedMonth = params.month ?? formatInTimeZone(new Date(), TZ, "yyyy-MM");
  const monthStart = selectedMonth + "-01";
  const [year, mon] = selectedMonth.split("-").map(Number);
  const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(nextMonth).toISOString().slice(0, 10);

  const [
    { data: stores },
    { data: salesData },
    { data: cashIn },
    { data: cashOut },
    { data: bankIn },
    { data: bankOut },
    { data: fixedExp },
    { data: varExp },
    { data: salaries },
    { data: wholesale },
  ] = await Promise.all([
    supabase.from("stores").select("id, code, name_vi, name_ja, name_en").order("sort_order"),
    supabase.from("daily_sales").select("store_id, customer_count, total_revenue, cash, qr_card, bank_transfer")
      .gte("sale_date", monthStart).lt("sale_date", monthEnd),
    supabase.from("cash_movements").select("amount").eq("direction", "in")
      .gte("move_date", monthStart).lt("move_date", monthEnd),
    supabase.from("cash_movements").select("amount").eq("direction", "out")
      .gte("move_date", monthStart).lt("move_date", monthEnd),
    supabase.from("bank_transactions").select("amount").eq("direction", "in")
      .gte("tx_date", monthStart).lt("tx_date", monthEnd),
    supabase.from("bank_transactions").select("amount, fee").eq("direction", "out")
      .gte("tx_date", monthStart).lt("tx_date", monthEnd),
    supabase.from("fixed_expenses").select("name_vi, name_ja, amount").eq("active", true),
    supabase.from("variable_expenses").select("amount, category")
      .gte("expense_date", monthStart).lt("expense_date", monthEnd),
    supabase.from("salary_payments").select("amount")
      .gte("period_month", monthStart).lt("period_month", monthEnd),
    supabase.from("wholesale_sales").select("amount")
      .gte("sale_date", monthStart).lt("sale_date", monthEnd),
  ]);

  const sName = (s: Store) => (s[nameField as "name_vi"] as string | null) ?? s.name_vi;

  // Aggregate revenue by store
  const revenueByStore = (stores ?? []).map((s) => {
    const rows = (salesData ?? []).filter((r) => r.store_id === s.id);
    return {
      store: sName(s),
      revenue: rows.reduce((sum, r) => sum + (r.total_revenue ?? 0), 0),
      customers: rows.reduce((sum, r) => sum + (r.customer_count ?? 0), 0),
      cash: rows.reduce((sum, r) => sum + (r.cash ?? 0), 0),
      qrCard: rows.reduce((sum, r) => sum + (r.qr_card ?? 0), 0),
      bankTransfer: rows.reduce((sum, r) => sum + (r.bank_transfer ?? 0), 0),
    };
  });

  const totalRevenue = revenueByStore.reduce((s, r) => s + r.revenue, 0);
  const totalCustomers = revenueByStore.reduce((s, r) => s + r.customers, 0);
  const wholesaleTotal = (wholesale ?? []).reduce((s, r) => s + r.amount, 0);
  const fixedTotal = (fixedExp ?? []).reduce((s, r) => s + r.amount, 0);
  const varTotal = (varExp ?? []).reduce((s, r) => s + r.amount, 0);
  const salaryTotal = (salaries ?? []).reduce((s, r) => s + r.amount, 0);
  const totalExpenses = fixedTotal + varTotal + salaryTotal;
  const grossProfit = totalRevenue + wholesaleTotal - varTotal - salaryTotal;
  const netProfit = totalRevenue + wholesaleTotal - totalExpenses;
  const cashInTotal = (cashIn ?? []).reduce((s, r) => s + r.amount, 0);
  const cashOutTotal = (cashOut ?? []).reduce((s, r) => s + r.amount, 0);
  const bankInTotal = (bankIn ?? []).reduce((s, r) => s + r.amount, 0);
  const bankOutTotal = (bankOut ?? []).reduce((s, r) => s + (r.amount + (r.fee ?? 0)), 0);

  return (
    <div className="space-y-6 print:space-y-4" id="report-content">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-zinc-900">{dict.reports.title}</h1>
        <div className="flex items-center gap-3">
          <MonthPicker current={selectedMonth} />
          <ReportPrintButton label={dict.reports.printReport} />
        </div>
      </div>
      <div className="hidden print:block text-center">
        <h2 className="text-xl font-bold">{dict.reports.title} — {selectedMonth}</h2>
        <p className="text-sm text-zinc-500 mt-1">{dict.app.name}</p>
      </div>

      {/* Revenue by store */}
      <Card>
        <CardHeader><CardTitle>{dict.reports.revenueByStore}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 text-left">{dict.common.store}</th>
                <th className="px-4 py-2.5 text-right">{dict.reports.customers}</th>
                <th className="px-4 py-2.5 text-right">{dict.sales.cash}</th>
                <th className="px-4 py-2.5 text-right">{dict.sales.qrCard}</th>
                <th className="px-4 py-2.5 text-right">{dict.sales.bankTransfer}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{dict.common.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {revenueByStore.map((r) => (
                <tr key={r.store} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium">{r.store}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.customers.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatYen(r.cash)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-blue-700">{formatYen(r.qrCard)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-violet-700">{formatYen(r.bankTransfer)}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">{formatYen(r.revenue)}</td>
                </tr>
              ))}
              {wholesaleTotal > 0 && (
                <tr className="bg-blue-50">
                  <td className="px-4 py-2.5 font-medium text-blue-700">{dict.reports.wholesale}</td>
                  <td colSpan={4} />
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-blue-700">{formatYen(wholesaleTotal)}</td>
                </tr>
              )}
              <tr className="bg-zinc-900 text-white">
                <td className="px-4 py-2.5 font-bold">{dict.reports.totalRevenue}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{totalCustomers.toLocaleString()}</td>
                <td colSpan={3} />
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-lg">
                  {formatYen(totalRevenue + wholesaleTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash flow */}
        <Card>
          <CardHeader><CardTitle>💵 {dict.nav.cash}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                <Row label={dict.reports.cashIn} value={cashInTotal} color="emerald" />
                <Row label={dict.reports.cashOut} value={-cashOutTotal} color="red" />
                <Row label="Net" value={cashInTotal - cashOutTotal}
                  color={cashInTotal - cashOutTotal >= 0 ? "emerald" : "red"} bold />
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Bank flow */}
        <Card>
          <CardHeader><CardTitle>🏦 {dict.nav.bank}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                <Row label={dict.reports.bankIn} value={bankInTotal} color="emerald" />
                <Row label={dict.reports.bankOut} value={-bankOutTotal} color="red" />
                <Row label="Net" value={bankInTotal - bankOutTotal}
                  color={bankInTotal - bankOutTotal >= 0 ? "emerald" : "red"} bold />
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Expenses breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>📌 {dict.reports.fixedExpenses}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                {(fixedExp ?? []).map((f) => (
                  <tr key={f.name_vi} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">{locale === "ja" ? (f.name_ja ?? f.name_vi) : f.name_vi}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-600">{formatYen(f.amount)}</td>
                  </tr>
                ))}
                <Row label={dict.common.total} value={-fixedTotal} color="red" bold />
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>💸 {dict.reports.variableExpenses} + {dict.salary.title}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                <Row label={dict.reports.variableExpenses} value={-varTotal} color="red" />
                <Row label={dict.reports.salaryTotal} value={-salaryTotal} color="red" />
                <Row label={dict.common.total} value={-(varTotal + salaryTotal)} color="red" bold />
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* P&L summary */}
      <Card className="border-2 border-zinc-900">
        <CardHeader><CardTitle>📊 P&L Summary — {selectedMonth}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100">
              <Row label={dict.reports.totalRevenue} value={totalRevenue + wholesaleTotal} color="emerald" bold />
              <Row label={dict.reports.fixedExpenses} value={-fixedTotal} color="red" />
              <Row label={dict.reports.variableExpenses} value={-varTotal} color="red" />
              <Row label={dict.reports.salaryTotal} value={-salaryTotal} color="red" />
              <Row label={dict.common.total + " " + dict.nav.expenses} value={-totalExpenses} color="red" bold />
              <tr className="bg-zinc-900 text-white text-base">
                <td className="px-4 py-3 font-bold">{dict.reports.netProfit}</td>
                <td className={`px-4 py-3 text-right font-bold tabular-nums text-xl ${netProfit < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {formatYen(netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label, value, color, bold,
}: {
  label: string; value: number; color: "emerald" | "red" | "zinc"; bold?: boolean;
}) {
  const colorClass = color === "emerald" ? "text-emerald-700" : color === "red" ? "text-red-600" : "text-zinc-700";
  return (
    <tr className={bold ? "bg-zinc-50" : "hover:bg-zinc-50"}>
      <td className={`px-4 py-2 ${bold ? "font-semibold" : ""}`}>{label}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${colorClass} ${bold ? "font-bold" : ""}`}>
        {value >= 0 ? "" : "−"}{formatYen(Math.abs(value))}
      </td>
    </tr>
  );
}
