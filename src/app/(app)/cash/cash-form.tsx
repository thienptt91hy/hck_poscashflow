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

const IN_CATEGORIES = ["sales", "other"] as const;
const OUT_CATEGORIES = ["cod", "purchase", "staff_take", "deposit_to_bank", "adjust", "other"] as const;

export function CashForm({
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
  const [storeId, setStoreId] = useState(isStaffLocked && profile.store_id ? profile.store_id : stores[0]?.id ?? "");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [category, setCategory] = useState<string>("purchase");
  const [amount, setAmount] = useState("");
  const [depositFee, setDepositFee] = useState("110");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = direction === "in" ? IN_CATEGORIES : OUT_CATEGORIES;

  const handleDirectionChange = (d: "in" | "out") => {
    setDirection(d);
    setCategory(d === "in" ? "sales" : "purchase");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!storeId || !amount || Number(amount) <= 0) {
      setError(dict.common.error);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("cash_movements").insert({
        move_date: date,
        store_id: storeId,
        direction,
        category,
        amount: Math.round(Number(amount)),
        deposit_fee: category === "deposit_to_bank" ? (Math.round(Number(depositFee)) || 0) : 0,
        note: note || null,
        created_by: profile.id,
      });
      if (error) { setError(error.message); return; }
      setSuccess(true);
      setAmount("");
      setDepositFee("110");
      setNote("");
      router.refresh();
    });
  };

  const catKey = (c: string) => `cat_${c}` as keyof Dictionary["cash"];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>{dict.common.date}</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div className="space-y-1">
        <Label>{dict.common.store}</Label>
        <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={isStaffLocked} required>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      {/* Direction toggle */}
      <div className="space-y-1">
        <Label>{dict.cash.direction}</Label>
        <div className="flex rounded-md overflow-hidden border border-zinc-300">
          {(["out", "in"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDirectionChange(d)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                direction === d
                  ? d === "in" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {d === "in" ? dict.cash.dirIn : dict.cash.dirOut}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label>{dict.cash.category}</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} required>
          {categories.map((c) => (
            <option key={c} value={c}>
              {(dict.cash[catKey(c)] as string | undefined) ?? c}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{dict.cash.amount}</Label>
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="pl-7 text-right text-lg font-semibold tabular-nums"
            required
          />
        </div>
      </div>

      {category === "deposit_to_bank" && (
        <div className="space-y-1">
          <Label>{dict.cash.depositFee}</Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={depositFee}
              onChange={(e) => setDepositFee(e.target.value)}
              className="pl-7 text-right tabular-nums"
            />
          </div>
          <p className="text-xs text-zinc-400">Phí này sẽ được trừ vào số tiền vào ngân hàng</p>
        </div>
      )}

      <div className="space-y-1">
        <Label>{dict.common.notes}</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="..." />
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-700">✅ {dict.common.success}</div>}

      <Button type="submit" variant={direction === "in" ? "success" : "danger"} size="lg" className="w-full" disabled={pending}>
        {pending ? dict.common.saving : (direction === "in" ? "📥 " : "📤 ") + dict.common.save}
      </Button>
    </form>
  );
}
