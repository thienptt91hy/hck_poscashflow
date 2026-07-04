"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

interface Store {
  id: string;
  name: string;
  has_cafe_bakery: boolean;
}

interface SaleRow {
  id: string;
  sale_date: string;
  store_id: string;
  revenue_stream: string;
  customer_count: number;
  cash: number;
  qr_card: number;
  bank_transfer: number;
  cash_expense_items: { amount: number; note: string | null }[];
  notes: string | null;
}

export function SalesRowActions({
  row,
  stores,
  dict,
}: {
  row: SaleRow;
  stores: Store[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [saleDate, setSaleDate] = useState(row.sale_date);
  const [storeId, setStoreId] = useState(row.store_id);
  const [revenueStream, setRevenueStream] = useState(row.revenue_stream);
  const [customerCount, setCustomerCount] = useState(String(row.customer_count));
  const [cash, setCash] = useState(String(row.cash));
  const [qrCard, setQrCard] = useState(String(row.qr_card));
  const [bankTransfer, setBankTransfer] = useState(String(row.bank_transfer));
  const [cashItems, setCashItems] = useState<{ note: string; amount: string }[]>(
    (row.cash_expense_items ?? []).map((it) => ({ note: it.note ?? "", amount: String(it.amount) })),
  );
  const [notes, setNotes] = useState(row.notes ?? "");

  const addCashItem = () => setCashItems((p) => [...p, { note: "", amount: "" }]);
  const removeCashItem = (i: number) => setCashItems((p) => p.filter((_, idx) => idx !== i));
  const updateCashItem = (i: number, field: "note" | "amount", val: string) =>
    setCashItems((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));

  const selectedStore = stores.find((s) => s.id === storeId);
  const total = useMemo(
    () =>
      (Number(cash) || 0) +
      (Number(qrCard) || 0) +
      (Number(bankTransfer) || 0) +
      cashItems.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    [cash, qrCard, bankTransfer, cashItems],
  );

  const openEdit = () => {
    setSaleDate(row.sale_date);
    setStoreId(row.store_id);
    setRevenueStream(row.revenue_stream);
    setCustomerCount(String(row.customer_count));
    setCash(String(row.cash));
    setQrCard(String(row.qr_card));
    setBankTransfer(String(row.bank_transfer));
    setCashItems((row.cash_expense_items ?? []).map((it) => ({ note: it.note ?? "", amount: String(it.amount) })));
    setNotes(row.notes ?? "");
    setShowEdit(true);
  };

  const handleUpdate = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("daily_sales").update({
        sale_date: saleDate,
        store_id: storeId,
        revenue_stream: revenueStream,
        customer_count: Number(customerCount) || 0,
        cash: Number(cash) || 0,
        qr_card: Number(qrCard) || 0,
        bank_transfer: Number(bankTransfer) || 0,
        cash_expense_items: cashItems
          .filter((it) => (Number(it.amount) || 0) > 0)
          .map((it) => ({ amount: Number(it.amount) || 0, note: it.note.trim() || null })),
        notes: notes || null,
      }).eq("id", row.id);
      setShowEdit(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    setDeleteError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error, count } = await supabase
        .from("daily_sales").delete({ count: "exact" }).eq("id", row.id);
      if (error) { setDeleteError(error.message); return; }
      if (count === 0) { setDeleteError("Không có quyền xóa. Liên hệ Admin."); return; }
      setShowDelete(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center gap-1 justify-center">
        <button
          onClick={openEdit}
          className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
        >
          ✏️
        </button>
        <button
          onClick={() => setShowDelete(true)}
          className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
        >
          🗑️
        </button>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowDelete(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900 mb-1">Xác nhận xoá</h3>
            <p className="text-sm text-zinc-500 mb-5">
              Xoá doanh thu ngày <strong className="text-zinc-800">{row.sale_date}</strong>?
              <br />Thao tác này không thể hoàn tác.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowDelete(false); setDeleteError(null); }}
                className="rounded-lg border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                {dict.common.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Đang xoá..." : "🗑️ Xoá"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Sửa doanh thu</h3>
              <button onClick={() => setShowEdit(false)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.common.date}</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.common.store}</label>
                  <select
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {selectedStore?.has_cafe_bakery && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.sales.revenueStream}</label>
                  <select
                    value={revenueStream}
                    onChange={(e) => setRevenueStream(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="main">{dict.sales.streamMain}</option>
                    <option value="cafe_bakery">{dict.sales.streamCafe}</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.sales.customerCount}</label>
                <input
                  type="number"
                  value={customerCount}
                  onChange={(e) => setCustomerCount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                {([
                  { label: "💵 " + dict.sales.cash, value: cash, setter: setCash, color: "text-emerald-700" },
                  { label: "💳 " + dict.sales.qrCard, value: qrCard, setter: setQrCard, color: "text-blue-700" },
                  { label: "🏦 " + dict.sales.bankTransfer, value: bankTransfer, setter: setBankTransfer, color: "text-violet-700" },
                ] as const).map(({ label, value, setter, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`w-36 text-xs font-medium shrink-0 ${color}`}>{label}</span>
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-2 flex items-center text-zinc-400 text-xs">¥</span>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="w-full rounded border border-zinc-300 pl-5 pr-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}

                <div className="space-y-2 border-t border-zinc-200 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-700">🛒 {dict.sales.cashExpense}</span>
                    <button type="button" onClick={addCashItem} className="text-xs font-medium text-amber-700 hover:underline">
                      + {dict.sales.cashExpenseAdd}
                    </button>
                  </div>
                  {cashItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={it.note}
                        onChange={(e) => updateCashItem(i, "note", e.target.value)}
                        placeholder={dict.sales.cashExpenseNotePlaceholder}
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="relative w-24">
                        <span className="absolute inset-y-0 left-2 flex items-center text-zinc-400 text-xs">¥</span>
                        <input
                          type="number"
                          value={it.amount}
                          onChange={(e) => updateCashItem(i, "amount", e.target.value)}
                          className="w-full rounded border border-zinc-300 pl-5 pr-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <button type="button" onClick={() => removeCashItem(i)} className="px-1 text-zinc-400 hover:text-red-500" aria-label="remove">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3 text-white">
                <span className="text-xs text-zinc-400">{dict.sales.totalRevenue}</span>
                <span className="text-xl font-bold tabular-nums">¥{total.toLocaleString("en-US")}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">{dict.common.notes}</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 flex gap-2 justify-end">
              <button
                onClick={() => setShowEdit(false)}
                className="rounded-lg border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                {dict.common.cancel}
              </button>
              <button
                onClick={handleUpdate}
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
