"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserRole } from "@/lib/supabase/types";

interface Row {
  id: string;
  name: string;
  store_id: string;
  position: string | null;
  active: boolean;
}

export function EmployeeRowActions({ row, stores, dict, role }: {
  row: Row;
  stores: { id: string; name: string }[];
  dict: Dictionary;
  role: UserRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);

  const [name, setName] = useState(row.name);
  const [storeId, setStoreId] = useState(row.store_id);
  const [position, setPosition] = useState(row.position ?? "");
  const [active, setActive] = useState(row.active);

  if (role !== "admin") return null;

  const openEdit = () => {
    setName(row.name); setStoreId(row.store_id);
    setPosition(row.position ?? ""); setActive(row.active);
    setShowEdit(true);
  };

  const handleUpdate = () => {
    if (!name.trim() || !storeId) return;
    startTransition(async () => {
      await createClient().from("employees").update({
        name: name.trim(), store_id: storeId,
        position: position || null, active,
      }).eq("id", row.id);
      setShowEdit(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await createClient().from("employees").delete().eq("id", row.id);
      setShowDel(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center gap-1 justify-center">
        <button onClick={openEdit} className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100">✏️</button>
        <button onClick={() => setShowDel(true)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50">🗑️</button>
      </div>

      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDel(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Xác nhận xoá</h3>
            <p className="text-sm text-zinc-500 mb-5">Xoá nhân viên <strong>{row.name}</strong>? Không thể hoàn tác.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDel(false)} className="rounded-lg border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">{dict.common.cancel}</button>
              <button onClick={handleDelete} disabled={pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                {pending ? "Đang xoá..." : "🗑️ Xoá"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sửa nhân viên</h3>
              <button onClick={() => setShowEdit(false)} className="text-zinc-400 hover:text-zinc-700 text-xl">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.common.name} *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.common.store} *</label>
                <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.employees.position}</label>
                <input value={position} onChange={(e) => setPosition(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
                <span>{dict.common.active}</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 flex gap-2 justify-end">
              <button onClick={() => setShowEdit(false)} className="rounded-lg border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">{dict.common.cancel}</button>
              <button onClick={handleUpdate} disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                {pending ? dict.common.saving : "💾 " + dict.common.update}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
