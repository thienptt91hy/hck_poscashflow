# POS CashFlow

Hệ thống quản lý doanh thu và dòng tiền cho chuỗi cửa hàng tại Nhật.

- **Stack**: Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase · Recharts
- **Ngôn ngữ UI**: Tiếng Việt (mặc định) · 日本語 · English
- **Múi giờ**: Asia/Tokyo (JST) · **Tiền tệ**: JPY (¥)
- **Thiết bị**: Tương thích đầy đủ trên Desktop, iPhone, Android

---

## Phân quyền

| Tính năng | Admin | Manager | Staff |
|-----------|:-----:|:-------:|:-----:|
| Tổng quan (Dashboard) | ✅ | ✅ | ❌ |
| Nhập doanh thu mới | ✅ | ✅ | ✅ |
| Xem / lọc doanh thu + biểu đồ | ✅ | ✅ | ✅ |
| Tiền mặt (sổ quỹ) | ✅ | ✅ | ✅ |
| Ngân hàng | ✅ | ✅ | ❌ |
| Chi phí | ✅ | ✅ | ❌ |
| Nhân viên | ✅ | ✅ | ❌ |
| Bán sỉ | ✅ | ✅ | ❌ |
| Lương | ✅ | ❌ | ❌ |
| Báo cáo tháng | ✅ | ✅ | ❌ |
| Cài đặt (stores, users, chi phí cố định) | ✅ | ❌ | ❌ |

---

## Hướng dẫn sử dụng — Admin

Admin có toàn quyền truy cập và quản lý hệ thống.

### Đăng nhập

Truy cập URL ứng dụng → nhập **Email** và **Mật khẩu** → bấm **Đăng nhập**.

Để đổi ngôn ngữ giao diện: bấm **VI / JA / EN** ở góc trên phải (desktop) hoặc trong menu mobile.

---

### 1. Tổng quan (Dashboard)

Trang tổng hợp tình hình kinh doanh theo thời gian thực với biểu đồ so sánh kỳ trước.

**Bộ lọc thời gian** (góc trên): Hôm nay · Hôm qua · 7 ngày · Tháng này · Tháng trước

**KPI Cards** (so sánh với kỳ trước cùng độ dài — badge % xanh = tăng, đỏ = giảm):

| Card | Nội dung |
|------|---------|
| Doanh thu | Tổng doanh thu kỳ chọn |
| Lượt khách | Tổng số khách |
| TB/khách | Doanh thu trung bình mỗi khách |
| Chi phí | Tổng chi phí phát sinh |
| Lợi nhuận | Ước tính = Doanh thu − Chi phí − Lương |
| Số dư tổng | Tiền mặt quỹ + Số dư ngân hàng (thời gian thực) |

**Biểu đồ**:
- Area chart: doanh thu theo ngày, xếp chồng theo từng cửa hàng
- Donut chart: cơ cấu thanh toán (Tiền mặt / QR-Thẻ / Chuyển khoản)
- Bar chart: so sánh doanh thu từng cửa hàng trong kỳ

---

### 2. Doanh thu

#### 2a. Nhập doanh thu mới

Menu **Nhập doanh thu** hoặc nút **+ Nhập doanh thu** ở trang danh sách:

1. Chọn **Ngày** và **Cửa hàng**
2. Nếu cửa hàng có cafe/bánh mì: chọn loại doanh thu (Chính / Cafe-Bánh mì)
3. Nhập **Số khách**
4. Nhập doanh thu theo từng phương thức: Tiền mặt / QR-Thẻ / Chuyển khoản
5. **Tổng doanh thu** tự động tính — bấm **Lưu**

#### 2b. Xem và phân tích doanh thu

**Bộ lọc thời gian**: Hôm nay · Hôm qua · 7 ngày · Tháng này · Tháng trước

**Bộ lọc cửa hàng**: Tất cả · [tên từng cửa hàng] — hai bộ lọc hoạt động kết hợp.

**4 KPI card**: Tổng doanh thu, Tổng khách, TB/khách, Doanh thu cafe/bakery

**Biểu đồ**:
- Khi **Tất cả**: area chart stacked theo cửa hàng + donut payment mix + bar so sánh cửa hàng
- Khi **1 cửa hàng**: đường doanh thu theo ngày + donut payment mix

**Bảng**: hiển thị từng bản ghi, có hàng **Tổng cộng** ở cuối. Mỗi hàng có nút ✏️ Sửa và 🗑️ Xoá.

---

### 3. Tiền mặt

Quản lý sổ quỹ tiền mặt của từng cửa hàng.

Trang hiển thị **Số dư hiện tại** của mỗi cửa hàng (= tổng thu − tổng chi từ đầu).

**Ghi tiền mặt mới** — bấm **Ghi tiền mặt**:

