# Spec: Xuất báo cáo Excel / CSV cho 税理士 (Doanh thu & Chi tiêu)

| | |
|---|---|
| Trạng thái | Draft — chờ duyệt |
| Ngày | 2026-10-14 |
| Phạm vi | Schema bổ sung thuế suất · Route export server-side · UI nút xuất · Mapping tài khoản kế toán |
| Phụ thuộc | Role `accountant` (đã triển khai, spec `accountant-readonly-role.md`) |
| Ước lượng | Phase 1: ~2.5 ngày dev + 1 ngày test với 税理士 |

---

## 1. Mục tiêu

Cho phép Admin / Manager / 税理士 tải về số liệu một kỳ (tháng hoặc khoảng ngày) dưới 2 dạng:

1. **Excel 税理士パック (.xlsx)** — nhiều sheet, người đọc được, đủ để 税理士 lập sổ sách, tính 消費税 và phân bổ thuế địa phương theo cửa hàng.
2. **仕訳 CSV (弥生汎用形式)** — file bút toán để nhập thẳng vào phần mềm kế toán. Chọn định dạng 弥生 vì cả **freee** (menu 弥生会計仕訳インポート), **マネーフォワード** (chọn 弥生形式) và **弥生会計** đều nhập được, không cần 3 bộ mapping.

Kèm **CSV UTF-8 (BOM)** cho từng sheet để mở bằng Excel / Google Sheets không lỗi font.

---

## 2. Nghiên cứu: 税理士 ở Aichi cần gì từ dữ liệu này

### 2.1 Thuế quốc gia (消費税) — ảnh hưởng trực tiếp đến cấu trúc export

| Quy định | Nội dung | Ảnh hưởng đến export |
|---|---|---|
| **軽減税率** | Ăn tại chỗ 10%, mang về / giao hàng 8%. Bánh mì, cafe mang đi, hàng thực phẩm bán sỉ = 8%. | **Doanh thu phải tách được phần 8% và phần 10%.** Hiện `daily_sales` không có trường này → đây là **lỗ hổng lớn nhất**. |
| **インボイス制度** (từ 10/2023) | Khấu trừ thuế đầu vào cần 適格請求書 có số đăng ký `T + 13 số`. Mua từ nhà cung cấp không đăng ký: 10/2026 → 9/2028 chỉ khấu trừ **70%**, 10/2028 → 9/2030 **50%**, 10/2030 → 9/2031 **30%**, sau đó 0%. | Chi phí nên có cờ **"có hoá đơn 適格 hay không"** để 税理士 áp đúng tỷ lệ. |
| **少額特例** | Mua < ¥10,000 (tax-in) chỉ cần ghi sổ, không cần インボイス. Đến **30/9/2029**, áp dụng khi doanh thu chịu thuế kỳ gốc ≤ 1 億. | Phần lớn chi tiền mặt mua hàng hằng ngày của shop rơi vào đây → export vẫn cần ngày, số tiền, nội dung, tên nơi mua. |
| **2割特例 kết thúc 30/9/2026** | Với cá nhân, năm 2026 là năm cuối. Từ 2027–2028 có **3割特例** (chỉ cá nhân, nộp 30% thuế đầu ra). Pháp nhân không được. | Nếu shop là pháp nhân hoặc không đủ điều kiện → phải chọn **本則課税** (cần chi tiết thuế đầu vào) hoặc **簡易課税** (飲食店 = 第4種, みなし仕入率 60%; chỉ cần doanh thu tách theo thuế suất). **Cần hỏi 税理士 shop đang dùng phương pháp nào** — nó quyết định phần chi phí cần chi tiết tới đâu. |
| **Dự kiến 4/2027** | Chính phủ đã quyết nghị giảm thuế thực phẩm 8% → **1%** trong 2 năm, chờ Quốc hội thông qua mùa thu 2026. | **Không hard-code 8/10%.** Lưu thuế suất là dữ liệu (số nguyên) trên từng dòng. |
| **電子帳簿保存法** | Dữ liệu giao dịch điện tử phải lưu dạng điện tử từ 1/2024. Sổ sách tự lập (売上帳, 現金出納帳) lưu điện tử là tuỳ chọn. Doanh thu ≤ 5,000万 được miễn yêu cầu tìm kiếm. | File export là **báo cáo phái sinh**; bản ghi gốc nằm trong DB. Export nên có cột `id` + `created_at` để truy ngược. Biên lai chi phí vẫn phải giữ giấy / scan ngoài app (Phase 2: upload ảnh). |

