# Spec: Vai trò chỉ xem cho 税理士 (Tax Accountant / Kế toán thuế)

| | |
|---|---|
| Trạng thái | ✅ Đã triển khai (code + migration) — chờ chạy migration trên Supabase & test thủ công mục 7 |
| Ngày | 2026-10-13 |
| Phạm vi | DB (enum + RLS) · Next.js UI · i18n · Settings/Users · README |
| Ước lượng | ~1 ngày dev + 0.5 ngày test |

---

## 1. Bối cảnh & mục tiêu

Chủ shop muốn cấp tài khoản cho **税理士 (người Nhật)** để xem toàn bộ số liệu tài chính và cố vấn thuế / kế toán.
Người này **không bao giờ nhập hay sửa dữ liệu**. Yêu cầu:

1. Xem được **mọi dữ liệu tài chính** của **tất cả cửa hàng**: doanh thu, tiền mặt, ngân hàng, chi phí (cố định + phát sinh), bán sỉ, **lương**, báo cáo tháng, dashboard.
2. **Không** thấy và **không** thực hiện được bất kỳ thao tác ghi nào (thêm / sửa / xoá / đánh dấu đã thu).
3. **Không** truy cập Cài đặt (stores, users, chỉnh sửa chi phí cố định).
4. Giao diện mặc định **tiếng Nhật** cho tài khoản này.
5. Chặn ở **cả 2 lớp**: UI (ẩn nút / redirect) **và** RLS (Supabase từ chối ghi ngay cả khi gọi API trực tiếp).

**Không thuộc phạm vi** (ghi ở mục 9 — Phase 2): export CSV cho phần mềm kế toán, giới hạn thời hạn truy cập, ghi log đăng nhập.

---

## 2. Hiện trạng (kết quả khảo sát code)

| Lớp | Hiện trạng | Hệ quả cho tính năng này |
|---|---|---|
| Enum `user_role` | `admin · manager · staff` (`supabase/migrations/0001_initial_schema.sql:8`) | Phải thêm giá trị enum mới |
| RLS helpers | `is_admin()`, `is_admin_or_manager()`, `current_user_store_id()` | Mọi policy **read** của bank / expenses / wholesale / fixed_expenses dùng `is_admin_or_manager()` → accountant sẽ bị chặn đọc nếu không sửa |
| `salary_payments` | 1 policy duy nhất `for all using (is_admin())` | Cần thêm policy **select** riêng cho accountant |
| Điều hướng | `NAV[].roles` trong `src/components/sidebar.tsx` và `mobile-nav.tsx` — chỉ **ẩn menu**, không chặn URL | Gõ thẳng `/salary`, `/settings` vẫn render trang (dữ liệu chỉ bị RLS lọc rỗng) |
| Guard trang | **Không có** server-side guard theo role ở bất kỳ page nào | Cần thêm `requireRole()` |
| Nút ghi trên UI | Form thêm + `*RowActions` (sửa/xoá) render **vô điều kiện** ở sales, cash, bank, expenses, wholesale. Chỉ employees & salary gate theo `role === "admin"` | Phải gate toàn bộ bằng 1 helper chung |
| Cách ghi dữ liệu | Client-side `supabase.from(...).insert/update/delete` (RLS là tường chắn thực sự) | RLS đúng ⇒ an toàn ngay cả khi UI sót |
| Server action `actionCreateUser` / `actionDeleteUser` (`src/app/(app)/settings/user-actions.ts`) | Dùng **service-role key**, **không kiểm tra** caller là admin | ⚠️ Lỗ hổng có sẵn: bất kỳ user đã đăng nhập (kể cả staff) gọi được server action này để tạo admin mới. Phải vá trong PR này |
| `src/app/(app)/bank/page.tsx:62` | Fallback `role ?? "admin"` khi không có profile | Sai hướng an toàn, sửa thành `"staff"` |
| Header layout | Hiển thị `role` thô (`capitalize`) | Cần nhãn i18n cho role mới |
| Locale | Cookie `NEXT_LOCALE`, mặc định `vi` | Cần cơ chế đặt mặc định `ja` cho accountant |

---

## 3. Quyết định thiết kế

