import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WholesaleForm } from "./wholesale-form";
import { WholesaleMarkPaid } from "./wholesale-mark-paid";
import { PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WholesalePage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from("wholesale_sales")
    .select("id, sale_date, customer_company, amount, payment_method, paid, due_date, note")
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(80);

  const totalRevenue = (orders ?? []).reduce((s, o) => s + o.amount, 0);
  const unpaidTotal = (orders ?? []).filter((o) => !o.paid).reduce((s, o) => s + o.amount, 0);

  const methodKey = (m: string) => `method_${m}` as keyof typeof dict.wholesale;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.wholesale.title}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-zinc-900 text-white border-0">
          <CardContent>
            <div className="text-xs text-zinc-400">{dict.reports.wholesale}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{formatYen(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent>
            <div className="text-xs text-orange-600">{dict.wholesale.unpaid}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-orange-700">{formatYen(unpaidTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-xs text-zinc-500">{dict.wholesale.paid}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
              {formatYen(totalRevenue - unpaidTotal)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />{dict.wholesale.newOrder}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WholesaleForm dict={dict} userId={user!.id} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader><CardTitle>{dict.wholesale.title}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">{dict.common.date}</th>
                      <th className="px-4 py-2.5 text-left">{dict.wholesale.customer}</th>
                      <th className="px-4 py-2.5 text-left">{dict.wholesale.paymentMethod}</th>
                      <th className="px-4 py-2.5 text-left">{dict.wholesale.dueDate}</th>
                      <th className="px-4 py-2.5 text-right">{dict.common.amount}</th>
                      <th className="px-4 py-2.5 text-center">{dict.employees.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(!orders || orders.length === 0) && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{dict.common.empty}</td></tr>
                    )}
                    {(orders ?? []).map((o) => (
                      <tr key={o.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2 tabular-nums text-zinc-700">{o.sale_date}</td>
                        <td className="px-4 py-2 font-medium">{o.customer_company}</td>
                        <td className="px-4 py-2 text-zinc-500 text-xs">
                          {(dict.wholesale[methodKey(o.payment_method)] as string | undefined) ?? o.payment_method}
                        </td>
                        <td className="px-4 py-2 text-zinc-500 text-xs tabular-nums">{o.due_date ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatYen(o.amount)}</td>
                        <td className="px-4 py-2 text-center">
                          {o.paid ? (
                            <span className="text-xs rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700">{dict.wholesale.paid}</span>
                          ) : (
                            <WholesaleMarkPaid id={o.id} dict={dict} />
                          )}
                        </td>
                      </tr>
                    ))}
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
