"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";

export function StoreAddForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [nameJa, setNameJa] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [hasCafe, setHasCafe] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");

  const reset = () => {
    setCode(""); setNameVi(""); setNameJa(""); setNameEn("");
    setHasCafe(false); setSortOrder("0"); setError(null);
    setOpen(true);
  };

  const handleSubmit = () => {
    const codeVal = code.trim().toUpperCase();
    if (!codeVal || !nameVi.trim()) { setError("Vui lòng điền Mã và Tên VI."); return; }
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().from("stores").insert({
        code: codeVal,
        name_vi: nameVi.trim(),
        name_ja: nameJa.trim() || null,
        name_en: nameEn.trim() || null,
        has_cafe_bakery: hasCafe,
        sort_order: Number(sortOrder) || 0,
        active: true,
      });
      if (error) {
        setError(error.code === "23505" ? "Mã cửa hàng đã tồn tại." : error.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 touch-manipulation"
      >
        <Plus className="h-3.5 w-3.5" />
        {dict.settings.addStore}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{dict.settings.addStore}</h3>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 text-xl">✕</button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">
                    {dict.settings.storeCode} <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VD: SETO"
                    maxLength={10}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">
                    {dict.settings.sortOrder}
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    min={0}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">
                  Tên VI <span className="text-red-500">*</span>
                </label>
                <input
                  value={nameVi}
                  onChange={(e) => setNameVi(e.target.value)}
                  placeholder="Tên cửa hàng tiếng Việt"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">Tên JA</label>
                <input
                  value={nameJa}
                  onChange={(e) => setNameJa(e.target.value)}
                  placeholder="店舗名（日本語）"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-700">Tên EN</label>
                <input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Store name (English)"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-zinc-200 px-3 py-2.5 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={hasCafe}
                  onChange={(e) => setHasCafe(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-blue-600"
                />
                <span className="text-sm text-zinc-700">{dict.settings.hasCafeBakery}</span>
              </label>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                {dict.common.cancel}
              </button>
              <button
                onClick={handleSubmit}
                disabled={pending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? dict.common.saving : "➕ " + dict.common.add}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
