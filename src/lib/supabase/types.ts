export type UserRole = "admin" | "manager" | "staff";
export type RevenueStream = "main" | "cafe_bakery";

export interface Store {
  id: string;
  code: string;
  name_vi: string;
  name_ja: string | null;
  name_en: string | null;
  has_cafe_bakery: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  store_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  name: string;
  store_id: string;
  position: string | null;
  active: boolean;
  created_at: string;
}

export interface DailySale {
  id: string;
  sale_date: string;
  store_id: string;
  revenue_stream: RevenueStream;
  employee_id: string | null;
  customer_count: number;
  cash: number;
  qr_card: number;
  bank_transfer: number;
  total_revenue: number;
  avg_per_customer: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