| Trường | Ghi chú |
|--------|---------|
| Ngày | Ngày giao dịch |
| Cửa hàng | Chọn cửa hàng |
| Loại | 📥 Thu / 📤 Chi |
| Danh mục | Tự động thay đổi theo loại Thu/Chi (xem bên dưới) |
| Số tiền | ¥ |
| Ghi chú | Tuỳ chọn |

Danh mục **Thu**: Doanh thu · COD · Điều chỉnh · Khác

Danh mục **Chi**: Mua vật dụng · NV mang về · Nộp ngân hàng · Điều chỉnh · Khác

Mỗi dòng trong bảng có nút ✏️ Sửa và 🗑️ Xoá.

---

### 4. Ngân hàng

Quản lý sổ giao dịch ngân hàng.

**Thêm giao dịch** — bấm **Thêm giao dịch**:

| Trường | Ghi chú |
|--------|---------|
| Ngày | Ngày giao dịch |
| Loại | 📥 Nhận / 📤 Chi |
| Danh mục | Tiền từ cửa hàng · Nhập hàng · Chi phí · Lương · Khác |
| Phương thức | Chuyển khoản · Thẻ tín dụng · Tiền mặt · QR |
| Đơn vị / Nội dung | Tên nhà cung cấp hoặc mô tả nội dung |
| Phí | Phí giao dịch ngân hàng (nếu có) |
| Số tiền | ¥ |
| Ghi chú | Tuỳ chọn |

---

### 5. Chi phí

Trang chia làm 2 phần:

**Chi phí cố định hàng tháng**: Danh sách tự động từ phần Cài đặt (thuê mặt bằng, điện, wifi…). Chỉ xem tại đây, cấu hình trong **Cài đặt → Chi phí cố định**.

**Chi phí phát sinh** — bấm **Thêm chi phí**:

| Trường | Ghi chú |
|--------|---------|
| Ngày | Ngày phát sinh |
| Cửa hàng | Cửa hàng liên quan |
| Danh mục | Tên danh mục chi phí |
| Thanh toán từ | Tiền mặt / Ngân hàng |
| Số tiền | ¥ |
| Ghi chú | Tuỳ chọn |

---

### 6. Nhân viên

Quản lý danh sách nhân viên của chuỗi.

**Thêm nhân viên** — bấm **Thêm nhân viên**:

| Trường | Ghi chú |
|--------|---------|
| Tên | Tên đầy đủ |
| Cửa hàng | Cửa hàng nhân viên làm việc |
| Vị trí / Chức danh | VD: Bếp chính, Thu ngân, Phục vụ |
| Trạng thái | Đang làm / Nghỉ việc |

Bấm ✏️ để sửa thông tin. Bấm 🗑️ để xoá — chỉ xoá được khi nhân viên chưa có bản ghi lương.

---

### 7. Bán sỉ

Ghi nhận đơn hàng bán sỉ cho đối tác / công ty.

**Thêm đơn bán sỉ** — bấm **Thêm đơn bán sỉ**:

| Trường | Ghi chú |
|--------|---------|
| Ngày | Ngày bán |
| Khách hàng / Công ty | Tên đối tác |
| Phương thức | Tiền mặt · Chuyển khoản · QR · Thẻ tín dụng |
| Số tiền | ¥ |
| Đã thanh toán | Tích nếu đã thu tiền ngay |
| Hạn thanh toán | Điền nếu chưa thanh toán |
| Ghi chú | Tuỳ chọn |

Đơn **chưa thanh toán** hiển thị nút **Đánh dấu đã thu** để cập nhật nhanh khi thu được tiền.

---

### 8. Lương *(Admin only)*

Ghi nhận thanh toán lương cho nhân viên.

Trang hiển thị **Tổng lương tháng hiện tại** ở trên cùng.

**Ghi lương** — bấm **Ghi lương**:

| Trường | Ghi chú |
|--------|---------|
| Nhân viên | Chọn từ danh sách nhân viên đang hoạt động |
| Tháng lương | Tháng/năm tính lương |
| Số tiền | ¥ |
| Phương thức | Tiền mặt · Chuyển khoản · QR · Thẻ |
| Ghi chú | Tuỳ chọn |

Mỗi bản ghi có nút ✏️ Sửa và 🗑️ Xoá.

---

### 9. Báo cáo tháng

Tổng hợp toàn bộ dữ liệu tài chính theo từng tháng.

Chọn tháng bằng bộ chọn tháng/năm ở góc trên. Bấm **🖨 In báo cáo** để mở giao diện in.

**Nội dung báo cáo**:

