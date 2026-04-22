import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
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
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <MobileNav dict={dict} role={profile?.role ?? "staff"} />
            {/* App name on mobile (sidebar hidden), user info on desktop */}
            <span className="text-sm font-semibold text-zinc-900 md:hidden truncate">
              {dict.app.name}
            </span>
            <div className="hidden md:block text-sm text-zinc-600 truncate">
              {profile?.full_name ?? profile?.email ?? user.email}
              <span className="mx-2 text-zinc-300">·</span>
              <span className="capitalize">{profile?.role ?? "staff"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LocaleSwitcher currentLocale={locale} />
            <form action="/auth/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 touch-manipulation"
                title={dict.nav.logout}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{dict.nav.logout}</span>
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
