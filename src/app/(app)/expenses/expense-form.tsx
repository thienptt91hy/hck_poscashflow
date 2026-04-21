"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { todayJST } from "@/lib/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserRole } from "@/lib/supabase/types";

const CATEGORIES = ["食材・仕入", "日用品", "交通費", "設備", "その他"];

export function ExpenseForm({
  dict,
  stores,
  profile,
}: {
  dict: Dictionary;
  stores: { id: string; name: string }[];
  profile: { id: string; role: UserRole; store_id: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isStaffLocked = profile.role === "staff";

  const [date, setDate] = useState(todayJST());
  const [storeId, setStoreId] = useState(isStaffLocked && profile.store_id ? profile.store_id : "");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [customCat, setCustomCat] = useState("");
  const [amount, setAmount] = useState("");
  const [paidFrom, setPaidFrom] = useState<"cash" | "bank">("cash");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalCategory = category === "その他" && customCat ? customCat : category;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!amount || Number(amount) <= 0) { setError(dict.common.error); return; }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("variable_expenses").insert({
        expense_date: date,
        store_id: storeId || null,
        category: finalCategory,
        amount: Math.round(Number(amount)),
        paid_from: paidFrom,
        note: note || null,
        created_by: profile.id,
      });
      if (error) { setError(error.message); return; }
      setSuccess(true);
      setAmount("");
      setNote("");
      setCustomCat("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>{dict.common.date}</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div className="space-y-1">
        <Label>{dict.common.store} (tuỳ chọn)</Label>
        <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={isStaffLocked}>
          <option value="">— Chung / 全体 —</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{dict.expenses.category}</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {category === "その他" && (
          <Input className="mt-1" value={customCat} onChange={(e) => setCustomCat(e.target.value)} placeholder="Nhập danh mục..." />
        )}
      </div>

      <div className="space-y-1">
        <Label>{dict.common.amount}</Label>
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
          <Input type="number" inputMode="numeric" min={1} value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0"
            className="pl-7 text-right text-lg font-semibold tabular-nums" required />
        </div>
      </div>

      <div className="space-y-1">
        <Label>{dict.expenses.paidFrom}</Label>
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
        <Label>{dict.common.notes}</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="..." />
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-700">✅ {dict.common.success}</div>}

      <Button type="submit" variant="danger" size="lg" className="w-full" disabled={pending}>
        {pending ? dict.common.saving : "💸 " + dict.common.save}
      </Button>
    </form>
  );
}
