import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { SalesForm } from "./sales-form";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const [{ data: profile }, { data: stores }, { data: employees }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, role, store_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("stores")
      .select("id, code, name_vi, name_ja, name_en, has_cafe_bakery")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("employees")
      .select("id, name, store_id")
      .eq("active", true)
      .order("name"),
  ]);

  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-5 text-2xl font-bold text-zinc-900">{dict.sales.newEntry}</h1>
      <SalesForm
        dict={dict}
        profile={profile ?? { role: "staff", store_id: null, id: user.id }}
        stores={(stores ?? []).map((s) => ({
          id: s.id,
          code: s.code,
          name: (s[nameField as "name_vi"] as string) ?? s.name_vi,
          has_cafe_bakery: s.has_cafe_bakery,
        }))}
        employees={employees ?? []}
      />
    </div>
  );
}
