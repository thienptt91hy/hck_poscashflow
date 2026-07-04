"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { formatYen, todayJST } from "@/lib/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserRole } from "@/lib/supabase/types";

interface StoreOpt {
  id: string;
  code: string;
  name: string;
  has_cafe_bakery: boolean;
}
interface EmployeeOpt {
  id: string;
  name: string;
  store_id: string;
}
interface Profile {
  id: string;
  role: UserRole;
  store_id: string | null;
}

export function SalesForm({
  dict,
  profile,
  stores,
  employees,
}: {
  dict: Dictionary;
  profile: Profile;
  stores: StoreOpt[];
  employees: EmployeeOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const defaultStoreId =
    profile.role === "staff" && profile.store_id
      ? profile.store_id
      : stores[0]?.id ?? "";

  const [saleDate, setSaleDate] = useState(todayJST());
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [revenueStream, setRevenueStream] = useState<"main" | "cafe_bakery">("main");
  const [employeeId, setEmployeeId] = useState("");
  const [customerCount, setCustomerCount] = useState("");
  const [cash, setCash] = useState("");
  const [qrCard, setQrCard] = useState("");
  const [bankTransfer, setBankTransfer] = useState("");
  const [cashItems, setCashItems] = useState<{ note: string; amount: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedStore = stores.find((s) => s.id === storeId);
  const employeesForStore = employees.filter((e) => e.store_id === storeId);

  const addCashItem = () => setCashItems((p) => [...p, { note: "", amount: "" }]);
  const removeCashItem = (i: number) => setCashItems((p) => p.filter((_, idx) => idx !== i));
  const updateCashItem = (i: number, field: "note" | "amount", val: string) =>
    setCashItems((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));

  const total = useMemo(
    () =>
      (Number(cash) || 0) +
      (Number(qrCard) || 0) +
      (Number(bankTransfer) || 0) +
      cashItems.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    [cash, qrCard, bankTransfer, cashItems],
  );
  const avgPerCustomer = useMemo(() => {
    const c = Number(customerCount) || 0;
    return c > 0 ? Math.round(total / c) : 0;
  }, [total, customerCount]);

  const isStaffLocked = profile.role === "staff";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!storeId) {
      setError(dict.common.error);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("daily_sales").insert({
        sale_date: saleDate,
        store_id: storeId,
        revenue_stream: revenueStream,
        employee_id: employeeId || null,
        customer_count: Number(customerCount) || 0,
        cash: Number(cash) || 0,
        qr_card: Number(qrCard) || 0,
        bank_transfer: Number(bankTransfer) || 0,
        cash_expense_items: cashItems
          .filter((it) => (Number(it.amount) || 0) > 0)
          .map((it) => ({ amount: Number(it.amount) || 0, note: it.note.trim() || null })),
        notes: notes || null,
        created_by: profile.id,
      });

      if (error) {
        setError(error.message);
        return;
      }
      setSuccess(true);
      setCustomerCount("");
      setCash("");
      setQrCard("");
      setBankTransfer("");
      setCashItems([]);
      setNotes("");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={dict.common.date}>
              <Input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
              />
            </Field>
            <Field label={dict.common.store}>
              <Select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                disabled={isStaffLocked}
                required
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {selectedStore?.has_cafe_bakery && (
            <Field label={dict.sales.revenueStream}>
              <Select
                value={revenueStream}
                onChange={(e) => setRevenueStream(e.target.value as "main" | "cafe_bakery")}
              >
                <option value="main">{dict.sales.streamMain}</option>
                <option value="cafe_bakery">{dict.sales.streamCafe}</option>
              </Select>
            </Field>
          )}

          <Field label={dict.common.employee}>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">—</option>
              {employeesForStore.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={dict.sales.customerCount}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={customerCount}
              onChange={(e) => setCustomerCount(e.target.value)}
              placeholder="0"
              className="text-lg font-medium tabular-nums"
            />
          </Field>

          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <MoneyField
              label={"💵 " + dict.sales.cash}
              value={cash}
              onChange={setCash}
              color="text-emerald-700"
            />
            <MoneyField
              label={"💳 " + dict.sales.qrCard}
              value={qrCard}
              onChange={setQrCard}
              color="text-blue-700"
            />
            <MoneyField
              label={"🏦 " + dict.sales.bankTransfer}
              value={bankTransfer}
              onChange={setBankTransfer}
              color="text-violet-700"
            />
            <div className="space-y-2 border-t border-zinc-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-700">
                  🛒 {dict.sales.cashExpense}
                </span>
                <button
                  type="button"
                  onClick={addCashItem}
                  className="text-xs font-medium text-amber-700 hover:underline"
                >
                  + {dict.sales.cashExpenseAdd}
                </button>
              </div>
              {cashItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={it.note}
                    onChange={(e) => updateCashItem(i, "note", e.target.value)}
                    placeholder={dict.sales.cashExpenseNotePlaceholder}
                    className="flex-1"
                  />
                  <div className="relative w-28">
                    <span className="absolute inset-y-0 left-2 flex items-center text-zinc-400">¥</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={it.amount}
                      onChange={(e) => updateCashItem(i, "amount", e.target.value)}
                      placeholder="0"
                      className="pl-6 text-right tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCashItem(i)}
                    className="px-1 text-zinc-400 hover:text-red-500"
                    aria-label="remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between rounded-lg bg-zinc-900 px-5 py-4 text-white">
            <div>
              <div className="text-xs uppercase text-zinc-400">{dict.sales.totalRevenue}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{formatYen(total)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-zinc-400">{dict.sales.avgPerCustomer}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {formatYen(avgPerCustomer)}
              </div>
            </div>
          </div>

          <Field label={dict.common.notes}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              ✅ {dict.sales.saved}
            </div>
          )}

          <Button
            type="submit"
            variant="success"
            size="xl"
            className="w-full"
            disabled={pending}
          >
            {pending ? dict.common.saving : "✅ " + dict.common.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={"w-32 text-sm font-medium " + color}>{label}</div>
      <div className="relative flex-1">
        <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">¥</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="pl-7 text-right text-lg font-semibold tabular-nums"
        />
      </div>
    </div>
  );
}
