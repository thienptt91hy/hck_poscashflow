"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/locale";
import { Select } from "@/components/ui/select";

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    // 1 year, path=/
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  };

  return (
    <Select value={currentLocale} onChange={handleChange} className="w-auto text-sm h-9">
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </Select>
  );
}