| Mục | Công thức |
|-----|-----------|
| Doanh thu theo cửa hàng | Bảng ngang, mỗi cột 1 cửa hàng |
| Tổng doanh thu | Tổng tất cả cửa hàng |
| Thu tiền mặt / Chi tiền mặt | Từ sổ quỹ |
| Nhận ngân hàng / Chi ngân hàng | Từ sổ ngân hàng |
| Chi phí cố định | Liệt kê từng khoản |
| Chi phí phát sinh | Tổng chi phí variable trong tháng |
| Lương nhân viên | Tổng lương đã thanh toán trong tháng |
| Doanh thu bán sỉ | Tổng đơn bán sỉ trong tháng |
| **Lợi nhuận gộp** | = Doanh thu − Chi phí cố định − Chi phí phát sinh |
| **Lợi nhuận ròng (ước tính)** | = Lợi nhuận gộp − Lương |

---

### 10. Cài đặt *(Admin only)*

#### Chi phí cố định

Danh sách chi phí định kỳ hàng tháng (thuê mặt bằng, điện, wifi, bảo hiểm…).

- Bấm ✏️ để sửa tên hoặc số tiền
- Bấm **+ Thêm chi phí cố định** để thêm khoản mới

#### Cửa hàng

Quản lý danh sách cửa hàng trong chuỗi. Không giới hạn số lượng.

**Thêm cửa hàng** — bấm **Thêm cửa hàng**:

| Trường | Bắt buộc | Ghi chú |
|--------|:--------:|---------|
| Mã (Code) | ✅ | Tối đa 10 ký tự, tự động VIẾT HOA. VD: `SETO` |
| Tên VI | ✅ | Tên tiếng Việt |
| Tên JA | | Tên tiếng Nhật — hiển thị khi giao diện JA |
| Tên EN | | Tên tiếng Anh — hiển thị khi giao diện EN |
| Có cafe/bánh mì | | Cho phép nhập doanh thu cafe/bakery riêng |
| Thứ tự hiển thị | | Số nhỏ hiển thị trước trong các dropdown |

**Sửa cửa hàng** — bấm ✏️: sửa tất cả thông tin, bật/tắt trạng thái **Đang hoạt động**.

**Xoá cửa hàng** — bấm 🗑️: chỉ xoá được khi cửa hàng **chưa có dữ liệu liên quan** (doanh thu, nhân viên, giao dịch tiền mặt/ngân hàng). Hệ thống sẽ báo lỗi nếu có dữ liệu ràng buộc.

#### Người dùng

Quản lý tài khoản đăng nhập của toàn bộ hệ thống.

**Thêm người dùng** — bấm **Thêm người dùng**:

| Trường | Ghi chú |
|--------|---------|
| Email | Địa chỉ email đăng nhập |
| Họ tên | Tên hiển thị trong hệ thống |
| Mật khẩu | Tối thiểu 6 ký tự |
| Vai trò | Admin · Manager · Staff |
| Cửa hàng phụ trách | Dành cho Staff — gắn với 1 cửa hàng cụ thể |

Bấm ✏️ để sửa vai trò, cửa hàng phụ trách, tên. Bấm 🗑️ để xoá tài khoản (không thể tự xoá tài khoản đang đăng nhập).

---

## Hướng dẫn sử dụng — Manager

Manager xem và nhập đầy đủ dữ liệu kinh doanh hàng ngày, không có quyền quản lý lương và cấu hình hệ thống.

### Menu hiển thị

| Menu | Quyền hạn |
|------|-----------|
| Tổng quan | Xem dashboard, KPI, biểu đồ theo kỳ |
| Nhập doanh thu | Nhập doanh thu mới cho bất kỳ cửa hàng |
| Doanh thu | Xem, lọc, sửa, xoá tất cả bản ghi |
| Tiền mặt | Xem số dư, ghi thu/chi tiền mặt, sửa/xoá |
| Ngân hàng | Xem, thêm, sửa, xoá giao dịch ngân hàng |
| Chi phí | Xem chi phí cố định, thêm/sửa/xoá chi phí phát sinh |
| Nhân viên | Thêm, sửa, xoá nhân viên |
| Bán sỉ | Thêm, sửa, xoá đơn bán sỉ, cập nhật trạng thái thanh toán |
| Báo cáo | Xem báo cáo tháng, in báo cáo |

> **Không có quyền truy cập**: Lương, Cài đặt

Thao tác nhập liệu từng màn hình giống Admin. Xem chi tiết ở phần hướng dẫn Admin phía trên.

---

## Hướng dẫn sử dụng — Staff

Staff chuyên nhập doanh thu hàng ngày và theo dõi quỹ tiền mặt.

### Menu hiển thị

| Menu | Quyền hạn |
|------|-----------|
| Nhập doanh thu | Nhập doanh thu — cửa hàng tự động chọn theo tài khoản |
| Doanh thu | Xem lịch sử, lọc theo thời gian/cửa hàng, biểu đồ |
| Tiền mặt | Xem số dư quỹ, ghi thu/chi tiền mặt |

