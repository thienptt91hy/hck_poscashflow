import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BankForm } from "./bank-form";
import { BankRowActions } from "./bank-row-actions";
import { PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BankPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: txs }, { data: allTxs }] = await Promise.all([
    supabase.from("user_profiles").select("role, store_id").eq("id", user!.id).single(),
    supabase
      .from("bank_transactions")
      .select("id, tx_date, direction, category, payment_method, amount, fee, vendor, note, ref_table")
      .order("tx_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(80),
    // Separate query for balance — no limit so it covers all historical records
    supabase.from("bank_transactions").select("direction, amount, fee"),
  ]);

  const balance = (allTxs ?? []).reduce((s, t) => {
    const net = t.direction === "in" ? t.amount : -(t.amount + (t.fee ?? 0));
    return s + net;
  }, 0);

  const methodKey = (m: string) => `method_${m}` as keyof typeof dict.bank;
  const catKey = (c: string) => `cat_${c}` as keyof typeof dict.bank;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.bank.title}</h1>

      <Card className="bg-zinc-900 text-white border-0">
        <CardContent className="flex items-center justify-between p-5">
          <div className="text-sm text-zinc-400">{dict.dashboard.bankBalance}</div>
          <div className={`text-3xl font-bold tabular-nums ${balance < 0 ? "text-red-400" : ""}`}>
            {formatYen(balance)}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />{dict.bank.newTx}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BankForm
                dict={dict}
                profile={{ id: user!.id, role: profile?.role ?? "admin" }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader><CardTitle>{dict.bank.ledger}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">{dict.common.date}</th>
                      <th className="px-4 py-2.5 text-left">{dict.bank.category}</th>
                      <th className="px-4 py-2.5 text-left">{dict.bank.vendor}</th>
                      <th className="px-4 py-2.5 text-right">{dict.bank.fee}</th>
                      <th className="px-4 py-2.5 text-right">{dict.common.amount}</th>
                      <th className="px-4 py-2.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(!txs || txs.length === 0) && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{dict.common.empty}</td></tr>
                    )}
                    {(txs ?? []).map((t) => {
                      const isIn = t.direction === "in";
                      const catLabel = (dict.bank[catKey(t.category)] as string | undefined) ?? t.category;
                      return (
                        <tr key={t.id} className={`hover:bg-zinc-50 ${t.ref_table ? "bg-zinc-50/50" : ""}`}>
                          <td className="px-4 py-2 tabular-nums text-zinc-700">{t.tx_date}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs rounded px-1.5 py-0.5 ${isIn ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {catLabel}
                            </span>
                            {t.ref_table && (
                              <span className="ml-1 text-xs rounded px-1 py-0.5 bg-zinc-100 text-zinc-400">
                                {dict.cash.autoEntry}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-zinc-600 text-xs max-w-[140px] truncate">{t.vendor ?? t.note ?? "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-400 text-xs">
                            {t.fee > 0 ? "−" + formatYen(t.fee) : ""}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold tabular-nums ${isIn ? "text-emerald-700" : "text-red-600"}`}>
                            {isIn ? "+" : "−"}{formatYen(t.amount)}
                          </td>
                          <td className="px-4 py-2">
                            <BankRowActions
                              row={{ id: t.id, tx_date: t.tx_date, direction: t.direction as "in" | "out", category: t.category, payment_method: t.payment_method, amount: t.amount, fee: t.fee ?? 0, vendor: t.vendor ?? null, note: t.note ?? null, ref_table: t.ref_table ?? null }}
                              dict={dict}
                            />
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
