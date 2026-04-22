"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

const METHODS = ["bank_transfer", "cash", "qr_card", "credit_card"] as const;

interface Row {
  id: string;
  sale_date: string;
  customer_company: string;
  amount: number;
  payment_method: string;
  paid: boolean;
  due_date: string | null;
  note: string | null;
}

export function WholesaleRowActions({ row, dict }: { row: Row; dict: Dictionary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);

  const [date, setDate] = useState(row.sale_date);
  const [company, setCompany] = useState(row.customer_company);
  const [amount, setAmount] = useState(String(row.amount));
  const [method, setMethod] = useState(row.payment_method);
  const [paid, setPaid] = useState(row.paid);
  const [dueDate, setDueDate] = useState(row.due_date ?? "");
  const [note, setNote] = useState(row.note ?? "");

  const mKey = (m: string) => `method_${m}` as keyof typeof dict.wholesale;

  const openEdit = () => {
    setDate(row.sale_date); setCompany(row.customer_company); setAmount(String(row.amount));
    setMethod(row.payment_method); setPaid(row.paid); setDueDate(row.due_date ?? ""); setNote(row.note ?? "");
    setShowEdit(true);
  };

  const handleUpdate = () => {
    const val = Math.round(Number(amount));
    if (!company.trim() || !val || val <= 0) return;
    startTransition(async () => {
      await createClient().from("wholesale_sales").update({
        sale_date: date, customer_company: company.trim(),
        amount: val, payment_method: method,
        store_id: null,
        paid, due_date: dueDate || null, note: note || null,
      }).eq("id", row.id);
      setShowEdit(false);
      router.refresh();
    });
  };

  const handleMarkPaid = () => {
    startTransition(async () => {
      await createClient().from("wholesale_sales").update({ paid: true }).eq("id", row.id);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await createClient().from("wholesale_sales").delete().eq("id", row.id);
      setShowDel(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center gap-1 justify-center flex-wrap">
        {!row.paid && (
          <button onClick={handleMarkPaid} disabled={pending}
            className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
            ✅ {dict.wholesale.markPaid}
          </button>
        )}
        <button onClick={openEdit} className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100">✏️</button>
        <button onClick={() => setShowDel(true)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50">🗑️</button>
      </div>

      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDel(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Xác nhận xoá</h3>
            <p className="text-sm text-zinc-500 mb-5">Xoá đơn bán sỉ <strong>{row.customer_company}</strong>? Không thể hoàn tác.</p>
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
              <h3 className="text-lg font-semibold">Sửa đơn bán sỉ</h3>
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
                  <label className="text-xs font-medium text-zinc-700">{dict.wholesale.dueDate}</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.wholesale.customer}</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                  <label className="text-xs font-medium text-zinc-700">{dict.wholesale.paymentMethod}</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {METHODS.map((m) => <option key={m} value={m}>{(dict.wholesale[mKey(m)] as string | undefined) ?? m}</option>)}
                  </select>
                </div>
              </div>
              {method === "cash" && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1.5">
                  💡 Tiền mặt bán sỉ sẽ vào <strong>Quỹ chung</strong>
                </p>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
                <span>{dict.wholesale.paid}</span>
              </label>
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
