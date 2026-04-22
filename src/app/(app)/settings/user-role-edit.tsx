"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserRole } from "@/lib/supabase/types";

const ROLES: UserRole[] = ["admin", "manager", "staff"];

export function UserRoleEdit({
  userId,
  currentRole,
  currentStoreId,
  currentFullName,
  stores,
  dict,
}: {
  userId: string;
  currentRole: UserRole;
  currentStoreId: string;
  currentFullName: string | null;
  stores: { id: string; name: string }[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(currentRole);
  const [storeId, setStoreId] = useState(currentStoreId);
  const [fullName, setFullName] = useState(currentFullName ?? "");
  const [error, setError] = useState<string | null>(null);

  const roleKey = (r: string) => `role_${r}` as keyof typeof dict.settings;

  const openModal = () => {
    setRole(currentRole);
    setStoreId(currentStoreId);
    setFullName(currentFullName ?? "");
    setError(null);
    setOpen(true);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.from("user_profiles").update({
        full_name: fullName.trim() || null,
        role,
        store_id: storeId || null,
      }).eq("id", userId);
      if (err) { setError(err.message); return; }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={openModal}
        className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
      >
        ✏️ {dict.common.edit}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Sửa người dùng</h3>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.common.name}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  autoFocus
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.settings.userRole}</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {(dict.settings[roleKey(r)] as string | undefined) ?? r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.settings.assignStore}</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Chung —</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                {dict.common.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={pending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? dict.common.saving : "💾 " + dict.common.update}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
