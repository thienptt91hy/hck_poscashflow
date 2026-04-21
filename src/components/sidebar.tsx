"use client";

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

export function Sidebar({ dict, role }: { dict: Dictionary; role: UserRole }) {
  const pathname = usePathname();

  const visible = NAV.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="h-14 flex items-center px-5 border-b border-zinc-200">
        <span className="text-lg font-semibold text-zinc-900">{dict.app.name}</span>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {visible.map(({ href, labelKey, icon: Icon, exact }) => {
          const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-zinc-700 hover:bg-zinc-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {dict.nav[labelKey]}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
