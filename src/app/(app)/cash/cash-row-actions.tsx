"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

const IN_CATS = ["sales", "other"] as const;
const OUT_CATS = ["cod", "purchase", "staff_take", "deposit_to_bank", "adjust", "other"] as const;

interface Row {
  id: string;
  move_date: string;
  store_id: string | null;
  direction: "in" | "out";
  category: string;
  amount: number;
  note: string | null;
  ref_table: string | null;
}

export function CashRowActions({ row, stores, dict }: {
  row: Row;
  stores: { id: string; name: string }[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);

  const [date, setDate] = useState(row.move_date);
  const [storeId, setStoreId] = useState(row.store_id ?? stores[0]?.id ?? "");
  const [direction, setDirection] = useState<"in" | "out">(row.direction);
  const [category, setCategory] = useState(row.category);
  const [amount, setAmount] = useState(String(row.amount));
  const [note, setNote] = useState(row.note ?? "");

  const cats = direction === "in" ? IN_CATS : OUT_CATS;
  const catKey = (c: string) => `cat_${c}` as keyof typeof dict.cash;

  const openEdit = () => {
    const dir = row.direction;
    const validCats = dir === "in" ? (IN_CATS as readonly string[]) : (OUT_CATS as readonly string[]);
    const cat = validCats.includes(row.category) ? row.category : (dir === "in" ? "sales" : "purchase");
    setDate(row.move_date); setStoreId(row.store_id ?? stores[0]?.id ?? ""); setDirection(dir);
    setCategory(cat); setAmount(String(row.amount)); setNote(row.note ?? "");
    setShowEdit(true);
  };

  const handleDirectionChange = (d: "in" | "out") => {
    setDirection(d);
    setCategory(d === "in" ? "sales" : "purchase");
  };

  const handleUpdate = () => {
    const val = Math.round(Number(amount));
    if (!val || val <= 0) return;
    startTransition(async () => {
      await createClient().from("cash_movements").update({
        move_date: date, store_id: storeId, direction, category,
        amount: val, note: note || null,
      }).eq("id", row.id);
      setShowEdit(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await createClient().from("cash_movements").delete().eq("id", row.id);
      setShowDel(false);
      router.refresh();
    });
  };

  if (row.ref_table) {
    return (
      <div className="text-center">
        <span className="text-xs text-zinc-300" title="Tự động từ giao dịch nguồn — sửa tại nguồn để cập nhật">🔒</span>
      </div>
    );
  }

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
            <p className="text-sm text-zinc-500 mb-5">Xoá giao dịch ngày <strong>{row.move_date}</strong>? Không thể hoàn tác.</p>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sửa giao dịch tiền mặt</h3>
              <button onClick={() => setShowEdit(false)} className="text-zinc-400 hover:text-zinc-700 text-xl">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.common.date}</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.common.store}</label>
                  <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.cash.direction}</label>
                <div className="flex rounded-md overflow-hidden border border-zinc-300">
                  {(["out", "in"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => handleDirectionChange(d)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${direction === d ? (d === "in" ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>
                      {d === "in" ? dict.cash.dirIn : dict.cash.dirOut}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.cash.category}</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {cats.map((c) => <option key={c} value={c}>{(dict.cash[catKey(c)] as string | undefined) ?? c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.cash.amount}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 pl-7 pr-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.common.notes}</label>
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
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
