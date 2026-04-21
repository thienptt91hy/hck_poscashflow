"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

export function FixedExpenseEdit({ id, currentAmount, dict }: { id: string; currentAmount: number; dict: Dictionary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(currentAmount));

  const handleSave = () => {
    const val = Math.round(Number(amount));
    if (!val || val <= 0) { setEditing(false); return; }
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("fixed_expenses").update({ amount: val }).eq("id", id);
      setEditing(false);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <span className="text-zinc-400 text-xs">¥</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded border border-blue-300 px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
        />
        <button onClick={handleSave} disabled={pending}
          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
          {dict.common.save}
        </button>
        <button onClick={() => setEditing(false)} className="rounded border px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
          ✕
        </button>
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
