"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

interface StoreRow {
  id: string;
  code: string;
  name_vi: string;
  name_ja: string | null;
  name_en: string | null;
  has_cafe_bakery: boolean;
  active: boolean;
  sort_order: number;
}

export function StoreRowActions({
  row,
  dict,
}: {
  row: StoreRow;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delError, setDelError] = useState<string | null>(null);

  const [code, setCode] = useState(row.code);
  const [nameVi, setNameVi] = useState(row.name_vi);
  const [nameJa, setNameJa] = useState(row.name_ja ?? "");
  const [nameEn, setNameEn] = useState(row.name_en ?? "");
  const [hasCafe, setHasCafe] = useState(row.has_cafe_bakery);
  const [active, setActive] = useState(row.active);
  const [sortOrder, setSortOrder] = useState(String(row.sort_order));

  const openEdit = () => {
    setCode(row.code); setNameVi(row.name_vi);
    setNameJa(row.name_ja ?? ""); setNameEn(row.name_en ?? "");
    setHasCafe(row.has_cafe_bakery); setActive(row.active);
    setSortOrder(String(row.sort_order)); setError(null);
    setShowEdit(true);
  };

  const handleUpdate = () => {
    const codeVal = code.trim().toUpperCase();
    if (!codeVal || !nameVi.trim()) { setError("Vui lòng điền Mã và Tên VI."); return; }
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().from("stores").update({
        code: codeVal,
        name_vi: nameVi.trim(),
        name_ja: nameJa.trim() || null,
        name_en: nameEn.trim() || null,
        has_cafe_bakery: hasCafe,
        active,
        sort_order: Number(sortOrder) || 0,
      }).eq("id", row.id);
      if (error) {
        setError(error.code === "23505" ? "Mã cửa hàng đã tồn tại." : error.message);
        return;
      }
      setShowEdit(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    setDelError(null);
    startTransition(async () => {
      const { error } = await createClient().from("stores").delete().eq("id", row.id);
      if (error) {
        // FK violation = store has related data
        setDelError(dict.settings.deleteStoreError);
        return;
      }
      setShowDel(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center gap-1 justify-center">
        <button
          onClick={openEdit}
          className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 touch-manipulation"
        >
          ✏️
        </button>
        <button
          onClick={() => { setDelError(null); setShowDel(true); }}
          className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 touch-manipulation"
        >
          🗑️
        </button>
      </div>

      {/* Delete confirm */}
      {showDel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowDel(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-1">Xác nhận xoá cửa hàng</h3>
              <p className="text-sm text-zinc-500 mb-1">
                Xoá cửa hàng <strong>{row.name_vi}</strong> ({row.code})?
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                ⚠️ Cửa hàng chỉ có thể xoá khi chưa có nhân viên, doanh thu hay giao dịch nào.
              </p>
              {delError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {delError}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDel(false)}
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
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{dict.settings.editStore}</h3>
              <button onClick={() => setShowEdit(false)} className="text-zinc-400 hover:text-zinc-700 text-xl">✕</button>
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
                    maxLength={10}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-700">{dict.settings.sortOrder}</label>
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

              <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-zinc-200 px-3 py-2.5 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-emerald-600"
                />
                <span className="text-sm text-zinc-700">{dict.settings.storeActive}</span>
              </label>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
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
