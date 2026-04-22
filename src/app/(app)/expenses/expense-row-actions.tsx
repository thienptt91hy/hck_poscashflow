"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

const CATEGORIES = ["食材・仕入", "日用品", "交通費", "設備", "その他"];

interface Row {
  id: string;
  expense_date: string;
  store_id: string | null;
  category: string;
  amount: number;
  paid_from: "cash" | "bank";
  note: string | null;
}

export function ExpenseRowActions({ row, stores, dict }: {
  row: Row;
  stores: { id: string; name: string }[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);

  const isCustom = !CATEGORIES.includes(row.category);
  const [date, setDate] = useState(row.expense_date);
  const [storeId, setStoreId] = useState(row.store_id ?? "");
  const [category, setCategory] = useState(isCustom ? "その他" : row.category);
  const [customCat, setCustomCat] = useState(isCustom ? row.category : "");
  const [amount, setAmount] = useState(String(row.amount));
  const [paidFrom, setPaidFrom] = useState<"cash" | "bank">(row.paid_from);
  const [note, setNote] = useState(row.note ?? "");

  const openEdit = () => {
    const custom = !CATEGORIES.includes(row.category);
    setDate(row.expense_date); setStoreId(row.store_id ?? "");
    setCategory(custom ? "その他" : row.category);
    setCustomCat(custom ? row.category : "");
    setAmount(String(row.amount)); setPaidFrom(row.paid_from); setNote(row.note ?? "");
    setShowEdit(true);
  };

  const handleUpdate = () => {
    const val = Math.round(Number(amount));
    if (!val || val <= 0) return;
    const finalCat = category === "その他" && customCat ? customCat : category;
    startTransition(async () => {
      await createClient().from("variable_expenses").update({
        expense_date: date, store_id: storeId || null,
        category: finalCat, amount: val,
        paid_from: paidFrom, note: note || null,
      }).eq("id", row.id);
      setShowEdit(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await createClient().from("variable_expenses").delete().eq("id", row.id);
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
            <p className="text-sm text-zinc-500 mb-5">Xoá chi phí ngày <strong>{row.expense_date}</strong>? Không thể hoàn tác.</p>
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
              <h3 className="text-lg font-semibold">Sửa chi phí phát sinh</h3>
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
                    <option value="">— Chung —</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.expenses.category}</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {category === "その他" && (
                  <input value={customCat} onChange={(e) => setCustomCat(e.target.value)}
                    placeholder="Nhập danh mục..."
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.common.amount}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 pl-7 pr-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.expenses.paidFrom}</label>
                <div className="flex rounded-md overflow-hidden border border-zinc-300">
                  {(["cash", "bank"] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPaidFrom(p)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${paidFrom === p ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>
                      {p === "cash" ? "💵 " + dict.expenses.paidFromCash : "🏦 " + dict.expenses.paidFromBank}
                    </button>
                  ))}
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