### 3.1 Tên role: `accountant`
- Giá trị enum: `accountant`. Nhãn: VI **"Kế toán thuế (税理士)"** · JA **"税理士"** · EN **"Tax accountant"**.
- Không dùng tên chung `viewer` vì role này **được xem lương** (dữ liệu mật) — khác một viewer thông thường. Nếu sau này cần viewer không thấy lương, thêm role riêng.

### 3.2 Phạm vi dữ liệu: toàn chuỗi
- `user_profiles.store_id` của accountant **luôn `null`** (UI ẩn ô "Cửa hàng phụ trách" khi chọn role này; nếu có giá trị cũ thì bỏ qua).

### 3.3 Ma trận quyền mới

| Tính năng | Admin | Manager | Staff | **Accountant** |
|---|:-:|:-:|:-:|:-:|
| Tổng quan | ✅ | ✅ | ❌ | 👁 |
| Nhập doanh thu (`/sales/new`) | ✅ | ✅ | ✅ | ❌ |
| Doanh thu (xem/lọc/biểu đồ) | ✅ | ✅ | ✅ | 👁 |
| Tiền mặt | ✅ | ✅ | ✅ | 👁 |
| Ngân hàng | ✅ | ✅ | ❌ | 👁 |
| Chi phí | ✅ | ✅ | ❌ | 👁 |
| Nhân viên | ✅ | ✅ | ❌ | 👁 |
| Bán sỉ | ✅ | ✅ | ❌ | 👁 |
| Lương | ✅ | ❌ | ❌ | 👁 |
| Báo cáo tháng + In | ✅ | ✅ | ❌ | 👁 |
| Cài đặt | ✅ | ❌ | ❌ | ❌ |

👁 = chỉ xem. Mọi thao tác ghi (insert / update / delete, "Đánh dấu đã thu", sửa chi phí cố định) bị chặn.

### 3.4 Hai lớp bảo vệ
1. **RLS** (nguồn chân lý): accountant có SELECT trên mọi bảng nghiệp vụ, **không** có INSERT / UPDATE / DELETE.
2. **UI**: ẩn nút, không render form, redirect khi vào URL cấm, banner "Chế độ chỉ xem".

---

## 4. Thiết kế Database

### 4.1 Migration `0011_add_accountant_role.sql` (chỉ enum)
```sql
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'accountant';
```
> ⚠️ Postgres không cho **dùng** giá trị enum mới trong cùng transaction với `ADD VALUE`. Supabase SQL Editor chạy mỗi lần Run là 1 transaction ⇒ **tách thành 2 file**, chạy lần lượt.

### 4.2 Migration `0012_accountant_rls.sql`
**Helper mới** (giữ nguyên các helper cũ để không ảnh hưởng policy ghi):
```sql
create or replace function public.can_read_all()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select role in ('admin','manager','accountant') from public.user_profiles where id = auth.uid()),
    false);
$$;
```

**Thay các policy READ** (drop + create lại, chỉ phần `for select`):

| Bảng | Policy | USING mới |
|---|---|---|
| `daily_sales` | `daily_sales_read` | `can_read_all() or store_id = current_user_store_id()` |
| `cash_movements` | `cash_movements_read` | như trên |
| `variable_expenses` | `var_exp_read` | như trên |
| `bank_transactions` | `bank_tx_read` | `can_read_all()` |
| `fixed_expenses` | `fixed_exp_read` | `can_read_all()` |
| `store_expenses` | `store_exp_read` | `can_read_all()` |
| `wholesale_sales` | `wholesale_read` | `can_read_all()` |
| `salary_payments` | **mới** `salary_read` (for select) | `current_user_role() = 'accountant'` — **không** dùng `can_read_all()` vì manager không được xem lương. Policy `salary_admin for all` giữ nguyên |
| `stores`, `employees` | giữ nguyên (`using (true)`) | — |
| `user_profiles` | giữ nguyên (chỉ đọc bản thân) | — |
| `audit_log` | giữ nguyên (admin) | — |

**Policy WRITE không đổi**: tất cả dùng `is_admin()` / `is_admin_or_manager()` / `store_id = current_user_store_id()`. Vì accountant có `store_id = null`, điều kiện `store_id = null` luôn `false` ⇒ không ghi được `daily_sales`, `cash_movements`, `variable_expenses`.

