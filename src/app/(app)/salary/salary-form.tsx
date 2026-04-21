"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";

const METHODS = ["cash", "bank_transfer", "qr_card", "credit_card"] as const;

interface EmpOpt { id: string; name: string; store_id: string; store_name: string }

export function SalaryForm({ dict, userId, employees }: { dict: Dictionary; userId: string; employees: EmpOpt[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [period, setPeriod] = useState(defaultMonth);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEmp = employees.find((e) => e.id === employeeId);
  const mKey = (m: string) => `method_${m}` as keyof typeof dict.salary;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!employeeId || !amount || Number(amount) <= 0) { setError(dict.common.error); return; }

    startTransition(async () => {
      const supabase = createClient();
      const periodDate = period + "-01";
      const { error } = await supabase.from("salary_payments").insert({
        employee_id: employeeId,
        store_id: selectedEmp!.store_id,
        period_month: periodDate,
        amount: Math.round(Number(amount)),
        payment_method: method,
        paid_at: new Date().toISOString(),
        note: note || null,
        created_by: userId,
      });
      if (error) { setError(error.message); return; }
      setSuccess(true);
      setAmount("");
      setNote("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>{dict.salary.period}</Label>
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label>{dict.common.employee}</Label>
        <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          {employees.length === 0 && <option value="">— {dict.common.empty} —</option>}
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name} ({e.store_name})</option>
          ))}
        </Select>
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
        <Label>{dict.salary.paymentMethod}</Label>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m} value={m}>{(dict.salary[mKey(m)] as string | undefined) ?? m}</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <Label>{dict.common.notes}</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-700">✅ {dict.common.success}</div>}
      <Button type="submit" variant="danger" size="lg" className="w-full" disabled={pending}>
        {pending ? dict.common.saving : "💰 " + dict.common.save}
      </Button>
    </form>
  );
}
