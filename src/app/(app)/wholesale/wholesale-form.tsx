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

const METHODS = ["bank_transfer", "cash", "qr_card", "credit_card"] as const;

export function WholesaleForm({ dict, userId }: { dict: Dictionary; userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(todayJST());
  const [company, setCompany] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("bank_transfer");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mKey = (m: string) => `method_${m}` as keyof typeof dict.wholesale;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!company.trim() || !amount || Number(amount) <= 0) { setError(dict.common.error); return; }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("wholesale_sales").insert({
        sale_date: date,
        customer_company: company.trim(),
        amount: Math.round(Number(amount)),
        payment_method: method,
        store_id: null,
        paid: false,
        due_date: dueDate || null,
        note: note || null,
        created_by: userId,
      });
      if (error) { setError(error.message); return; }
      setSuccess(true);
      setCompany("");
      setAmount("");
      setDueDate("");
      setNote("");
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
        <Label>{dict.wholesale.customer}</Label>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="株式会社..." required />
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
        <Label>{dict.wholesale.paymentMethod}</Label>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m} value={m}>{(dict.wholesale[mKey(m)] as string | undefined) ?? m}</option>)}
        </Select>
      </div>
      {method === "cash" && (
        <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1.5">
          💡 Tiền mặt bán sỉ sẽ vào <strong>Quỹ chung</strong>
        </p>
      )}
      <div className="space-y-1">
        <Label>{dict.wholesale.dueDate}</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>{dict.common.notes}</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-700">✅ {dict.common.success}</div>}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? dict.common.saving : "📦 " + dict.common.save}
      </Button>
    </form>
  );
}
