"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/supabase/types";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function actionCreateUser(data: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  storeId: string;
}): Promise<{ error: string | null }> {
  const admin = adminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });
  if (authError) return { error: authError.message };

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: authData.user.id,
    email: data.email,
    full_name: data.fullName || null,
    role: data.role,
    store_id: data.storeId || null,
    active: true,
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/settings");
  return { error: null };
}

export async function actionDeleteUser(userId: string): Promise<{ error: string | null }> {
  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}
