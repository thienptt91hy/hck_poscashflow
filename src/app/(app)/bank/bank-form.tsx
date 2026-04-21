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

const IN_CATS = ["deposit_from_store", "other"] as const;
const OUT_CATS = ["purchase", "expense", "salary", "other"] as const;
const METHODS = ["bank_transfer", "credit_card", "cash", "qr_card"] as const;

export function BankForm({
  dict,
  profile,
}: {
  dict: Dictionary;
  profile: { id: string; role: UserRole };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(todayJST());
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [category, setCategory] = useState<string>("deposit_from_store");
  const [method, setMethod] = useState<string>("bank_transfer");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [vendor, setVendor] = useState("");
  const [note, setNote] = useState("");
  const [addFee, setAddFee] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = direction === "in" ? IN_CATS : OUT_CATS;

  const handleDirectionChange = (d: "in" | "out") => {
    setDirection(d);
    setCategory(d === "in" ? "deposit_from_store" : "purchase");
    // Auto-add deposit fee when depositing from store
    setAddFee(d === "in");
  };

  const catKey = (c: string) => `cat_${c}` as keyof Dictionary["bank"];
  const methodKey = (m: string) => `method_${m}` as keyof Dictionary["bank"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!amount || Number(amount) <= 0) { setError(dict.common.error); return; }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("bank_transactions").insert({
        tx_date: date,
        direction,
        category,
        payment_method: method,
        amount: Math.round(Number(amount)),
        fee: addFee ? 110 : (Number(fee) || 0),
        vendor: vendor || null,
        note: note || null,
        created_by: profile.id,
      });
      if (error) { setError(error.message); return; }
      setSuccess(true);
      setAmount("");
      setFee("");
      setVendor("");
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

      {/* Direction */}
      <div className="space-y-1">
        <Label>{dict.bank.direction}</Label>
        <div className="flex rounded-md overflow-hidden border border-zinc-300">
          {(["in", "out"] as const).map((d) => (
            <button key={d} type="button" onClick={() => handleDirectionChange(d)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${direction === d
                ? d === "in" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>
              {d === "in" ? dict.bank.dirIn : dict.bank.dirOut}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label>{dict.bank.category}</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} required>
          {cats.map((c) => <option key={c} value={c}>{(dict.bank[catKey(c)] as string | undefined) ?? c}</option>)}
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{dict.bank.paymentMethod}</Label>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m} value={m}>{(dict.bank[methodKey(m)] as string | undefined) ?? m}</option>)}
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

      {/* Deposit fee auto-toggle */}
      {direction === "in" && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={addFee} onChange={(e) => setAddFee(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300" />
          {dict.cash.depositFee}
        </label>
      )}

      {!addFee && (
        <div className="space-y-1">
          <Label>{dict.bank.fee}</Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
            <Input type="number" inputMode="numeric" min={0} value={fee}
              onChange={(e) => setFee(e.target.value)} placeholder="0" className="pl-7 tabular-nums" />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label>{dict.bank.vendor}</Label>
        <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="—" />
      </div>

      <div className="space-y-1">
        <Label>{dict.common.notes}</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-700">✅ {dict.common.success}</div>}

      <Button type="submit" variant={direction === "in" ? "success" : "danger"} size="lg" className="w-full" disabled={pending}>
        {pending ? dict.common.saving : (direction === "in" ? "📥 " : "📤 ") + dict.common.save}
      </Button>
    </form>
  );
}