### 2.2 Thuế địa phương Aichi — ảnh hưởng đến cách nhóm dữ liệu

| Thuế | Ai nộp | Cần gì từ export |
|---|---|---|
| **個人事業税** (nếu chủ shop là cá nhân) | Nộp cho 愛知県. 飲食店業 = 第1種, **5%**, 事業主控除 **¥2,900,000**/năm. Không cần khai riêng — tỉnh tính từ 確定申告 所得税. Nộp 2 đợt **tháng 8 và 11**. 青色申告特別控除 65万 **không** được trừ khi tính thuế này. | Lợi nhuận năm chính xác → export cần **đủ 12 tháng**, không chỉ 1 tháng. |
| **法人県民税 / 法人事業税** (nếu là pháp nhân) | Nộp 愛知県. Vốn ≤ 1 億 và lợi nhuận ≤ 5,000万 dùng thuế suất chuẩn. | Lợi nhuận năm. |
| **法人市民税** | Nộp cho **từng thành phố có cửa hàng**: 瀬戸市, 小牧市, 江南市 (+ thành phố của tiệm bánh mì). 均等割 tính theo số 従業者 mỗi nơi; 法人税割 phân bổ theo 従業者数. | **Số nhân viên theo cửa hàng** + **doanh thu theo cửa hàng** → export sheet 店舗マスタ. Hiện `stores` **chưa có trường thành phố**. |
| **事業所税** | Chỉ 名古屋市 (và các đô thị lớn), miễn nếu ≤ 1,000 ㎡ và ≤ 100 nhân viên. | Không áp dụng cho chuỗi này trừ khi mở ở Nagoya với diện tích lớn. Không cần làm gì. |

### 2.3 Kết luận cho thiết kế
1. **Bắt buộc Phase 1**: tách doanh thu 8% / 10%; chi phí có thuế suất + cờ hoá đơn 適格; cửa hàng có thành phố; export theo tháng **và** theo năm.
2. Thuế suất là dữ liệu, không hằng số.
3. Phần mềm kế toán: xuất 弥生形式, mapping tên tài khoản để trong Settings (JSON) cho 税理士 chỉnh.

---

## 3. Hiện trạng dữ liệu & khoảng trống

| Bảng | Có | Thiếu cho thuế |
|---|---|---|
| `daily_sales` | ngày, cửa hàng, stream (main / cafe_bakery), cash / qr_card / bank_transfer, cash_expense_items | **Phần doanh thu 8%**; thuế suất |
| `variable_expenses` | ngày, cửa hàng, category (食材・仕入, 日用品, 交通費, 設備, その他), paid_from, note | **tax_rate**, **vendor**, **cờ インボイス**; category là text tự do (その他 nhập tay) |
| `fixed_expenses` | tên VI/JA, amount, category (equipment / service / insurance / vehicle / tax) | tax_rate (保険・年金 / 税金 = 対象外; Web / カード機 = 10%); không có bản ghi "đã trả tháng X" — chỉ là template |
| `salary_payments` | nhân viên, cửa hàng, tháng, amount, method | Không cần thuế suất (不課税). Không có 源泉徴収 → ngoài phạm vi |
| `wholesale_sales` | ngày, khách, amount, method, paid, due_date | tax_rate (thực phẩm 8%), store_id có (0002) |
| `bank_transactions` | có `fee` (支払手数料 10%) | — |
| `cash_movements` | đủ cho 現金出納帳 | — |
| `stores` | tên 3 ngôn ngữ | **city** (thành phố), **default_tax_rate** |
| `employees` | active, store | đủ để đếm 従業者数 |

---

## 4. Thiết kế Database — migration `0014_tax_fields.sql`

Toàn bộ là **thêm cột có default**, không đổi dữ liệu cũ:

