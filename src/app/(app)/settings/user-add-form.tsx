"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateUser } from "./user-actions";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserRole } from "@/lib/supabase/types";

const ROLES: UserRole[] = ["admin", "manager", "staff"];

export function UserAddForm({
  stores,
  dict,
}: {
  stores: { id: string; name: string }[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [storeId, setStoreId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail(""); setPassword(""); setFullName("");
    setRole("staff"); setStoreId(""); setError(null); setOpen(false);
  };

  const handleAdd = () => {
    if (!email.trim() || !password) { setError("Email và mật khẩu bắt buộc"); return; }
    if (password.length < 6) { setError("Mật khẩu tối thiểu 6 ký tự"); return; }
    setError(null);
    startTransition(async () => {
      const result = await actionCreateUser({ email: email.trim(), password, fullName, role, storeId });
      if (result.error) { setError(result.error); return; }
      reset();
      router.refresh();
    });
  };

  const roleKey = (r: string) => `role_${r}` as keyof typeof dict.settings;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
      >
        + {dict.settings.addUser}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={reset}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">👤 Thêm người dùng</h3>
          <button onClick={reset} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoFocus
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700">Mật khẩu *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700">Tên đầy đủ</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 flex gap-2 justify-end">
          <button onClick={reset} className="rounded-lg border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
            {dict.common.cancel}
          </button>
          <button
            onClick={handleAdd}
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Đang tạo..." : "✅ Tạo tài khoản"}
          </button>
        </div>
      </div>
    </div>
  );
}
