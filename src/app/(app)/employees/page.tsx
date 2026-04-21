import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeForm } from "./employee-form";
import { PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type Store = { id: string; name_vi: string; name_ja: string | null; name_en: string | null };

export default async function EmployeesPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  const [{ data: stores }, { data: employees }] = await Promise.all([
    supabase.from("stores").select("id, name_vi, name_ja, name_en").eq("active", true).order("sort_order"),
    supabase
      .from("employees")
      .select("id, name, store_id, position, active, stores(name_vi, name_ja, name_en)")
      .order("active", { ascending: false })
      .order("name"),
  ]);

  const sName = (s: Store | null) => (s?.[nameField as "name_vi"] as string | null) ?? s?.name_vi ?? "—";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{dict.employees.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />{dict.employees.addEmployee}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeForm
                dict={dict}
                stores={(stores ?? []).map((s) => ({ id: s.id, name: sName(s) }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader><CardTitle>{dict.employees.title}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{dict.common.name}</th>
                    <th className="px-4 py-2.5 text-left">{dict.common.store}</th>
                    <th className="px-4 py-2.5 text-left">{dict.employees.position}</th>
                    <th className="px-4 py-2.5 text-left">{dict.employees.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(!employees || employees.length === 0) && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400">{dict.common.empty}</td></tr>
                  )}
                  {(employees ?? []).map((emp) => {
                    const s = emp.stores as unknown as Store | null;
                    return (
                      <tr key={emp.id} className={`hover:bg-zinc-50 ${!emp.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-2.5 font-medium">{emp.name}</td>
                        <td className="px-4 py-2.5 text-zinc-600">{sName(s)}</td>
                        <td className="px-4 py-2.5 text-zinc-500 text-xs">{emp.position ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs rounded px-1.5 py-0.5 ${emp.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                            {emp.active ? dict.common.active : dict.common.inactive}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