```sql
-- Cửa hàng
alter table public.stores
  add column if not exists city             text,            -- '瀬戸市', '小牧市', '江南市'…
  add column if not exists default_tax_rate smallint not null default 10
      check (default_tax_rate in (0, 1, 8, 10));             -- 1 dự phòng cho 2027

-- Doanh thu: phần thuộc thuế suất giảm (mang về / bánh mì)
alter table public.daily_sales
  add column if not exists reduced_rate_revenue int not null default 0
      check (reduced_rate_revenue >= 0);
-- Quy ước: reduced_rate_revenue ≤ total_revenue; phần còn lại là thuế suất chuẩn của cửa hàng.
-- Backfill 1 lần cho dữ liệu cũ (chạy thủ công sau khi 税理士 xác nhận):
--   update daily_sales set reduced_rate_revenue = total_revenue
--   where store_id = (select id from stores where code = 'BANHMI') or revenue_stream = 'cafe_bakery';

-- Chi phí phát sinh
alter table public.variable_expenses
  add column if not exists tax_rate           smallint not null default 10 check (tax_rate in (0, 1, 8, 10)),
  add column if not exists vendor             text,
  add column if not exists invoice_registered boolean;        -- null = chưa rõ, true = có số T, false = không
-- Backfill gợi ý: category = '食材・仕入' → tax_rate = 8

-- Bán sỉ
alter table public.wholesale_sales
  add column if not exists tax_rate smallint not null default 8 check (tax_rate in (0, 1, 8, 10));

-- Chi phí cố định
alter table public.fixed_expenses
  add column if not exists tax_rate smallint not null default 10 check (tax_rate in (0, 1, 8, 10));
-- Backfill: category in ('insurance','tax') → 0

-- Mapping tài khoản kế toán (1 dòng JSON, admin / 税理士 sửa trong Settings)
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
-- RLS: đọc = can_read_all(); ghi = is_admin()
```

`app_settings.key = 'journal_mapping'` mặc định:

```json
{
  "accounts": {
    "cash": "現金", "bank": "普通預金", "receivable_card": "売掛金",
    "sales": "売上高", "sales_wholesale": "売上高",
    "purchase": "仕入高", "supplies": "消耗品費", "travel": "旅費交通費",
    "equipment": "消耗品費", "other_expense": "雑費",
    "salary": "給料手当", "bank_fee": "支払手数料",
    "insurance": "法定福利費", "tax": "租税公課", "rent": "地代家賃", "utilities": "水道光熱費"
  },
  "expense_category_map": {
    "食材・仕入": "purchase", "日用品": "supplies", "交通費": "travel", "設備": "equipment", "その他": "other_expense"
  },
  "tax_labels": {
    "sales_10": "課税売上10%", "sales_8": "課税売上8%（軽）",
    "purchase_10": "課対仕入10%", "purchase_8": "課対仕入8%（軽）",
    "exempt": "対象外"
  },
  "store_as_department": true
}
```

> Tên 税区分 của 弥生 cần đối chiếu trang "インポートデータの税区分" của Yayoi trước khi cố định (trang format chính thức xác nhận cột, nhưng không in sẵn nhãn). Vì vậy nhãn nằm trong JSON để 税理士 sửa không cần deploy.

---

## 5. Thiết kế export

### 5.1 Tham số chung
- `from`, `to` (YYYY-MM-DD) — UI cung cấp preset **Tháng này / Tháng trước / Năm tài chính (1/1–12/31 hoặc kỳ pháp nhân) / Tuỳ chọn**.
- `store` = all | id.
- `format` = `xlsx` | `csv-journal` | `csv-<sheet>`.
- Ngôn ngữ header: theo locale hiện tại (税理士 sẽ dùng JA).

### 5.2 Excel 税理士パック — các sheet

