"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function FixedExpenseAdd() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [nameVi, setNameVi] = useState("");
  const [nameJa, setNameJa] = useState("");
  const [amount, setAmount] = useState("");

  const reset = () => { setNameVi(""); setNameJa(""); setAmount(""); setOpen(false); };

  const handleAdd = () => {
    const val = Math.round(Number(amount));
    if (!nameVi.trim() || !val || val <= 0) return;
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("fixed_expenses").insert({
        name_vi: nameVi.trim(),
        name_ja: nameJa.trim() || null,
        amount: val,
        active: true,
      });
      reset();
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
        + Thêm chi phí
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Tên (VI) *</label>
        <input
          type="text"
          value={nameVi}
          onChange={(e) => setNameVi(e.target.value)}
          placeholder="vd: Tiền thuê mặt bằng"
          autoFocus
          className="w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Tên (JA)</label>
        <input
          type="text"
          value={nameJa}
          onChange={(e) => setNameJa(e.target.value)}
          placeholder="vd: 家賃"
          className="w-32 rounded border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Số tiền (¥) *</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") reset(); }}
          className="w-32 rounded border border-zinc-300 px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button onClick={handleAdd} disabled={pending}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
        Thêm
      </button>
      <button onClick={reset}
        className="rounded border px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
        Hủy
      </button>
    </div>
  );
}
