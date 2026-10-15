import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccess, homeFor, type UserRole } from "@/lib/permissions";

export interface SessionProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  store_id: string | null;
}

/**
 * Current user + profile. Redirects to /login when not authenticated.
 * Missing profile row falls back to the least-privileged role ("staff").
 */
export async function getProfile(): Promise<SessionProfile> {
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

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    full_name: profile?.full_name ?? null,
    role: (profile?.role as UserRole | undefined) ?? "staff",
    store_id: profile?.store_id ?? null,
  };
}

/**
 * Server-side route guard. Call at the top of every (app)/ page.
 * Redirects to the role's home page when the role may not open `path`.
 */
export async function requireRole(path: string): Promise<SessionProfile> {
  const profile = await getProfile();
  if (!canAccess(profile.role, path)) redirect(homeFor(profile.role));
  return profile;
}
