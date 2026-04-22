"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionDeleteUser } from "./user-actions";

export function UserDeleteButton({
  userId,
  email,
  isSelf,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  if (isSelf) {
    return (
      <button
        disabled
        title="Không thể xoá tài khoản đang đăng nhập"
        className="rounded border border-zinc-100 px-2 py-1 text-xs text-zinc-300 cursor-not-allowed"
      >
        🗑️
      </button>
    );
  }

  const handleDelete = () => {
    startTransition(async () => {
      await actionDeleteUser(userId);
      setShowConfirm(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
      >
        🗑️
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900 mb-1">Xác nhận xoá tài khoản</h3>
            <p className="text-sm text-zinc-500 mb-5">
              Xoá tài khoản <strong className="text-zinc-800">{email}</strong>?
              <br />Thao tác này sẽ xoá vĩnh viễn và không thể hoàn tác.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Đang xoá..." : "🗑️ Xoá tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