| # | Sheet | Nguồn | Cột chính |
|---|---|---|---|
| 1 | `サマリー` | tổng hợp | Kỳ, tổng doanh thu theo thuế suất (10% / 8%), thuế đầu ra ước tính, tổng chi theo thuế suất, lương, lợi nhuận; **bảng theo cửa hàng** |
| 2 | `売上日計` | `daily_sales` | 日付, 店舗, 市, 区分(main/cafe), 客数, 現金, QR・カード, 振込, 現金仕入(cash_expense), 売上合計, **うち8%対象**, **うち10%対象**, 消費税(8%), 消費税(10%), メモ, id |
| 3 | `卸売` | `wholesale_sales` | 日付, 店舗, 取引先, 金額, 税率, 支払方法, 入金済, 期日, メモ |
| 4 | `経費` | `variable_expenses` | 日付, 店舗, カテゴリ, 勘定科目(mapping), 取引先, 金額, 税率, 税額, インボイス(有/無/不明), 支払元, 1万円未満(少額特例), メモ, 売上連動(ref_table), id |
| 5 | `固定費` | `fixed_expenses` × số tháng trong kỳ | 項目(JA), 金額/月, 税率, 月数, 合計 |
| 6 | `給与` | `salary_payments` | 対象月, 従業員, 店舗, 市, 金額, 支払方法, 支払日 |
| 7 | `現金出納帳` | `cash_movements` | 日付, 店舗/共通, 入金, 出金, 残高(running), 区分, 摘要, 自動/手動 |
| 8 | `預金出納帳` | `bank_transactions` | 日付, 区分, 取引先, 入金, 出金, 手数料, 残高(running), 摘要 |
| 9 | `店舗マスタ` | `stores` + `employees` | コード, 店舗名, 市, 既定税率, 在籍従業員数(kỳ), 売上合計(kỳ) → phục vụ 法人市民税 分割 |

Kỹ thuật: cột tiền định dạng `#,##0`, ngày `yyyy/mm/dd`, header bold + freeze pane, tổng ở dòng cuối bằng **công thức SUM** (税理士 hay kiểm tra lại trong Excel), sheet 1 có công thức tham chiếu sheet khác.

### 5.3 仕訳 CSV (弥生汎用形式)
- 25 cột theo đúng thứ tự A–Y của tài liệu Yayoi, **không header**, encoding **Shift_JIS** (CP932), CRLF, ngày `yyyy/mm/dd`.
- 識別フラグ: dùng **2000** (bút toán 1 dòng) cho mọi dòng → tránh lỗi nhiều dòng.
- 摘要 ≤ 30 ký tự: `店舗コード 内容` (vd `KONAN 売上(現金)`).
- 借方部門 / 貸方部門: tên cửa hàng nếu `store_as_department` (弥生 bỏ qua cột này nhưng freee/MF giữ được).

Quy tắc sinh bút toán (mỗi ngày × cửa hàng):

| Nghiệp vụ | 借方 | 貸方 | 税区分 (bên 貸/借 có thuế) |
|---|---|---|---|
| Doanh thu tiền mặt (gross = cash + cash_expense) | 現金 | 売上高 | tách 2 dòng: 課税売上10% và 課税売上8%（軽） theo tỷ lệ `reduced_rate_revenue / total_revenue` |
| Doanh thu QR / thẻ | 売掛金 | 売上高 | như trên |
| Doanh thu chuyển khoản | 普通預金 | 売上高 | như trên |
| Chi tiền mặt mua hàng tại quầy (cash_expense_items) | 仕入高 | 現金 | 課対仕入8%（軽） |
| Chi phí phát sinh | tài khoản theo mapping | 現金 / 普通預金 | 課対仕入 theo `tax_rate`; `invoice_registered = false` → thêm chữ `※非適格` vào 摘要 |
| Phí ngân hàng (`fee`) | 支払手数料 | 普通預金 | 課対仕入10% |
| Lương | 給料手当 | 現金 / 普通預金 | 対象外 |
| Bán sỉ chưa thu | 売掛金 | 売上高 | theo `tax_rate` |
| Bán sỉ đã thu / 入金 | 現金 / 普通預金 | 売掛金 | 対象外 |
| Nộp tiền mặt vào ngân hàng (`deposit_to_bank`) | 普通預金 | 現金 | 対象外 |
| 固定費 | theo category (保険→法定福利費, 税金→租税公課…) | 普通預金 | theo `tax_rate`, 0 → 対象外 |

Bỏ qua các dòng `cash_movements` / `bank_transactions` có `ref_table` (auto-sync) để **không trùng** với bút toán đã sinh từ bảng gốc.

### 5.4 CSV từng sheet
UTF-8 **có BOM**, header JA, cùng dữ liệu với sheet tương ứng. Dành cho ai không dùng Excel hoặc muốn import Google Sheets.

---

## 6. Thiết kế ứng dụng

