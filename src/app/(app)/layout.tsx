import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Sidebar } from "@/components/sidebar";
import { LogOut } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role, store_id")
    .eq("id", user.id)
    .single();

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-screen">
      <Sidebar dict={dict} role={profile?.role ?? "staff"} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
          <div className="text-sm text-zinc-600">
            {profile?.full_name ?? profile?.email ?? user.email}
            <span className="mx-2 text-zinc-300">·</span>
            <span className="capitalize">{profile?.role ?? "staff"}</span>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher currentLocale={locale} />
            <form action="/auth/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                title={dict.nav.logout}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{dict.nav.logout}</span>
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
