"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/dictionaries";

export function WholesaleMarkPaid({ id, dict }: { id: string; dict: Dictionary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("wholesale_sales").update({ paid: true }).eq("id", id);
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs rounded px-1.5 py-0.5 bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-50"
    >
      {pending ? "..." : dict.wholesale.markPaid}
    </button>
  );
}