### 6.1 Route handler `src/app/api/export/route.ts`
- `GET /api/export?from&to&store&format` — Node runtime, `export const dynamic = "force-dynamic"`.
- Auth: `requireRole("/reports")` + Supabase server client → RLS tự áp dụng (accountant đọc được tất cả).
- Stream file với header `Content-Disposition: attachment; filename*=UTF-8''PosCashFlow_2026-10_税理士パック.xlsx`.
- Giới hạn kỳ ≤ 13 tháng/lần để tránh query lớn.

### 6.2 Thư viện
- `exceljs` (ghi .xlsx có công thức, định dạng số, freeze pane).
- `iconv-lite` (Shift_JIS cho file 弥生).
- Không cần thư viện CSV; tự escape (dấu phẩy, ngoặc kép, xuống dòng).

### 6.3 Module `src/lib/export/`
```
export/
├── query.ts        # fetch đủ dữ liệu kỳ (1 lần, dùng chung 3 format)
├── tax.ts          # tách 8/10%, tính 税額 (nội thuế: amount × r / (100 + r), làm tròn xuống)
├── journal.ts      # sinh bút toán theo bảng 5.3 → mảng JournalLine
├── yayoi-csv.ts    # JournalLine → 25 cột Shift_JIS
├── xlsx.ts         # 9 sheet
└── csv.ts          # sheet → CSV BOM
```
Tách `journal.ts` thuần (không I/O) để **unit test** bằng dữ liệu mẫu: tổng 借方 = tổng 貸方, tổng 売上高 = tổng doanh thu, không dòng nào có cả 2 bên = 0.

### 6.4 UI
- Trang **Báo cáo** (`/reports`): thêm nút **📥 Xuất Excel** và **📥 仕訳CSV (弥生)** cạnh nút In; dùng `MonthPicker` hiện có + thêm chọn "Cả năm".
- Trang **Doanh thu** (sales list): nút "Xuất CSV" theo bộ lọc đang chọn (tái dùng `csv-sales`).
- Role: admin, manager, accountant đều thấy nút (export là **đọc**, không vi phạm read-only).
- Settings (admin): card **"Kế toán / 仕訳マッピング"** sửa JSON `journal_mapping` với validate; card **Cửa hàng** thêm 2 trường 市 và 既定税率.

### 6.5 Form nhập liệu (thay đổi nhỏ, không bắt buộc nhập)
| Form | Thêm |
|---|---|
| Nhập doanh thu | Ô **"Trong đó mang về / 8%"** (mặc định: `= tổng` nếu cửa hàng `default_tax_rate = 8` hoặc stream cafe_bakery, ngược lại 0). Staff có thể bỏ qua. |
| Chi phí | Thuế suất (auto theo category: 食材・仕入 → 8%, còn lại 10%), Nhà cung cấp, cờ インボイス (3 trạng thái). |
| Bán sỉ | Thuế suất (mặc định 8%). |
| Chi phí cố định (Settings) | Thuế suất. |

### 6.6 i18n
Thêm nhóm `export.*` (VI/JA/EN): tên nút, tên sheet, header cột, nhãn thuế suất. Header trong file dùng JA bất kể locale? → **Theo locale**, nhưng 仕訳 CSV luôn JA (phần mềm kế toán Nhật).

---

## 7. Kế hoạch thực hiện

| # | Bước | Ước lượng |
|---|---|---|
| 1 | Migration 0014 + RLS `app_settings` + script backfill (chạy sau khi 税理士 xác nhận) | 1h |
| 2 | Cập nhật types, form Doanh thu / Chi phí / Bán sỉ / Settings cửa hàng + fixed expense (thuế suất, city, vendor, invoice) | 3h |
| 3 | `lib/export/query.ts` + `tax.ts` + `journal.ts` + unit test (vitest) | 4h |
| 4 | `xlsx.ts` (9 sheet, công thức) + `csv.ts` + `yayoi-csv.ts` (Shift_JIS) | 4h |
| 5 | Route `/api/export` + nút ở Reports và Sales + i18n | 2h |
| 6 | Settings: JSON mapping editor | 1.5h |
| 7 | Test: mở .xlsx bằng Excel JA; import CSV thử vào freee (tài khoản trial) và 弥生会計 オンライン trial; đối chiếu tổng với trang Báo cáo | 1 ngày |
| 8 | README + gửi file mẫu cho 税理士 duyệt tên tài khoản / 税区分 | 1h |

