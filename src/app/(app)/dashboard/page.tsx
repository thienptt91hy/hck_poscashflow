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

  const [{ data: salesToday }, { data: salesMonth }, { data: salesByStoreMonth }, { data: stores }] =
    await Promise.all([
      supabase
        .from("daily_sales")
        .select("total_revenue, cash, qr_card, bank_transfer")
        .eq("sale_date", today),
      supabase
        .from("daily_sales")
        .select("sale_date, total_revenue, store_id")
        .gte("sale_date", monthStart)
        .lte("sale_date", today),
      supabase
        .from("daily_sales")
        .select("sale_date, total_revenue, store_id")
        .gte("sale_date", thirtyDaysAgo)
        .lte("sale_date", today)
        .order("sale_date"),
      supabase.from("stores").select("id, code, name_vi, name_ja, name_en").order("sort_order"),
    ]);

  const todayTotal = (salesToday ?? []).reduce((s, r) => s + (r.total_revenue ?? 0), 0);
  const monthTotal = (salesMonth ?? []).reduce((s, r) => s + (r.total_revenue ?? 0), 0);

  const storeNameField =
    locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.dashboard.title}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={dict.dashboard.revenueToday} value={formatYen(todayTotal)} />
        <KpiCard label={dict.dashboard.revenueThisMonth} value={formatYen(monthTotal)} accent />
        <KpiCard label={dict.dashboard.totalCash} value="—" muted />
        <KpiCard label={dict.dashboard.bankBalance} value="—" muted />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dict.dashboard.last30Days}</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyRevenueChart
            data={salesByStoreMonth ?? []}
            stores={(stores ?? []).map((s) => ({
              id: s.id,
              name: (s[storeNameField as "name_vi"] as string) ?? s.name_vi,
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
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-zinc-500">{label}</div>
        <div
          className={
            "mt-2 text-2xl font-semibold tabular-nums " +
            (accent ? "text-blue-700" : muted ? "text-zinc-400" : "text-zinc-900")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