**Lưu ý trigger**: các trigger sync (`fn_sync_daily_sales`, …) là `SECURITY DEFINER` nhưng chỉ chạy khi có ghi vào `daily_sales`; accountant không ghi được nên không ảnh hưởng.

### 4.3 Kiểm chứng RLS bằng SQL (chạy trong SQL Editor sau migration)
```sql
-- giả lập accountant
select set_config('request.jwt.claims',
  json_build_object('sub','<ACCOUNTANT_UUID>','role','authenticated')::text, true);
set local role authenticated;
select count(*) from public.salary_payments;        -- > 0 (đọc được)
insert into public.cash_movements (move_date, store_id, direction, category, amount)
  values (current_date, (select id from stores limit 1), 'in', 'other', 1);  -- phải lỗi RLS
```

---

## 5. Thiết kế ứng dụng (Next.js)

### 5.1 `src/lib/permissions.ts` (mới) — nguồn chân lý phía app
```ts
export type UserRole = "admin" | "manager" | "staff" | "accountant";
export const READ_ONLY_ROLES: UserRole[] = ["accountant"];
export const NO_STORE_ROLES: UserRole[] = ["accountant"]; // store_id ép null; admin/manager giữ nguyên hành vi cũ
export const isReadOnly = (r: UserRole) => READ_ONLY_ROLES.includes(r);
export const canWrite   = (r: UserRole) => !isReadOnly(r);

// Quyền truy cập route — dùng chung cho Sidebar, MobileNav và requireRole()
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/dashboard": ["admin", "manager", "accountant"],
  "/sales/new": ["admin", "manager", "staff"],
  "/sales":     ["admin", "manager", "staff", "accountant"],
  "/cash":      ["admin", "manager", "staff", "accountant"],
  "/bank":      ["admin", "manager", "accountant"],
  "/expenses":  ["admin", "manager", "accountant"],
  "/employees": ["admin", "manager", "accountant"],
  "/wholesale": ["admin", "manager", "accountant"],
  "/salary":    ["admin", "accountant"],
  "/reports":   ["admin", "manager", "accountant"],
  "/settings":  ["admin"],
};
```
- Chuyển `UserRole` trong `src/lib/supabase/types.ts` sang re-export từ đây.
- `NAV[].roles` trong sidebar / mobile-nav đọc từ `ROUTE_ROLES` thay vì hard-code ở 2 nơi.

### 5.2 `src/lib/auth-server.ts` (mới) — guard server-side
```ts
export async function getProfile()              // user + profile (role, store_id); redirect /login nếu chưa đăng nhập
export async function requireRole(path: string) // redirect("/dashboard" | "/sales") nếu role ∉ ROUTE_ROLES[path]
```
- Gọi `requireRole` ở đầu **mọi** `page.tsx` trong `(app)/`. Việc này đồng thời vá lỗ hổng hiện tại (staff gõ `/salary`).
- Trang đích khi bị chặn: accountant → `/dashboard`; staff → `/sales`.
- Login redirect (`src/lib/supabase/middleware.ts`) giữ `/dashboard` vì accountant xem được dashboard.

### 5.3 Gate thao tác ghi trên từng trang
Quy tắc: **không render** (không chỉ disable) form thêm và `*RowActions` khi `isReadOnly(role)`.

| Trang | Việc cần làm |
|---|---|
| `sales/page.tsx` | Ẩn nút `+ Nhập doanh thu` (dòng 82) và `<SalesRowActions>` (dòng 201). Truyền `role` xuống. |
| `cash/page.tsx` | Ẩn `<CashForm>` và `<CashRowActions>`. |
| `bank/page.tsx` | Ẩn `<BankForm>` và `<BankRowActions>`; sửa fallback `?? "admin"` → `?? "staff"`. |
| `expenses/page.tsx` | Ẩn `<ExpenseForm>` và `<ExpenseRowActions>`. |
| `employees/page.tsx` | Ẩn `<EmployeeForm>`; `EmployeeRowActions` đã gate admin — giữ. |
| `wholesale/page.tsx` | Ẩn form, `<WholesaleRowActions>` **và** `<WholesaleMarkPaid>`. |
| `salary/page.tsx` | Ẩn `<SalaryForm>`; `SalaryRowActions` đã gate admin — giữ. |
| `reports/page.tsx` | Không đổi (chỉ đọc + in). |
| `settings/page.tsx` | Chặn hoàn toàn bằng `requireRole`. |
| `sales/new/page.tsx` | Chặn bằng `requireRole`. |