Thứ tự deploy: migration 0014 (chỉ thêm cột, an toàn) → deploy code → chạy backfill 8% sau khi 税理士 xác nhận quy ước cho BANHMI / cafe_bakery.

---

## 8. Câu hỏi cần 税理士 trả lời trước khi chốt (không chặn dev Phase 1)

1. Shop là **cá nhân hay pháp nhân**? Kỳ kế toán (1–12 hay khác)?
2. Từ 10/2026 dùng **本則課税, 簡易課税 hay 3割特例**? → quyết định mức chi tiết thuế đầu vào.
3. Phần mềm kế toán đang dùng (freee / 弥生 / MF / khác) và **tên tài khoản** mong muốn → điền JSON mapping.
4. Quy ước tách 8% cho cửa hàng có cả ăn tại chỗ và mang về: nhập thực tế mỗi ngày hay tỷ lệ cố định theo cửa hàng?
5. Doanh thu QR / thẻ: ghi 売掛金 rồi 入金, hay ghi thẳng 普通預金 ngày nhận tiền?

---

## 9. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Tách 8/10% sai vì dữ liệu cũ không có | Backfill theo quy ước 税理士 duyệt; sheet 売上日計 hiển thị cả 2 cột để kiểm tra; dòng cũ đánh dấu `推定` |
| Nhãn 税区分 弥生 không khớp → import lỗi | Nhãn nằm trong JSON; test import thật ở bước 7 |
| Trùng bút toán (bảng gốc + ledger auto-sync) | Bỏ qua dòng có `ref_table`; unit test tổng doanh thu |
| Thuế suất đổi 4/2027 | Giá trị là dữ liệu per-row; thêm `1` vào CHECK sẵn |
| File lớn (cả năm, 4 cửa hàng) | ~1,500 dòng sales + vài nghìn dòng ledger → vài trăm KB, exceljs xử lý tốt; giới hạn 13 tháng |

---

## 10. Phase 2 (ghi nhận)
- Upload ảnh biên lai cho chi phí (Supabase Storage) → đáp ứng lưu trữ インボイス.
- Theo dõi 源泉徴収 / 社会保険 trên lương để xuất 給与台帳.
- Xuất PDF 月次試算表 trực tiếp.
- Tự động đọc số T từ ảnh hoá đơn (OCR) để set `invoice_registered`.

---

## Nguồn tham khảo
- NTA 軽減税率 (飲食店 ăn tại chỗ 10% / mang về 8%): https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/0019011-044_01.pdf
- Square: dự kiến giảm thuế thực phẩm 1% từ 4/2027: https://squareup.com/jp/ja/townsquare/what-is-the-reduced-tax-rate-for-restaurants
- 2割特例 → 3割特例, lịch giảm khấu trừ 70/50/30%: https://aoi-mirai.jp/blog/2026/03/89684/ , https://mitsu-ri.net/articles/invoice-2026-update
- 少額特例 đến 30/9/2029: https://biz.moneyforward.com/invoice/basic/60404/
- 電子帳簿保存法 2026: https://atsoho.com/blog/electronic-bookkeeping-law-2026-guide , https://biz.moneyforward.com/accounting/basic/77587/
- 個人事業税 飲食店業 第1種 5%, 290万控除, nộp 8月・11月: https://gyomu-keisan.jp/tax/kojin-jigyo-zei/ , https://www.pref.miyagi.jp/soshiki/zeimu/kojinjigyou.html
- 愛知県 法人事業税 / 外形標準課税: https://www.pref.aichi.jp/soshiki/zeimu/0000034601.html
- 名古屋市 事業所税 免税点: https://www.city.nagoya.jp/zaisei/cmsfiles/contents/0000081/81944/menzeiten.pdf
- 弥生 インポートデータの記述形式 (25 cột): https://support.yayoi-kk.co.jp/faq_Subcontents.html?page_id=27184
- freee nhập 弥生 仕訳: https://support.freee.co.jp/hc/ja/articles/202848060
- MF nhập 弥生形式: https://biz.moneyforward.com/support/account/guide/date02/da05.html
