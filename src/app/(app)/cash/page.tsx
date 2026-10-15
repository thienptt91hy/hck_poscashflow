import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth-server";
import { getCashBalance } from "@/lib/finance-server";
import { BreakdownCard } from "@/components/breakdown-card";
import { isReadOnly } from "@/lib/permissions";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashForm } from "./cash-form";
import { CashRowActions } from "./cash-row-actions";
import { PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type Store = { id: string; code: string; name_vi: string; name_ja: string | null; name_en: string | null };

function storeName(s: Store | null, field: string): string {
  if (!s) return "—";
  return (s[field as keyof Store] as string | null) ?? s.name_vi;
}

export default async function CashPage() {
  const profile = await requireRole("/cash");
  const readOnly = isReadOnly(profile.role);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  const [{ data: stores }, { data: movements }, cashBal] = await Promise.all([
    supabase.from("stores").select("id, code, name_vi, name_ja, name_en").eq("active", true).order("sort_order"),
    supabase
      .from("cash_movements")
      .select("id, move_date, store_id, direction, category, amount, note, ref_table, stores(name_vi, name_ja, name_en)")
      .order("move_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(80),
    // Balance is summed in SQL (no row cap) — see migration 0013 / lib/finance.ts
    getCashBalance(supabase),
  ]);

  const balanceByStore = cashBal.byStore;
  const totalCash = cashBal.total;
  const generalBal = cashBal.general;
  const f = dict.finance;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.nav.cash}</h1>

      {/* Balance summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <Card className="col-span-2 sm:col-span-1 bg-zinc-900 text-white border-0">
          <CardContent>
            <div className="text-xs text-zinc-400">{dict.dashboard.totalCash}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{formatYen(totalCash)}</div>
          </CardContent>
        </Card>
        {generalBal !== 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent>
              <div className="text-xs text-blue-600">Quỹ chung</div>
              <div className={`mt-1 text-xl font-semibold tabular-nums ${generalBal < 0 ? "text-red-600" : "text-blue-900"}`}>
                {formatYen(generalBal)}
              </div>
            </CardContent>
          </Card>
        )}
        {(stores ?? []).map((s) => {
          const bal = balanceByStore[s.id] ?? 0;
          return (
            <Card key={s.id}>
              <CardContent>
                <div className="text-xs text-zinc-500">{storeName(s, nameField)}</div>
                <div className={`mt-1 text-xl font-semibold tabular-nums ${bal < 0 ? "text-red-600" : "text-zinc-900"}`}>
                  {formatYen(bal)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <BreakdownCard
        title={f.balanceBreakdown}
        formula={f.cashFormula}
        items={cashBal.lines.map((l) => ({ label: f[`cash_${l.key}` as keyof typeof f] ?? f.other, amount: l.amount }))}
        totalLabel={dict.dashboard.totalCash}
        total={totalCash}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        {!readOnly && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  {dict.cash.newMovement}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CashForm
                  dict={dict}
                  stores={(stores ?? []).map((s) => ({ id: s.id, name: storeName(s, nameField) }))}
                  profile={{ role: profile.role, store_id: profile.store_id, id: profile.id }}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ledger */}
        <div className={readOnly ? "lg:col-span-5" : "lg:col-span-3"}>
          <Card>
            <CardHeader><CardTitle>{dict.cash.ledger}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">{dict.common.date}</th>
                      <th className="px-4 py-2.5 text-left">{dict.common.store}</th>
                      <th className="px-4 py-2.5 text-left">{dict.cash.category}</th>
                      <th className="px-4 py-2.5 text-left">{dict.common.notes}</th>
                      <th className="px-4 py-2.5 text-right">{dict.cash.amount}</th>
                      {!readOnly && <th className="px-4 py-2.5 w-20"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(!movements || movements.length === 0) && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{dict.common.empty}</td></tr>
                    )}
                    {(movements ?? []).map((m) => {
                      const s = m.stores as unknown as Store | null;
                      const isIn = m.direction === "in";
                      const catKey = `cat_${m.category}` as keyof typeof dict.cash;
                      const catLabel = (dict.cash[catKey] as string | undefined) ?? m.category;
                      return (
                        <tr key={m.id} className={`hover:bg-zinc-50 ${m.ref_table ? "bg-zinc-50/50" : ""}`}>
                          <td className="px-4 py-2 tabular-nums text-zinc-700">{m.move_date}</td>
                          <td className="px-4 py-2 text-zinc-600">{m.store_id ? storeName(s, nameField) : "Quỹ chung"}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs rounded px-1.5 py-0.5 ${isIn ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {catLabel}
                            </span>
                            {m.ref_table && (
                              <span className="ml-1 text-xs rounded px-1 py-0.5 bg-zinc-100 text-zinc-400">
                                {dict.cash.autoEntry}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-zinc-500 text-xs max-w-[120px] truncate">{m.note ?? ""}</td>
                          <td className={`px-4 py-2 text-right font-semibold tabular-nums ${isIn ? "text-emerald-700" : "text-red-600"}`}>
                            {isIn ? "+" : "−"}{formatYen(m.amount)}
                          </td>
                          {!readOnly && (
                            <td className="px-4 py-2">
                              <CashRowActions
                                row={{ id: m.id, move_date: m.move_date, store_id: m.store_id ?? null, direction: m.direction as "in" | "out", category: m.category, amount: m.amount, note: m.note ?? null, ref_table: m.ref_table ?? null }}
                                stores={(stores ?? []).map((s) => ({ id: s.id, name: storeName(s, nameField) }))}
                                dict={dict}
                              />
                            </td>
                          )}
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
