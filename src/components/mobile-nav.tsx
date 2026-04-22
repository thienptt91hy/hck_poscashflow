"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  Wallet,
  Landmark,
  CreditCard,
  Users,
  Settings,
  Package,
  Banknote,
  FileBarChart2,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserRole } from "@/lib/supabase/types";

interface NavItem {
  href: string;
  labelKey: keyof Dictionary["nav"];
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, roles: ["admin", "manager"] },
  { href: "/sales/new", labelKey: "salesNew", icon: PlusCircle, exact: true },
  { href: "/sales", labelKey: "sales", icon: Receipt, exact: true },
  { href: "/cash", labelKey: "cash", icon: Wallet },
  { href: "/bank", labelKey: "bank", icon: Landmark, roles: ["admin", "manager"] },
  { href: "/expenses", labelKey: "expenses", icon: CreditCard, roles: ["admin", "manager"] },
  { href: "/employees", labelKey: "employees", icon: Users, roles: ["admin", "manager"] },
  { href: "/wholesale", labelKey: "wholesale", icon: Package, roles: ["admin", "manager"] },
  { href: "/salary", labelKey: "salary", icon: Banknote, roles: ["admin"] },
  { href: "/reports", labelKey: "reports", icon: FileBarChart2, roles: ["admin", "manager"] },
  { href: "/settings", labelKey: "settings", icon: Settings, roles: ["admin"] },
];

export function MobileNav({ dict, role }: { dict: Dictionary; role: UserRole }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const visible = NAV.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation"
        aria-label="Mở menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl md:hidden">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-5">
              <span className="text-base font-semibold text-zinc-900">{dict.app.name}</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {visible.map(({ href, labelKey, icon: Icon, exact }) => {
                const active =
                  exact
                    ? pathname === href
                    : pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors touch-manipulation",
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {dict.nav[labelKey]}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
