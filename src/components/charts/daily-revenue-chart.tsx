"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useMemo } from "react";

interface SaleRow {
  sale_date: string;
  total_revenue: number | null;
  store_id: string;
}
interface StoreRef {
  id: string;
  name: string;
}

const COLORS = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#db2777"];

export function DailyRevenueChart({ data, stores }: { data: SaleRow[]; stores: StoreRef[] }) {
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of data) {
      const d = r.sale_date;
      if (!byDate.has(d)) byDate.set(d, { date: d });
      const row = byDate.get(d)!;
      row[r.store_id] = ((row[r.store_id] as number) ?? 0) + (r.total_revenue ?? 0);
    }
    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
        —
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            formatter={(value) => "¥" + Number(value ?? 0).toLocaleString()}
            labelFormatter={(l) => String(l)}
          />
          <Legend />
          {stores.map((s, i) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
