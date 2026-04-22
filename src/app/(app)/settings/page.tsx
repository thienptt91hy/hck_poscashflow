import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FixedExpenseEdit } from "./fixed-expense-edit";
import { FixedExpenseAdd } from "./fixed-expense-add";
import { UserRoleEdit } from "./user-role-edit";
import { UserAddForm } from "./user-add-form";
import { UserDeleteButton } from "./user-delete-button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: fixedExp }, { data: stores }, { data: users }] = await Promise.all([
    supabase.from("fixed_expenses").select("id, name_vi, name_ja, amount, active").order("name_vi"),
    supabase.from("stores").select("id, name_vi, name_ja, name_en").order("sort_order"),
    supabase.from("user_profiles").select("id, email, full_name, role, store_id, active").order("role"),
  ]);

  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";
  const storeOpts = (stores ?? []).map((s) => ({
    id: s.id,
    name: (s[nameField as "name_vi"] as string | null) ?? s.name_vi,
  }));

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.settings.title}</h1>

      {/* Fixed expenses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>📌 {dict.settings.fixedExpenses}</CardTitle>
          <FixedExpenseAdd />
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 text-left">VI</th>
                <th className="px-4 py-2.5 text-left">JA</th>
                <th className="px-4 py-2.5 text-right">{dict.common.amount}</th>
                <th className="px-4 py-2.5 text-center">{dict.common.edit}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(fixedExp ?? []).map((f) => (
                <tr key={f.id} className={`hover:bg-zinc-50 ${!f.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5">{f.name_vi}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{f.name_ja ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-600">{formatYen(f.amount)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <FixedExpenseEdit
                      id={f.id}
                      currentAmount={f.amount}
                      currentNameVi={f.name_vi}
                      currentNameJa={f.name_ja ?? null}
                      dict={dict}
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-50 font-semibold">
                <td className="px-4 py-2.5">合計 / Tổng</td>
                <td /><td />
                <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                  {formatYen((fixedExp ?? []).filter((f) => f.active).reduce((s, f) => s + f.amount, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* User management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>👥 {dict.settings.users}</CardTitle>
          <UserAddForm stores={storeOpts} dict={dict} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Email</th>
                  <th className="px-4 py-2.5 text-left">{dict.common.name}</th>
                  <th className="px-4 py-2.5 text-left">{dict.settings.userRole}</th>
                  <th className="px-4 py-2.5 text-left">{dict.settings.assignStore}</th>
                  <th className="px-4 py-2.5 text-center">{dict.common.edit} / Xoá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(users ?? []).map((u) => {
                  const assignedStore = (stores ?? []).find((s) => s.id === u.store_id);
                  const storeLbl = assignedStore
                    ? ((assignedStore[nameField as "name_vi"] as string | null) ?? assignedStore.name_vi)
                    : "—";
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className={`hover:bg-zinc-50 ${!u.active ? "opacity-50" : ""}`}>
                      <td className="px-4 py-2.5 text-zinc-600 text-xs">
                        {u.email}
                        {isSelf && (
                          <span className="ml-1.5 rounded bg-blue-100 px-1 py-0.5 text-xs text-blue-600">bạn</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{u.full_name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs rounded px-1.5 py-0.5 ${
                          u.role === "admin" ? "bg-purple-100 text-purple-700"
                          : u.role === "manager" ? "bg-blue-100 text-blue-700"
                          : "bg-zinc-100 text-zinc-600"
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{storeLbl}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <UserRoleEdit
                            userId={u.id}
                            currentRole={u.role}
                            currentStoreId={u.store_id ?? ""}
                            currentFullName={u.full_name ?? null}
                            stores={storeOpts}
                            dict={dict}
                          />
                          <UserDeleteButton
                            userId={u.id}
                            email={u.email}
                            isSelf={isSelf}
                          />
                        </div>
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
  );
}
