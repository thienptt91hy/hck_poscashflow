"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NO_STORE_ROLES, type UserRole } from "@/lib/permissions";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * These actions run with the service-role key, so they MUST verify that the
 * caller is an admin themselves — RLS does not apply to the service role.
 */
async function assertCallerIsAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { ok: false, error: "Forbidden" };

  return { ok: true, userId: user.id };
}

export async function actionCreateUser(data: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  storeId: string;
}): Promise<{ error: string | null }> {
  const auth = await assertCallerIsAdmin();
  if (!auth.ok) return { error: auth.error };

  const admin = adminClient();

  // Accountant is never tied to a store.
  const storeId = NO_STORE_ROLES.includes(data.role) ? null : data.storeId || null;

  // Accountant (税理士) is Japanese: default the UI to JA on first login.
  const userMeta: Record<string, string> = { full_name: data.fullName || data.email };
  if (data.role === "accountant") userMeta.locale = "ja";

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: userMeta,
  });
  if (authError) return { error: authError.message };

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: authData.user.id,
    email: data.email,
    full_name: data.fullName || null,
    role: data.role,
    store_id: storeId,
    active: true,
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/settings");
  return { error: null };
}

export async function actionDeleteUser(userId: string): Promise<{ error: string | null }> {
  const auth = await assertCallerIsAdmin();
  if (!auth.ok) return { error: auth.error };
  if (auth.userId === userId) return { error: "Cannot delete your own account" };

  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}
