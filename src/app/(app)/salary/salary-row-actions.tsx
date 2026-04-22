"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserRole } from "@/lib/supabase/types";

const METHODS = ["cash", "bank_transfer", "qr_card", "credit_card"] as const;

interface Row {
  id: string;
  period_month: string;
  employee_id: string;
  amount: number;
  payment_method: string;
  note: string | null;
}

export function SalaryRowActions({ row, employees, dict, role }: {
  row: Row;
  employees: { id: string; name: string; store_name: string }[];
  dict: Dictionary;
  role: UserRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);

  const [period, setPeriod] = useState(row.period_month.slice(0, 7));
  const [employeeId, setEmployeeId] = useState(row.employee_id);
  const [amount, setAmount] = useState(String(row.amount));
  const [method, setMethod] = useState(row.payment_method);
  const [note, setNote] = useState(row.note ?? "");

  const mKey = (m: string) => `method_${m}` as keyof typeof dict.salary;

  if (role !== "admin") return null;

  const openEdit = () => {
    setPeriod(row.period_month.slice(0, 7)); setEmployeeId(row.employee_id);
    setAmount(String(row.amount)); setMethod(row.payment_method); setNote(row.note ?? "");
    setShowEdit(true);
  };

  const handleUpdate = () => {
    const val = Math.round(Number(amount));
    if (!employeeId || !val || val <= 0) return;
    const emp = employees.find((e) => e.id === employeeId);
    startTransition(async () => {
      await createClient().from("salary_payments").update({
        period_month: period + "-01",
        employee_id: employeeId,
        amount: val,
        payment_method: method,
        note: note || null,
        ...(emp ? {} : {}),
      }).eq("id", row.id);
      setShowEdit(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await createClient().from("salary_payments").delete().eq("id", row.id);
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
            <p className="text-sm text-zinc-500 mb-5">Xoá bản ghi lương tháng <strong>{row.period_month.slice(0, 7)}</strong>? Không thể hoàn tác.</p>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sửa bản ghi lương</h3>
              <button onClick={() => setShowEdit(false)} className="text-zinc-400 hover:text-zinc-700 text-xl">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.salary.period}</label>
                  <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.common.employee}</label>
                  <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.store_name})</option>)}
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
                  <label className="text-xs font-medium text-zinc-700">{dict.salary.paymentMethod}</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {METHODS.map((m) => <option key={m} value={m}>{(dict.salary[mKey(m)] as string | undefined) ?? m}</option>)}
                  </select>
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
