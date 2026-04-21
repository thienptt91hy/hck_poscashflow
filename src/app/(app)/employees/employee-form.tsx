"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";

export function EmployeeForm({
  dict,
  stores,
}: {
  dict: Dictionary;
  stores: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [position, setPosition] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!name.trim() || !storeId) { setError(dict.common.error); return; }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("employees").insert({
        name: name.trim(),
        store_id: storeId,
        position: position || null,
        active: true,
      });
      if (error) { setError(error.message); return; }
      setSuccess(true);
      setName("");
      setPosition("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>{dict.common.name}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="山田 花子" />
      </div>

      <div className="space-y-1">
        <Label>{dict.common.store}</Label>
        <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} required>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{dict.employees.position}</Label>
        <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="スタッフ / Nhân viên" />
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-700">✅ {dict.common.success}</div>}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? dict.common.saving : "👤 " + dict.common.add}
      </Button>
    </form>
  );
}
