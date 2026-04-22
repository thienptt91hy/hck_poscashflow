"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/dictionaries";

interface ChartRow {
  sale_date: string;
  store_id: string;
  total_revenue: number;
  cash: number;
  qr_card: number;
  bank_transfer: number;
  customer_count: number;
}

interface StoreOpt {
  id: string;
  name: string;
}

const STORE_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0891b2"];
const PAY_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6"];

function abbrevYen(v: number): string {
  if (v >= 1_000_000) return `¥${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `¥${Math.round(v / 1_000)}k`;
  return `¥${Math.round(v)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, e: { value: number }) => s + (e.value ?? 0), 0);
  return (
    <div className="bg-white border border-zinc-100 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[150px]">
      <p className="font-semibold text-zinc-600 mb-2">{label}</p>
      {payload.map((entry: { color: string; name: string; value: number }, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-zinc-500 truncate max-w-[90px]">{entry.name}</span>
          </div>
          <span className="font-semibold tabular-nums">¥{Number(entry.value ?? 0).toLocaleString()}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-zinc-100">
          <span className="text-zinc-500 font-medium">Tổng</span>
          <span className="font-bold tabular-nums">¥{total.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

export function SalesCharts({
  rows,
  allStores,
  selectedStore,
  dict,
}: {
  rows: ChartRow[];
  allStores: StoreOpt[];
  selectedStore: string;
  dict: Dictionary;
}) {
  // Group by date; one key per active store (or single key "rev" for single-store view)
  const { areaData, activeStores } = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();

    for (const r of rows) {
      if (!byDate.has(r.sale_date)) byDate.set(r.sale_date, { date: r.sale_date });
      const row = byDate.get(r.sale_date)!;
      if (selectedStore === "all") {
        row[r.store_id] = ((row[r.store_id] as number) ?? 0) + r.total_revenue;
      } else {
        row["rev"] = ((row["rev"] as number) ?? 0) + r.total_revenue;
        row["customers"] = ((row["customers"] as number) ?? 0) + r.customer_count;
      }
    }

    const sorted = Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );

    const active =
      selectedStore === "all"
        ? allStores.filter((s) => sorted.some((row) => (row[s.id] as number) > 0))
        : [{ id: "rev", name: allStores.find((s) => s.id === selectedStore)?.name ?? "Revenue" }];

    return { areaData: sorted, activeStores: active };
  }, [rows, allStores, selectedStore]);

  // Store bar data (only relevant when "all" selected)
  const storeBarData = useMemo(() => {
    const map = new Map<string, { id: string; name: string; revenue: number; customers: number }>();
    for (const r of rows) {
      if (!map.has(r.store_id)) {
        const store = allStores.find((s) => s.id === r.store_id);
        map.set(r.store_id, { id: r.store_id, name: store?.name ?? r.store_id, revenue: 0, customers: 0 });
      }
      const entry = map.get(r.store_id)!;
      entry.revenue += r.total_revenue;
      entry.customers += r.customer_count;
    }
    return Array.from(map.values())
      .filter((s) => s.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows, allStores]);

  // Payment mix
  const paymentMix = useMemo(() => {
    let cash = 0, qr = 0, bank = 0;
    for (const r of rows) { cash += r.cash; qr += r.qr_card; bank += r.bank_transfer; }
    return [
      { name: dict.sales.cash, value: cash },
      { name: dict.sales.qrCard, value: qr },
      { name: dict.sales.bankTransfer, value: bank },
    ].filter((d) => d.value > 0);
  }, [rows, dict]);

  const totalPayment = paymentMix.reduce((s, d) => s + d.value, 0);
  const noData = areaData.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend area chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-700">
              {dict.dashboard.revenueTrend}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            {noData ? (
              <div className="flex h-52 items-center justify-center text-sm text-zinc-400">
                {dict.dashboard.noData}
              </div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                    <defs>
                      {activeStores.map((s, i) => (
                        <linearGradient key={s.id} id={`sg-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={STORE_COLORS[i % STORE_COLORS.length]} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={STORE_COLORS[i % STORE_COLORS.length]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={(v) => String(v).slice(5)}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={abbrevYen}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip content={<AreaTooltip />} />
                    {activeStores.map((s, i) => (
                      <Area
                        key={s.id}
                        type="monotone"
                        dataKey={s.id}
                        name={s.name}
                        stackId={selectedStore === "all" ? "total" : undefined}
                        stroke={STORE_COLORS[i % STORE_COLORS.length]}
                        strokeWidth={2}
                        fill={`url(#sg-${s.id})`}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {!noData && activeStores.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {activeStores.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: STORE_COLORS[i % STORE_COLORS.length] }} />
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment mix donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-700">
              {dict.dashboard.paymentMix}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            {paymentMix.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-zinc-400">
                {dict.dashboard.noData}
              </div>
            ) : (
              <>
                <div className="h-40 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMix} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {paymentMix.map((_, i) => (
                          <Cell key={i} fill={PAY_COLORS[i % PAY_COLORS.length]} />
                        ))}
                      </Pie>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Tooltip formatter={(v: any) => ["¥" + Number(v ?? 0).toLocaleString(), ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-xs text-zinc-400">Tổng</div>
                      <div className="text-sm font-bold text-zinc-800 tabular-nums">{abbrevYen(totalPayment)}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {paymentMix.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PAY_COLORS[i % PAY_COLORS.length] }} />
                        <span className="text-xs text-zinc-500">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold tabular-nums text-zinc-700">
                          {totalPayment > 0 ? Math.round((d.value / totalPayment) * 100) : 0}%
                        </span>
                        <span className="text-xs text-zinc-400 tabular-nums ml-2">{abbrevYen(d.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Store comparison bar (only when "all" selected and multiple stores) */}
      {selectedStore === "all" && storeBarData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-700">
              {dict.dashboard.revenueByStore}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div style={{ height: Math.max(storeBarData.length * 52, 80) }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={storeBarData}
                  layout="vertical"
                  margin={{ top: 0, right: 84, left: 4, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={abbrevYen} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#52525b", fontWeight: 500 }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-white border border-zinc-100 rounded-xl shadow-lg px-3 py-2 text-xs">
                          <p className="font-semibold text-zinc-700">¥{Number(payload[0]?.value ?? 0).toLocaleString()}</p>
                          <p className="text-zinc-400">{d?.customers?.toLocaleString()} khách</p>
                        </div>
                      );
                    }}
                    cursor={{ fill: "#f4f4f5" }}
                  />
                  <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {storeBarData.map((_, i) => (
                      <Cell key={i} fill={STORE_COLORS[i % STORE_COLORS.length]} opacity={0.9} />
                    ))}
                    <LabelList
                      dataKey="revenue"
                      position="right"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => abbrevYen(Number(v ?? 0))}
                      style={{ fontSize: 12, fill: "#71717a", fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
