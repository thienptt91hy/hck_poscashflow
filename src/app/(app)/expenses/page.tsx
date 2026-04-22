import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseForm } from "./expense-form";
import { ExpenseRowActions } from "./expense-row-actions";
import { PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type Store = { id: string; name_vi: string; name_ja: string | null; name_en: string | null };

export default async function ExpensesPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  const [{ data: profile }, { data: stores }, { data: varExp }, { data: fixedExp }] = await Promise.all([
    supabase.from("user_profiles").select("role, store_id").eq("id", user!.id).single(),
    supabase.from("stores").select("id, name_vi, name_ja, name_en").eq("active", true).order("sort_order"),
    supabase
      .from("variable_expenses")
      .select("id, expense_date, store_id, category, amount, paid_from, note, stores(name_vi, name_ja, name_en)")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("fixed_expenses").select("*").eq("active", true).order("name_vi"),
  ]);

  const sName = (s: Store | null) => (s?.[nameField as "name_vi"] as string | null) ?? s?.name_vi ?? "—";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.expenses.title}</h1>

      {/* Fixed expenses summary */}
      <Card>
        <CardHeader><CardTitle>Chi phí cố định hàng tháng</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100">
              {(!fixedExp || fixedExp.length === 0) && (
                <tr><td className="px-4 py-4 text-center text-zinc-400">{dict.common.empty}</td></tr>
              )}
              {(fixedExp ?? []).map((f) => (
                <tr key={f.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5">{f.name_vi}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{f.name_ja}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-red-600">{formatYen(f.amount)}</td>
                </tr>
              ))}
              {fixedExp && fixedExp.length > 0 && (
                <tr className="bg-zinc-50 font-semibold">
                  <td className="px-4 py-2.5">合計 / Tổng</td>
                  <td />
                  <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                    {formatYen(fixedExp.reduce((s, f) => s + f.amount, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />{dict.expenses.newExpense}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseForm
                dict={dict}
                stores={(stores ?? []).map((s) => ({ id: s.id, name: sName(s) }))}
                profile={{ id: user!.id, role: profile?.role ?? "staff", store_id: profile?.store_id ?? null }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader><CardTitle>{dict.expenses.variable}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">{dict.common.date}</th>
                      <th className="px-4 py-2.5 text-left">{dict.common.store}</th>
                      <th className="px-4 py-2.5 text-left">{dict.expenses.category}</th>
                      <th className="px-4 py-2.5 text-left">{dict.expenses.paidFrom}</th>
                      <th className="px-4 py-2.5 text-left">{dict.common.notes}</th>
                      <th className="px-4 py-2.5 text-right">{dict.common.amount}</th>
                      <th className="px-4 py-2.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(!varExp || varExp.length === 0) && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">{dict.common.empty}</td></tr>
                    )}
                    {(varExp ?? []).map((exp) => {
                      const s = exp.stores as unknown as Store | null;
                      return (
                        <tr key={exp.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-2 tabular-nums">{exp.expense_date}</td>
                          <td className="px-4 py-2 text-zinc-500">{sName(s) || "—"}</td>
                          <td className="px-4 py-2 text-xs text-zinc-600">{exp.category ?? "—"}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs rounded px-1.5 py-0.5 ${exp.paid_from === "cash" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                              {exp.paid_from === "cash" ? dict.expenses.paidFromCash : dict.expenses.paidFromBank}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-zinc-500 text-xs max-w-[100px] truncate">{exp.note ?? ""}</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-600">{formatYen(exp.amount)}</td>
                          <td className="px-4 py-2">
                            <ExpenseRowActions
                              row={{ id: exp.id, expense_date: exp.expense_date, store_id: exp.store_id ?? null, category: exp.category ?? "", amount: exp.amount, paid_from: exp.paid_from as "cash" | "bank", note: exp.note ?? null }}
                              stores={(stores ?? []).map((s) => ({ id: s.id, name: sName(s) }))}
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