Cột "Sửa / Xoá" trong bảng: ẩn cả `<th>` khi read-only để bảng không có cột trống.

### 5.4 Banner chỉ xem
Trong `src/app/(app)/layout.tsx`, khi `isReadOnly(role)`: thêm dải mỏng dưới header
`👁 閲覧専用モード — データの閲覧のみ可能です` (theo locale). Header hiển thị nhãn role từ dict thay vì `capitalize(role)`.

### 5.5 Settings → Users
- `ROLES` trong `user-add-form.tsx` và `user-role-edit.tsx` lấy từ `ALL_ROLES`.
- Khi chọn `accountant`: ẩn select "Cửa hàng phụ trách", gửi `store_id = null`, hiện dòng gợi ý `settings.accountantHint`. Các role khác giữ nguyên hành vi cũ.
- `actionDeleteUser` thêm chặn tự xoá tài khoản đang đăng nhập ở phía server.
- Badge màu trong bảng users: `accountant` → `bg-amber-100 text-amber-700`.
- **Vá bảo mật** `user-actions.ts`: trước khi dùng `adminClient()`, tạo server client từ cookie, lấy profile của caller, `if (role !== "admin") return { error: "Forbidden" }`. Áp dụng cho cả `actionCreateUser` và `actionDeleteUser`.

### 5.6 Ngôn ngữ mặc định tiếng Nhật
Chọn phương án **nhẹ, không thêm cột DB**:
- Trong form thêm user, khi role = `accountant`, gọi `auth.admin.createUser({ user_metadata: { locale: "ja" } })`.
- Ở `src/app/login/login-form.tsx` sau đăng nhập thành công: nếu `user.user_metadata.locale` tồn tại và cookie `NEXT_LOCALE` chưa có ⇒ set cookie đó rồi mới redirect.
- Người dùng vẫn đổi được VI / JA / EN bằng `LocaleSwitcher` như bình thường.

### 5.7 i18n (vi / ja / en)
| Key | VI | JA | EN |
|---|---|---|---|
| `settings.role_accountant` | Kế toán thuế (税理士) | 税理士 | Tax accountant |
| `common.readOnlyMode` | Chế độ chỉ xem — bạn không thể thêm/sửa dữ liệu | 閲覧専用モード — データの追加・編集はできません | View-only mode — you cannot add or edit data |
| `common.forbidden` | Bạn không có quyền truy cập trang này | このページへのアクセス権限がありません | You do not have access to this page |

Rà soát `ja.json` cho các màn accountant sẽ dùng nhiều (Lương, Báo cáo, Ngân hàng): đảm bảo không còn key fallback tiếng Việt.

### 5.8 Tài liệu
- README: thêm cột **税理士** vào bảng phân quyền, thêm mục "Hướng dẫn sử dụng — 税理士" (ngắn, song ngữ JA / VI), cập nhật mục "Tạo database" liệt kê chạy migration 0001 → 0012 theo thứ tự.

---

## 6. Kế hoạch thực hiện

| # | Bước | File chính | Ước lượng |
|---|---|---|---|
| 1 | Migration enum | `supabase/migrations/0011_add_accountant_role.sql` | 10' |
| 2 | Migration RLS + helper `can_read_all()` + kiểm chứng SQL (4.3) | `0012_accountant_rls.sql` | 45' |
| 3 | `permissions.ts` + `auth-server.ts`; cập nhật `UserRole` | `src/lib/` | 45' |
| 4 | `requireRole()` vào 11 page + sidebar / mobile-nav đọc `ROUTE_ROLES` | `src/app/(app)/**/page.tsx`, `components/` | 1h |
| 5 | Gate form / row-actions 7 trang (5.3) + sửa fallback bank | `src/app/(app)/*` | 1.5h |
| 6 | Banner read-only + nhãn role ở header | `layout.tsx` | 20' |
| 7 | Settings users: role mới, ẩn store, badge, **vá server action** | `settings/*` | 45' |
| 8 | Locale mặc định JA qua `user_metadata` | `user-actions.ts`, `login-form.tsx` | 30' |
| 9 | i18n 3 file + rà `ja.json` | `src/i18n/*` | 30' |
| 10 | README + test thủ công (mục 7) | — | 1h |

