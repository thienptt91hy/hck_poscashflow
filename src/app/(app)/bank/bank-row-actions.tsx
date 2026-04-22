"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

const IN_CATS = ["deposit_from_store", "other"] as const;
const OUT_CATS = ["purchase", "expense", "salary", "other"] as const;
const METHODS = ["bank_transfer", "credit_card", "cash", "qr_card"] as const;

interface Row {
  id: string;
  tx_date: string;
  direction: "in" | "out";
  category: string;
  payment_method: string;
  amount: number;
  fee: number;
  vendor: string | null;
  note: string | null;
}

export function BankRowActions({ row, dict }: { row: Row; dict: Dictionary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);

  const [date, setDate] = useState(row.tx_date);
  const [direction, setDirection] = useState<"in" | "out">(row.direction);
  const [category, setCategory] = useState(row.category);
  const [method, setMethod] = useState(row.payment_method);
  const [amount, setAmount] = useState(String(row.amount));
  const [fee, setFee] = useState(String(row.fee ?? 0));
  const [vendor, setVendor] = useState(row.vendor ?? "");
  const [note, setNote] = useState(row.note ?? "");

  const cats = direction === "in" ? IN_CATS : OUT_CATS;
  const catKey = (c: string) => `cat_${c}` as keyof typeof dict.bank;
  const mKey = (m: string) => `method_${m}` as keyof typeof dict.bank;

  const openEdit = () => {
    setDate(row.tx_date); setDirection(row.direction); setCategory(row.category);
    setMethod(row.payment_method); setAmount(String(row.amount)); setFee(String(row.fee ?? 0));
    setVendor(row.vendor ?? ""); setNote(row.note ?? "");
    setShowEdit(true);
  };

  const handleDirectionChange = (d: "in" | "out") => {
    setDirection(d);
    setCategory(d === "in" ? "deposit_from_store" : "purchase");
  };

  const handleUpdate = () => {
    const val = Math.round(Number(amount));
    if (!val || val <= 0) return;
    startTransition(async () => {
      await createClient().from("bank_transactions").update({
        tx_date: date, direction, category, payment_method: method,
        amount: val, fee: Math.round(Number(fee)) || 0,
        vendor: vendor || null, note: note || null,
      }).eq("id", row.id);
      setShowEdit(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await createClient().from("bank_transactions").delete().eq("id", row.id);
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
            <p className="text-sm text-zinc-500 mb-5">Xoá giao dịch ngày <strong>{row.tx_date}</strong>? Không thể hoàn tác.</p>
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
              <h3 className="text-lg font-semibold">Sửa giao dịch ngân hàng</h3>
              <button onClick={() => setShowEdit(false)} className="text-zinc-400 hover:text-zinc-700 text-xl">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.common.date}</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.bank.direction}</label>
                <div className="flex rounded-md overflow-hidden border border-zinc-300">
                  {(["in", "out"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => handleDirectionChange(d)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${direction === d ? (d === "in" ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>
                      {d === "in" ? dict.bank.dirIn : dict.bank.dirOut}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.bank.category}</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {cats.map((c) => <option key={c} value={c}>{(dict.bank[catKey(c)] as string | undefined) ?? c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.bank.paymentMethod}</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {METHODS.map((m) => <option key={m} value={m}>{(dict.bank[mKey(m)] as string | undefined) ?? m}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.common.amount}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 pl-7 pr-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.bank.fee}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
                    <input type="number" value={fee} onChange={(e) => setFee(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 pl-7 pr-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.bank.vendor}</label>
                <input value={vendor} onChange={(e) => setVendor(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
