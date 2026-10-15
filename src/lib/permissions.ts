/**
 * Single source of truth for app-side authorization.
 *
 * The real wall is Supabase RLS (see supabase/migrations/0012_accountant_rls.sql).
 * Everything here only decides what the UI renders and which routes redirect.
 */

export type UserRole = "admin" | "manager" | "staff" | "accountant";

export const ALL_ROLES: UserRole[] = ["admin", "manager", "staff", "accountant"];

/** Roles that may never create / edit / delete anything. */
export const READ_ONLY_ROLES: UserRole[] = ["accountant"];

export const isReadOnly = (role: UserRole): boolean => READ_ONLY_ROLES.includes(role);
export const canWrite = (role: UserRole): boolean => !isReadOnly(role);

/**
 * Roles whose store_id is forced to null (no "assigned store" field in the UI).
 * admin / manager are intentionally NOT listed: existing accounts may carry a
 * store_id and we don't change that behaviour here.
 */
export const NO_STORE_ROLES: UserRole[] = ["accountant"];

/**
 * Which roles may open each route. Used by Sidebar, MobileNav and requireRole().
 * Keys are matched by `pathname === key || pathname.startsWith(key + "/")`,
 * longest key first, so "/sales/new" wins over "/sales".
 */
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/dashboard": ["admin", "manager", "accountant"],
  "/sales/new": ["admin", "manager", "staff"],
  "/sales": ["admin", "manager", "staff", "accountant"],
  "/cash": ["admin", "manager", "staff", "accountant"],
  "/bank": ["admin", "manager", "accountant"],
  "/expenses": ["admin", "manager", "accountant"],
  "/employees": ["admin", "manager", "accountant"],
  "/wholesale": ["admin", "manager", "accountant"],
  "/salary": ["admin", "accountant"],
  "/reports": ["admin", "manager", "accountant"],
  "/settings": ["admin"],
};

const ROUTE_KEYS = Object.keys(ROUTE_ROLES).sort((a, b) => b.length - a.length);

export function rolesForPath(pathname: string): UserRole[] | undefined {
  const key = ROUTE_KEYS.find((k) => pathname === k || pathname.startsWith(k + "/"));
  return key ? ROUTE_ROLES[key] : undefined;
}

export function canAccess(role: UserRole, pathname: string): boolean {
  const roles = rolesForPath(pathname);
  return roles ? roles.includes(role) : true;
}

/** Where to send a user who is not allowed on the requested page. */
export function homeFor(role: UserRole): string {
  return canAccess(role, "/dashboard") ? "/dashboard" : "/sales";
}
