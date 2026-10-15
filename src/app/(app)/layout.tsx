import { getProfile } from "@/lib/auth-server";
import { isReadOnly } from "@/lib/permissions";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { Eye, LogOut } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const readOnly = isReadOnly(profile.role);

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const roleLabel =
    (dict.settings[`role_${profile.role}` as keyof typeof dict.settings] as string | undefined) ??
    profile.role;

  return (
    <div className="flex min-h-screen">
      <Sidebar dict={dict} role={profile.role} />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <MobileNav dict={dict} role={profile.role} />
            {/* App name on mobile (sidebar hidden), user info on desktop */}
            <span className="text-sm font-semibold text-zinc-900 md:hidden truncate">
              {dict.app.name}
            </span>
            <div className="hidden md:block text-sm text-zinc-600 truncate">
              {profile.full_name ?? profile.email}
              <span className="mx-2 text-zinc-300">·</span>
              <span>{roleLabel}</span>
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
        {readOnly && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800 md:px-6">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span>{dict.common.readOnlyMode}</span>
          </div>
        )}
        <main className="flex-1 p-3 md:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
