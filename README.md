# POS CashFlow

Hệ thống quản lý doanh thu + dòng tiền cho chuỗi 4 cửa hàng tại Nhật.

- **Stack**: Next.js 16 · TypeScript · Tailwind v4 · Supabase · Recharts
- **Ngôn ngữ UI**: 🇻🇳 Tiếng Việt (mặc định) · 🇯🇵 日本語 · 🇬🇧 English
- **Múi giờ**: Asia/Tokyo · **Tiền tệ**: JPY (¥)

---

## 🚀 Setup lần đầu

### 1. Cấu hình `.env.local`

File `.env.local` đã có sẵn với 2 keys công khai. Cần bổ sung **service_role key**:

- Vào Supabase Dashboard → **Project Settings → API Keys**
- Copy key `service_role` (format: `sb_secret_...`) → dán vào biến `SUPABASE_SERVICE_ROLE_KEY`

### 2. Chạy migration (tạo tables + seed data)

**Cách đơn giản nhất** — dùng Supabase SQL Editor:

1. Mở file `supabase/migrations/0001_initial_schema.sql` → copy toàn bộ
2. Vào Supabase Dashboard → **SQL Editor** → **New query** → paste → **Run**
3. Tiếp tục paste `supabase/seed.sql` → **Run**

Kiểm tra: **Table Editor** sẽ thấy 12 tables, bảng `stores` có 4 cửa hàng.

### 3. Tạo user admin đầu tiên

Vào **Authentication → Users → Add user → Create new user**:

- Email: email admin của anh (vd: `cuongnh89@gmail.com`)
- Password: mật khẩu mạnh
- ✅ Auto Confirm User

Sau đó mở **SQL Editor** chạy lệnh nâng quyền:

```sql
update public.user_profiles
set role = 'admin', full_name = 'Admin'
where email = 'cuongnh89@gmail.com';
```

### 4. Chạy dev server

```bash
npm run dev
```

Mở http://localhost:3000 → tự redirect `/login` → đăng nhập user admin ở bước 3.

---

## 📂 Cấu trúc thư mục

```
src/
├── app/
│   ├── (app)/                   # Auth-required routes (layout chung)
│   │   ├── dashboard/           # 📊 Tổng quan
│   │   ├── sales/
│   │   │   ├── page.tsx         # 📋 Danh sách doanh thu
│   │   │   └── new/             # 📝 Nhập doanh thu (priority)
│   │   └── layout.tsx           # Sidebar + header
│   ├── login/
│   ├── auth/logout/
│   └── layout.tsx               # Root (dynamic lang)
├── components/
│   ├── ui/                      # Button, Input, Label, Card, Select
│   ├── charts/
│   ├── sidebar.tsx
│   └── locale-switcher.tsx
├── i18n/
│   ├── dictionaries.ts
│   └── vi.json · ja.json · en.json
├── lib/
│   ├── supabase/                # client · server · middleware · types
│   ├── format.ts                # formatYen, formatJST
│   ├── locale.ts                # Client-safe constants
│   ├── locale-server.ts         # Server-only getLocale()
│   └── utils.ts
└── proxy.ts                     # Auth guard (Next.js 16 = middleware)

supabase/
├── migrations/0001_initial_schema.sql
└── seed.sql
```

---

## ✅ Phase 1 — Đã xong

- [x] Auth (email/password) + protected routes + logout
- [x] i18n VI / JA / EN (cookie-based switcher)
- [x] Schema DB đầy đủ (12 tables) + RLS policies + triggers
- [x] Seed 4 cửa hàng: **Seto · Komaki · Konan (có cafe/bánh mì) · Bánh mì**
- [x] Seed 6 chi phí cố định mẫu (có thể sửa sau)
- [x] **📝 Nhập doanh thu** (priority) — form nhanh 5 ô, live-calc tổng + TB/khách
  - Staff: pre-select cửa hàng mình, không đổi được
  - Admin/Manager: chọn bất kỳ cửa hàng
  - Konan: thêm lựa chọn dòng `main` / `cafe_bakery`
- [x] Danh sách doanh thu (table sort theo ngày)
- [x] Dashboard: KPI (hôm nay, tháng) + biểu đồ doanh thu 30 ngày 4 cửa hàng

## 🔜 Roadmap tiếp theo

| Phase    | Tính năng                                                          |
|----------|--------------------------------------------------------------------|
| **1.5**  | Invoice in/xuất PDF                                                |
| **2**    | Cash movements + Bank transactions + số dư két real-time           |
| **2.5**  | Expenses (fixed / store / variable)                                |
| **3**    | Employees CRUD + Salary + Wholesale + Báo cáo Excel/PDF             |

---

## 🗝 Phân quyền (RLS tại DB)

| Role      | Quyền                                                              |
|-----------|--------------------------------------------------------------------|
| `admin`   | Toàn quyền + xem lương + xoá                                       |
| `manager` | Như admin nhưng KHÔNG xem `salary_payments`                        |
| `staff`   | Chỉ xem/nhập doanh thu + tiền mặt của `store_id` mình             |

## 🧪 Commands

```bash
npm run dev       # Dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
```

## 🚢 Deploy lên Vercel

1. Push code lên GitHub
2. Vercel → **New Project** → Import repo
3. Environment Variables: paste toàn bộ nội dung `.env.local`
4. Deploy

→ Vercel auto-detect Next.js, build xong sẽ có URL dạng `your-app.vercel.app`.
