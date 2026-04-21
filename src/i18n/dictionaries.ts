import "server-only";
import type { Locale } from "@/lib/locale";

const dictionaries = {
  vi: () => import("./vi.json").then((m) => m.default),
  ja: () => import("./ja.json").then((m) => m.default),
  en: () => import("./en.json").then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<typeof dictionaries.vi>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loader = dictionaries[locale] ?? dictionaries.vi;
  return loader();
}
