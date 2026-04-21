import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen } from "@/lib/format";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalaryForm } from "./salary-form";
import { PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type Employee = { id: string; name: string; store_id: string; stores: { name_vi: string; name_ja: string | null; name_en: string | null } | null };

export default async function SalaryPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  const currentMonth = formatInTimeZone(new Date(), TZ, "yyyy-MM-01");

  const [{ data: employees }, { data: payments }] = await Promise.all([
    supabase.from("employees").select("id, name, store_id, stores(name_vi, name_ja, name_en)").eq("active", true).order("name"),
    supabase
      .from("salary_payments")
      .select("id, period_month, amount, payment_method, paid_at, note, employees(name, store_id), stores(name_vi, name_ja, name_en)")
      .order("period_month", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const thisMonthTotal = (payments ?? [])
    .filter((p) => p.period_month === currentMonth)
    .reduce((s, p) => s + p.amount, 0);

  const sName = (s: { name_vi: string; name_ja: string | null; name_en: string | null } | null) =>
    (s?.[nameField as "name_vi"] as string | null) ?? s?.name_vi ?? "—";

  const mKey = (m: string) => `method_${m}` as keyof typeof dict.salary;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.salary.title}</h1>

      <Card className="bg-zinc-900 text-white border-0">
        <CardContent className="flex items-center justify-between p-5">
          <div className="text-sm text-zinc-400">{dict.reports.salaryTotal} — {dict.common.thisMonth}</div>
          <div className="text-3xl font-bold tabular-nums">{formatYen(thisMonthTotal)}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />{dict.salary.newPayment}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SalaryForm
                dict={dict}
                userId={user!.id}
                employees={(employees ?? []).map((e) => ({
                  id: e.id,
                  name: e.name,
                  store_id: e.store_id,
                  store_name: sName((e as unknown as Employee).stores),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader><CardTitle>{dict.salary.title}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">{dict.salary.period}</th>
                      <th className="px-4 py-2.5 text-left">{dict.common.employee}</th>
                      <th className="px-4 py-2.5 text-left">{dict.common.store}</th>
                      <th className="px-4 py-2.5 text-left">{dict.salary.paymentMethod}</th>
                      <th className="px-4 py-2.5 text-right">{dict.common.amount}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(!payments || payments.length === 0) && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">{dict.common.empty}</td></tr>
                    )}
                    {(payments ?? []).map((p) => {
                      const emp = p.employees as unknown as { name: string } | null;
                      const store = p.stores as unknown as { name_vi: string; name_ja: string | null; name_en: string | null } | null;
                      return (
                        <tr key={p.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-2 tabular-nums text-zinc-700">{p.period_month?.slice(0, 7)}</td>
                          <td className="px-4 py-2 font-medium">{emp?.name ?? "—"}</td>
                          <td className="px-4 py-2 text-zinc-500">{sName(store)}</td>
                          <td className="px-4 py-2 text-xs text-zinc-500">
                            {(dict.salary[mKey(p.payment_method)] as string | undefined) ?? p.payment_method}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-600">
                            {formatYen(p.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
