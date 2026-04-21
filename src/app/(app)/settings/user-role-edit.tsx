"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserRole } from "@/lib/supabase/types";

const ROLES: UserRole[] = ["admin", "manager", "staff"];

export function UserRoleEdit({
  userId, currentRole, currentStoreId, stores, dict,
}: {
  userId: string;
  currentRole: UserRole;
  currentStoreId: string;
  stores: { id: string; name: string }[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<UserRole>(currentRole);
  const [storeId, setStoreId] = useState(currentStoreId);

  const roleKey = (r: string) => `role_${r}` as keyof typeof dict.settings;

  const handleSave = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("user_profiles").update({
        role,
        store_id: storeId || null,
      }).eq("id", userId);
      setEditing(false);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 items-start text-left min-w-[180px]">
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs">
          {ROLES.map((r) => <option key={r} value={r}>{(dict.settings[roleKey(r)] as string | undefined) ?? r}</option>)}
        </select>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs">
          <option value="">— {dict.settings.assignStore} —</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={pending}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
            {dict.common.update}
          </button>
          <button onClick={() => setEditing(false)}
            className="rounded border px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
            {dict.common.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)}
      className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
      ✏️ {dict.common.edit}
    </button>
  );
}