> **Không có quyền truy cập**: Tổng quan, Ngân hàng, Chi phí, Nhân viên, Bán sỉ, Lương, Báo cáo, Cài đặt

### Quy trình nhập liệu hàng ngày

1. Cuối ngày, mở ứng dụng → vào **Nhập doanh thu**
2. Cửa hàng tự động điền theo tài khoản (Staff gắn với 1 cửa hàng)
3. Chọn ngày hôm nay, nhập **Số khách**
4. Nhập doanh thu: **Tiền mặt** / **QR-Thẻ** / **Chuyển khoản** — tổng tự tính
5. Bấm **Lưu**
6. Nếu có tiền mặt nộp quỹ hoặc chi ra → vào **Tiền mặt** → **Ghi tiền mặt**

### Xem lại doanh thu

Vào menu **Doanh thu**:
- Dùng bộ lọc **thời gian** để xem theo ngày/tuần/tháng
- Dùng bộ lọc **cửa hàng** để xem từng cửa hàng
- Biểu đồ tự động cập nhật theo bộ lọc

---

## Sử dụng trên Mobile (iPhone / Android)

1. Mở **Safari** (iPhone) hoặc **Chrome** (Android) → truy cập URL ứng dụng
2. Đăng nhập bình thường
3. Bấm icon **☰** (góc trên bên trái) để mở menu điều hướng
4. Tất cả form nhập liệu được tối ưu cho màn hình nhỏ — bàn phím số tự bật cho các ô nhập số tiền

**Tip**: Trên iPhone, chọn **"Thêm vào màn hình chính"** (Share → Add to Home Screen) để dùng như app native.

---

## Cài đặt môi trường lần đầu (Developer)

### Yêu cầu

- Node.js 20+
- Tài khoản Supabase (free tier đủ dùng)

### Cài đặt

```bash
git clone <repo-url>
cd POS_CashFlow
npm install
```

### Biến môi trường

Tạo file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

Lấy keys tại: Supabase Dashboard → **Project Settings → API Keys**

### Tạo database

Vào **Supabase Dashboard → SQL Editor → New query**:

1. Paste nội dung `supabase/migrations/0001_initial_schema.sql` → **Run**
2. Paste nội dung `supabase/seed.sql` → **Run**

Kiểm tra: **Table Editor** sẽ thấy 12 tables, bảng `stores` có dữ liệu mẫu.

### Tạo tài khoản Admin

Vào **Supabase Dashboard → Authentication → Users → Add user → Create new user**:
- Email: email admin
- Password: mật khẩu mạnh
- ✅ Auto Confirm User

Sau đó mở **SQL Editor** chạy:

```sql
UPDATE public.user_profiles
SET role = 'admin', full_name = 'Admin'
WHERE email = 'your-email@example.com';
```

### Chạy local

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) → tự redirect đến `/login`.

### Build production

```bash
npm run build
npm start
```

### Deploy lên Vercel

1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com) → **New Project** → Import repo
3. **Environment Variables**: paste toàn bộ nội dung `.env.local`
4. **Deploy**

---

## Cấu trúc dự án

```
src/
├── app/
│   ├── (app)/                   # Các trang yêu cầu đăng nhập
│   │   ├── dashboard/           # Tổng quan
│   │   ├── sales/               # Doanh thu (list + filter + charts)
│   │   │   └── new/             # Nhập doanh thu nhanh
│   │   ├── cash/                # Tiền mặt
│   │   ├── bank/                # Ngân hàng
│   │   ├── expenses/            # Chi phí
│   │   ├── employees/           # Nhân viên
│   │   ├── wholesale/           # Bán sỉ
│   │   ├── salary/              # Lương (admin only)
│   │   ├── reports/             # Báo cáo tháng
│   │   └── settings/            # Cài đặt (admin only)
│   ├── login/                   # Trang đăng nhập
│   └── auth/logout/             # Đăng xuất
├── components/
│   ├── ui/                      # Button, Input, Card, Select, Label
│   ├── sidebar.tsx              # Navigation desktop
│   ├── mobile-nav.tsx           # Navigation mobile (hamburger)
│   └── locale-switcher.tsx      # Đổi ngôn ngữ
├── i18n/
│   ├── dictionaries.ts          # Type-safe dictionary loader
│   └── vi.json · ja.json · en.json
└── lib/
    ├── supabase/                # client · server · middleware · types
    ├── format.ts                # formatYen, formatJST, TZ
    └── locale-server.ts         # getLocale() (server-only)

supabase/
├── migrations/0001_initial_schema.sql   # Schema đầy đủ
└── seed.sql                             # Dữ liệu mẫu
```

---

## Commands

```bash
npm run dev       # Dev server (localhost:3000)
npm run build     # Production build + type check
npm run lint      # ESLint
```