Thứ tự deploy: chạy 0011 → 0012 trên Supabase **trước**, rồi deploy code (code cũ không bị hỏng bởi enum / policy mới; code mới cần policy mới để accountant đọc được).

Commit gợi ý: 1 commit DB, 1 commit permissions / guards, 1 commit UI gating + settings, 1 commit i18n / README.

---

## 7. Kế hoạch kiểm thử (thủ công)

Tạo user `zeirishi@test.jp` role `accountant`, đăng nhập trên desktop + iPhone.

**A. Hiển thị**
- [ ] Menu chỉ có: Tổng quan, Doanh thu, Tiền mặt, Ngân hàng, Chi phí, Nhân viên, Bán sỉ, Lương, Báo cáo. Không có Nhập doanh thu, Cài đặt.
- [ ] Giao diện mặc định tiếng Nhật ở lần đăng nhập đầu; đổi sang VI vẫn được.
- [ ] Banner 閲覧専用モード hiển thị trên mọi trang.
- [ ] Mỗi trang: không có nút thêm, không có cột Sửa / Xoá, không có "Đánh dấu đã thu".
- [ ] Số liệu trang Lương, Ngân hàng, Chi phí, Báo cáo **khớp** với admin xem cùng kỳ.
- [ ] Dashboard "Số dư tổng" hiển thị đúng (cần đọc cash_movements + bank_transactions toàn chuỗi).
- [ ] In báo cáo tháng hoạt động.

**B. Chặn URL**
- [ ] `/sales/new`, `/settings` → redirect `/dashboard`.
- [ ] Staff gõ `/salary`, `/bank`, `/settings` → redirect `/sales` (regression mới có nhờ `requireRole`).

**C. Chặn ghi ở RLS (bỏ qua UI)** — dùng DevTools console với session accountant:
```js
await s.from("cash_movements").insert({...})                         // expect: RLS error 42501
await s.from("daily_sales").update({ cash: 1 }).eq("id", "<id>")     // expect: 0 rows / error
await s.from("salary_payments").delete().eq("id", "<id>")            // expect: error
await s.from("user_profiles").update({ role: "admin" }).eq("id", "<own id>") // expect: error
```
- [ ] Gọi server action tạo user từ session accountant / staff → `{ error: "Forbidden" }`.

**D. Regression**
- [ ] Admin / Manager / Staff: mọi luồng nhập liệu cũ vẫn hoạt động (sales new, cash, bank, expenses, wholesale mark-paid, salary).
- [ ] `npm run build` và `npm run lint` pass.

---

## 8. Rủi ro & lưu ý

| Rủi ro | Giảm thiểu |
|---|---|
| Quên gate 1 nút ⇒ accountant bấm được | RLS vẫn chặn; UI chỉ hiện lỗi. Test mục 7C là bắt buộc. |
| Enum `ADD VALUE` lỗi "unsafe use of new value" | Tách 2 migration, chạy tuần tự. |
| Sửa policy read làm manager / staff mất quyền | `can_read_all()` là **tập mở rộng** của `is_admin_or_manager()`; giữ nguyên nhánh `store_id = current_user_store_id()`. |
| Dữ liệu lương là mật | Chỉ admin cấp role này; nêu rõ trong README. Phase 2 cân nhắc log truy cập. |
| `handle_new_user()` vẫn default `staff` | Giữ nguyên — accountant luôn được tạo qua Settings, có set role tường minh. |

---

## 9. Phase 2 (ngoài phạm vi, ghi nhận)

- **Export CSV / Excel** theo tháng (doanh thu, chi phí, lương) định dạng nhập được vào freee / 弥生 / MF クラウド — giá trị cao cho 税理士.
- **Hạn truy cập** (`access_expires_at` trên `user_profiles`) cho hợp đồng tư vấn theo kỳ.
- **Audit log đăng nhập / xem lương** cho tài khoản accountant.
- **Ghi chú / nhận xét** của 税理士 ngay trên Báo cáo tháng (bảng `report_comments`, accountant được INSERT riêng bảng này).
- **Bảng thuế tiêu dùng (消費税)**: tách 8% / 10% trong doanh thu — cần thay đổi schema `daily_sales`.
