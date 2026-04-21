"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

export function FixedExpenseEdit({
  id, currentAmount, currentNameVi, currentNameJa, dict,
}: {
  id: string;
  currentAmount: number;
  currentNameVi: string;
  currentNameJa: string | null;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameVi, setNameVi] = useState(currentNameVi);
  const [nameJa, setNameJa] = useState(currentNameJa ?? "");
  const [amount, setAmount] = useState(String(currentAmount));

  const handleSave = () => {
    const val = Math.round(Number(amount));
    if (!nameVi.trim() || !val || val <= 0) { setEditing(false); return; }
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("fixed_expenses").update({
        name_vi: nameVi.trim(),
        name_ja: nameJa.trim() || null,
        amount: val,
      }).eq("id", id);
      setEditing(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("fixed_expenses").delete().eq("id", id);
      router.refresh();
    });
  };

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <span className="text-xs text-red-600 font-medium">Xóa?</span>
        <button onClick={handleDelete} disabled={pending}
          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">
          Xóa
        </button>
        <button onClick={() => setConfirmDelete(false)}
          className="rounded border px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
          Hủy
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[200px]">
        <input
          type="text"
          value={nameVi}
          onChange={(e) => setNameVi(e.target.value)}
          placeholder="Tên tiếng Việt *"
          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="text"
          value={nameJa}
          onChange={(e) => setNameJa(e.target.value)}
          placeholder="日本語名"
          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex items-center gap-1">
          <span className="text-zinc-400 text-xs">¥</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            className="w-full rounded border border-blue-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={pending}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
            {dict.common.save}
          </button>
          <button onClick={() => setEditing(false)}
            className="rounded border px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-center">
      <button onClick={() => setEditing(true)}
        className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
        ✏️ {dict.common.edit}
      </button>
      <button onClick={() => setConfirmDelete(true)}
        className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50">
        🗑️
      </button>
    </div>
  );
}
