import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { getDictionary } from "@/i18n/dictionaries";
import { formatYen } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalesListPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("daily_sales")
    .select(
      "id, sale_date, store_id, revenue_stream, customer_count, cash, qr_card, bank_transfer, total_revenue, avg_per_customer, notes, stores(code, name_vi, name_ja, name_en)",
    )
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const nameField = locale === "ja" ? "name_ja" : locale === "en" ? "name_en" : "name_vi";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">{dict.sales.title}</h1>
        <Link
          href="/sales/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusCircle className="h-4 w-4" />
          {dict.sales.newEntry}
        </Link>
      </div>

      {(!rows || rows.length === 0) ? (
        <Card>
          <CardContent>
            <div className="py-12 text-center text-sm text-zinc-400">{dict.common.empty}</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">{dict.common.date}</th>
                    <th className="px-4 py-2.5 text-left font-medium">{dict.common.store}</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {dict.sales.customerCount}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">{dict.sales.cash}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{dict.sales.qrCard}</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {dict.sales.bankTransfer}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {dict.sales.totalRevenue}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((r) => {
                    const store = r.stores as unknown as
                      | { name_vi: string; name_ja: string | null; name_en: string | null }
                      | null;
                    const storeName =
                      (store?.[nameField as "name_vi"] as string | null) ?? store?.name_vi ?? "—";
                    return (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2.5 tabular-nums">{r.sale_date}</td>
                        <td className="px-4 py-2.5">
                          {storeName}
                          {r.revenue_stream === "cafe_bakery" && (
                            <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                              cafe
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {r.customer_count}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                          {formatYen(r.cash)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-blue-700">
                          {formatYen(r.qr_card)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-violet-700">
                          {formatYen(r.bank_transfer)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {formatYen(r.total_revenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
