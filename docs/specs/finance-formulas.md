# Spec: Chuẩn hoá công thức Số dư tiền mặt, Số dư ngân hàng, Chi phí, Lợi nhuận

| | |
|---|---|
| Trạng thái | ✅ Đã triển khai trên working tree (chưa commit). Còn: chạy migration 0013 → chạy `supabase/scripts/reconcile_finance.sql` → test trên Preview |
| Ngày | 2026-10-15 |
| Phạm vi | Logic hiển thị ở 5 trang: Tổng quan, Tiền mặt, Ngân hàng, Chi phí, Báo cáo |
| DB | Migration `0013_finance_summaries.sql` **chỉ thêm hàm đọc**. Không sửa dữ liệu, không sửa trigger, không đổi bảng |
| Ước lượng | ~1 ngày dev + 0.5 ngày đối chiếu số liệu |

---

## 1. Yêu cầu gốc

| Mục | Công thức yêu cầu |
|---|---|
| Tiền mặt | Số dư = tiền mặt nhập ở *Nhập doanh thu* + thu ở mục *Tiền mặt* + bán sỉ tiền mặt − chi ở mục *Tiền mặt* − lương trả tiền mặt |
| Ngân hàng | Số dư = khách chuyển khoản vào cửa hàng + nộp tiền mặt vào ngân hàng + bán sỉ chuyển khoản − chi ở mục *Ngân hàng* − lương chuyển khoản |
| Chi phí | Tiền mặt phần chi + Ngân hàng phần chi + Chi phí cố định hàng tháng + Chi phí phát sinh |
| Tổng quan | Lợi nhuận = Doanh thu − Chi phí |

---

## 2. Hệ thống hiện tại đang tính thế nào

Sổ quỹ (`cash_movements`) và sổ ngân hàng (`bank_transactions`) có **2 loại dòng**:

- **Dòng tự động** (`ref_table` có giá trị): do trigger trong DB sinh ra khi nhập ở trang khác.
- **Dòng thủ công** (`ref_table` rỗng): nhập trực tiếp ở trang Tiền mặt / Ngân hàng.

| Nhập ở đâu | Trigger tự sinh |
|---|---|
| Nhập doanh thu: tiền mặt | Tiền mặt **vào** = `cash + cash_expense` (gross) |
| Nhập doanh thu: "Tiền mặt TT hàng hoá" (cash_expense_items) | 1 dòng **Chi phí phát sinh** (paid_from = cash) → tiếp tục sinh tiền mặt **ra** |
| Nhập doanh thu: chuyển khoản | Ngân hàng **vào** |
| Nhập doanh thu: QR / thẻ | **Không sinh gì** (không vào tiền mặt, không vào ngân hàng) |
| Chi phí phát sinh, trả tiền mặt | Tiền mặt **ra** |
| Chi phí phát sinh, trả ngân hàng | Ngân hàng **ra** |
| Lương trả tiền mặt | Tiền mặt **ra** (Quỹ chung) |
| Lương trả chuyển khoản / QR / thẻ | Ngân hàng **ra** |
| Bán sỉ, **chỉ khi đã đánh dấu đã thu**, tiền mặt | Tiền mặt **vào** (Quỹ chung) |
| Bán sỉ đã thu, chuyển khoản / QR / thẻ | Ngân hàng **vào** |
| Tiền mặt: chi "Nộp ngân hàng" | Ngân hàng **vào** (số tiền trừ phí nộp) |

Cách tính hiện tại ở từng trang:

| Trang | Hiện tại |
|---|---|
| Tiền mặt | Σ vào − Σ ra của **toàn bộ** sổ quỹ (cả tự động lẫn thủ công), từ trước đến nay |
| Ngân hàng | Σ vào − Σ (ra + phí) của toàn bộ sổ ngân hàng |
| Chi phí | **Không có tổng**. Chỉ liệt kê chi phí cố định và 60 dòng chi phí phát sinh gần nhất |
| Tổng quan — Chi phí | Chi phí phát sinh + Lương. **Thiếu chi phí cố định** |
| Tổng quan — Lợi nhuận | Doanh thu bán lẻ − (Chi phí phát sinh + Lương). **Không có bán sỉ, không có chi phí cố định** |
| Báo cáo tháng — Lợi nhuận ròng | Doanh thu bán lẻ + bán sỉ − (cố định + phát sinh + lương) |

→ **Tổng quan và Báo cáo đang ra 2 con số lợi nhuận khác nhau cho cùng một tháng.**

---

## 3. Phân tích từng công thức

### 3.1 Tiền mặt — hiện tại đã gần khớp
Khai triển số dư hiện tại theo nguồn:

```
  (cash + cash_expense)           ← doanh thu tiền mặt, gross
− cash_expense                     ← chi phí tự sinh từ "Tiền mặt TT hàng hoá"
= cash                             ← đúng "tiền mặt nhập ở mục Nhập doanh thu"
+ thu thủ công ở trang Tiền mặt
+ bán sỉ tiền mặt (đã thu)
− chi thủ công ở trang Tiền mặt   (gồm cả Nộp ngân hàng)
− lương tiền mặt
− chi phí phát sinh trả tiền mặt nhập ở trang Chi phí   ← KHÔNG có trong công thức yêu cầu
```

Khác biệt duy nhất là dòng cuối. Theo thực tế, tiền mặt dùng để trả chi phí thì két phải giảm, nên **đề xuất giữ** (xem câu hỏi Q1).

→ Không cần đổi cách tính. Chỉ **thêm bảng diễn giải** cho thấy từng thành phần để chủ shop đối chiếu.

### 3.2 Ngân hàng — hiện tại đã gần khớp
```
+ doanh thu chuyển khoản
+ nộp tiền mặt vào ngân hàng (đã trừ phí nộp)
+ bán sỉ đã thu qua chuyển khoản / QR / thẻ        ← yêu cầu chỉ nói "chuyển khoản"
+ thu thủ công ở trang Ngân hàng                   ← KHÔNG có trong công thức yêu cầu
− chi thủ công ở trang Ngân hàng (+ phí)
− chi phí phát sinh trả ngân hàng                  ← KHÔNG có trong công thức yêu cầu
− lương chuyển khoản / QR / thẻ                     ← yêu cầu chỉ nói "chuyển khoản"
```

Ba điểm khác biệt cần quyết định: Q2, Q3, Q4.

### 3.3 Chi phí — **nếu cộng nguyên văn sẽ bị đếm trùng**
"Tiền mặt phần chi" và "Ngân hàng phần chi" đã **chứa sẵn** chi phí phát sinh và lương (do trigger sinh). Cộng thêm "Chi phí phát sinh" một lần nữa là trùng. Ngoài ra "Nộp ngân hàng" là **chuyển tiền nội bộ**, không phải chi phí.

Ví dụ một tháng:

| Nghiệp vụ | Số tiền |
|---|---:|
| Tiền mặt TT hàng hoá (gạo) nhập ở Doanh thu | ¥3,000 |
| Tiền điện trả ngân hàng, nhập ở Chi phí | ¥20,000 |
| Lương trả tiền mặt | ¥100,000 |
| Nộp tiền mặt vào ngân hàng | ¥30,000 |
| Chi phí cố định | ¥50,000 |
| **Chi phí thật** | **¥173,000** |

Cộng nguyên văn: Tiền mặt chi (3,000 + 100,000 + 30,000) + Ngân hàng chi (20,000) + Cố định (50,000) + Phát sinh (3,000 + 20,000) = **¥226,000**, sai lệch ¥53,000.

**Đề xuất định nghĩa Chi phí (mỗi khoản chỉ đếm 1 lần, từ bảng gốc):**

```
Chi phí =  Chi phí phát sinh         (toàn bộ, gồm cả "Tiền mặt TT hàng hoá" tự sinh)
         + Chi phí cố định           (theo số ngày của kỳ, xem 3.5)
         + Lương                      (salary_payments, mọi phương thức)
         + Chi tiền mặt thủ công     thuộc nhóm "là chi phí" (bảng 3.4)
         + Chi ngân hàng thủ công    thuộc nhóm "là chi phí" (bảng 3.4)
         + Phí ngân hàng             (phí nộp tiền, phí chuyển khoản)
```

Dòng tự động trong sổ quỹ / ngân hàng **không** được cộng vì đã có ở bảng gốc.

### 3.4 Phân loại danh mục chi thủ công (cần xác nhận — Q5)

| Sổ | Danh mục | Đề xuất | Lý do |
|---|---|:-:|---|
| Tiền mặt | Mua vật dụng (`purchase`) | ✅ Chi phí | |
| Tiền mặt | COD (`cod`) | ✅ Chi phí | Trả tiền hàng khi giao |
| Tiền mặt | NV mang về (`staff_take`) | ❌ | **Đã xác nhận (Q5): không phải chi phí** |
| Tiền mặt | Nộp ngân hàng (`deposit_to_bank`) | ❌ | Chuyển quỹ nội bộ. Chỉ phần **phí nộp** là chi phí |
| Tiền mặt | Điều chỉnh (`adjust`) | ❌ | Chênh lệch kiểm két, không phải chi tiêu |
| Tiền mặt | Khác (`other`) | ✅ Chi phí | |
| Ngân hàng | Nhập hàng (`purchase`) | ✅ Chi phí | |
| Ngân hàng | Chi phí (`expense`) | ✅ Chi phí | |
| Ngân hàng | Lương (`salary`) nhập tay | ❌ | Lương đã tính từ trang Lương. Nhập tay ở đây sẽ trùng |
| Ngân hàng | Khác (`other`) | ✅ Chi phí | |

Bảng này nằm trong code dạng cấu hình, đổi được sau.

### 3.5 Chi phí cố định cho khoảng ngày bất kỳ
Tổng quan cho chọn 7 ngày, 14 ngày, tháng này, tuỳ chọn… Chi phí cố định là số **theo tháng**.

**Đề xuất: phân bổ theo ngày.** Với mỗi tháng nằm trong kỳ:
`cố định tháng × (số ngày của kỳ thuộc tháng đó / số ngày của tháng)`, làm tròn đến yên.
Chọn đúng nguyên tháng thì ra đúng 100%. Chọn 7 ngày tháng 10 thì ra 7/31.

Lưu ý: chi phí cố định dùng **danh sách đang bật hiện tại**, vì DB chưa lưu lịch sử thay đổi. Sửa số tiền hôm nay sẽ làm thay đổi cả số liệu các tháng cũ. Ghi nhận ở Phase 2.

### 3.6 Lợi nhuận
```
Doanh thu = doanh thu bán lẻ (total_revenue, đã gồm Tiền mặt TT hàng hoá)
          + doanh thu bán sỉ theo ngày bán (kể cả chưa thu tiền)      ← Q7
Lợi nhuận = Doanh thu − Chi phí (định nghĩa 3.3)
```
Áp dụng **cùng một hàm** cho Tổng quan và Báo cáo tháng để 2 nơi luôn ra cùng số.

---

## 4. Thiết kế

### 4.1 Module dùng chung `src/lib/finance.ts`
Hàm thuần (không gọi DB), nhận dữ liệu đã query và trả về số kèm diễn giải:

```ts
cashBalance(rows)        → { total, byStore, general, breakdown: { salesCash, manualIn, wholesaleCash, manualOut, salaryCash, expenseCash } }
bankBalance(rows)        → { total, breakdown: { salesTransfer, cashDeposit, wholesale, manualIn, manualOut, expenseBank, salary, fees } }
expenses(input, range)   → { total, breakdown: { variable, fixed, salary, manualCash, manualBank, bankFees } }
profit(input, range)     → { revenue, retail, wholesale, expenses, profit }
fixedForRange(fixed, from, to) → number   // phân bổ theo ngày
```

Breakdown của tiền mặt / ngân hàng phân loại dòng sổ theo `ref_table` + `category`. Tổng của breakdown **luôn bằng** Σ vào − Σ ra như hiện tại, nên số dư không đổi.

Phân loại "là chi phí" (bảng 3.4) là hằng số `EXPENSE_CATEGORIES` trong cùng file.

Unit test (vitest) cho: tổng breakdown = số dư; ví dụ mục 3.3 ra ¥173,000; phân bổ cố định 7/31 và nguyên tháng.

### 4.2 Thay đổi từng trang

| Trang | Thay đổi |
|---|---|
| **Tiền mặt** | Số dư giữ nguyên. Thêm thẻ **"Cách tính số dư"** (thu gọn được) liệt kê từng thành phần theo công thức. |
| **Ngân hàng** | Như trên. |
| **Chi phí** | Thêm **bộ chọn kỳ** (dùng lại `DateRangePicker`, mặc định Tháng này). Thêm thẻ **Tổng chi phí kỳ** với 6 thành phần 3.3. Danh sách chi phí phát sinh lọc theo kỳ thay vì 60 dòng gần nhất. |
| **Tổng quan** | KPI *Chi phí* và *Lợi nhuận* dùng `expenses()` / `profit()`. Có thêm chi phí cố định, bán sỉ và chi thủ công. So sánh % với kỳ trước dùng cùng công thức. Bấm vào KPI hiện breakdown. |
| **Báo cáo tháng** | Lợi nhuận ròng gọi `profit()`. Thêm dòng chi tiền mặt / ngân hàng thủ công và phí ngân hàng vào bảng P&L. Xoá biến `grossProfit` không dùng. |

### 4.3 Query
- Số dư: giữ query toàn bộ sổ như hiện tại, thêm cột `category, ref_table` (vẫn rất nhẹ).
- Chi phí / lợi nhuận theo kỳ: query `variable_expenses`, `salary_payments`, `wholesale_sales`, `fixed_expenses`, và dòng **thủ công** (`ref_table is null`) của 2 sổ trong kỳ.
- Role 税理士 đọc được tất cả nhờ RLS đã làm ở migration 0012. Manager không đọc được bảng lương, nên KPI lương của manager sẽ là 0 → xem Q8.

### 4.4 i18n
Thêm nhãn VI / JA / EN cho các dòng breakdown và tiêu đề "Cách tính số dư", "Tổng chi phí kỳ".

---

## 5. Kế hoạch triển khai an toàn

Vì **không đụng DB**, rủi ro chỉ nằm ở con số hiển thị.

| # | Bước | Ước lượng |
|---|---|---|
| 1 | Chốt các câu hỏi mục 6 | — |
| 2 | `lib/finance.ts` + unit test | 3h |
| 3 | Tiền mặt + Ngân hàng: thẻ diễn giải | 1.5h |
| 4 | Chi phí: bộ chọn kỳ + tổng + breakdown | 1.5h |
| 5 | Tổng quan + Báo cáo dùng chung hàm | 1.5h |
| 6 | **Đối chiếu**: chạy script SQL chỉ-đọc trên DB thật, in ra số cũ và số mới của 3 tháng gần nhất cho từng KPI, giải thích từng chênh lệch | 2h |
| 7 | Deploy qua nhánh riêng + Vercel Preview, chủ shop xem thử, rồi merge | — |

Bước 6 là chốt chặn: chủ shop thấy trước con số Lợi nhuận sẽ thay đổi bao nhiêu và vì sao, trước khi bản mới lên production.

Nên deploy **sau** khi tính năng 税理士 chỉ xem đã chạy ổn, và làm trên nhánh riêng.

---

## 6. Quyết định (đã xác nhận 2026-10-15)

| # | Quyết định |
|---|---|
| Q1 | Chi phí trả tiền mặt nhập ở trang Chi phí **có** trừ số dư tiền mặt |
| Q2 | Bán sỉ thu QR / thẻ **có** cộng ngân hàng |
| Q3 | Lương trả QR / thẻ **có** trừ ngân hàng |
| Q4 | Thu thủ công ở Ngân hàng và chi phí trả ngân hàng **có** tính vào số dư ngân hàng |
| Q5 | **"NV mang về" không phải chi phí.** Chi phí tiền mặt thủ công = Mua vật dụng + COD + Khác |
| Q6 | Chi phí cố định trả từ **tài khoản ngân hàng khác**, không nhập lại ở trang Ngân hàng → không trùng, không trừ số dư ngân hàng của app |
| Q7 | Lợi nhuận **gồm** bán sỉ chưa thu, theo ngày bán |
| Q8 | Manager **thấy tổng lương** (không chi tiết từng người) qua hàm DB `salary_totals_by_month` |
| Q9 | Tiền QR / thẻ về tài khoản ngân hàng khác. **Chưa xử lý** |
| Q10 | Không có câu trả lời riêng → áp dụng mặc định: **phân bổ chi phí cố định theo ngày** |

**Quyết định kỹ thuật bổ sung khi triển khai:**
- **Lương cũng phân bổ theo ngày** giống chi phí cố định, vì lương là chi phí theo tháng. Nếu không, chọn "7 ngày qua" ở Tổng quan sẽ ra lương = 0 và lợi nhuận bị thổi phồng. Chọn nguyên tháng thì ra đúng 100%.
- **KPI Doanh thu ở Tổng quan = bán lẻ + bán sỉ**, để Lợi nhuận = Doanh thu − Chi phí kiểm được bằng mắt. TB/khách vẫn tính trên doanh thu bán lẻ.
- **Tính tổng bằng SQL** thay vì tải từng dòng về. Supabase mặc định trả tối đa 1,000 dòng mỗi truy vấn, nên cách cũ có thể thiếu dữ liệu khi sổ quỹ vượt 1,000 dòng hoặc chọn kỳ dài như "1 năm qua". Các hàm tổng hợp là `security invoker` nên vẫn tuân theo RLS (staff chỉ thấy cửa hàng của mình).
- Biểu đồ ở Tổng quan vẫn tải theo dòng như cũ (ngoài phạm vi lần này).

## 6b. Câu hỏi gốc (lưu lại)

| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| Q1 | Chi phí phát sinh **trả tiền mặt** nhập ở trang Chi phí có trừ vào số dư tiền mặt không? (công thức yêu cầu không nhắc) | **Có**, giữ như hiện tại |
| Q2 | Bán sỉ thu bằng **QR / thẻ** có cộng vào ngân hàng không? (yêu cầu chỉ nói chuyển khoản) | **Có**, giữ như hiện tại |
| Q3 | Lương trả bằng **QR / thẻ** có trừ ngân hàng không? | **Có**, giữ như hiện tại |
| Q4 | Khoản **thu thủ công** ở trang Ngân hàng (danh mục Khác) và **chi phí trả ngân hàng** nhập ở trang Chi phí có tính vào số dư ngân hàng không? | **Có** cả hai |
| Q5 | Duyệt bảng phân loại 3.4, đặc biệt **"NV mang về"** là chi phí hay không | Như bảng 3.4, NV mang về = chi phí |
| Q6 | Chi phí cố định (tiền nhà, bảo hiểm…) khi trả có được **nhập lại** ở trang Ngân hàng không? Nếu có, nó sẽ bị đếm 2 lần | Cần câu trả lời thực tế |
| Q7 | Lợi nhuận có gồm **bán sỉ chưa thu tiền** không? | **Có**, tính theo ngày bán |
| Q8 | Manager không được xem lương, nên Chi phí / Lợi nhuận ở Tổng quan của manager **thiếu lương**. Chấp nhận, hay hiện tổng lương (không chi tiết từng người) cho manager? | Hiện **tổng** lương qua một hàm DB chỉ trả về tổng — cần migration nhỏ, có thể để sau |
| Q9 | Doanh thu **QR / thẻ** hiện không vào ngân hàng ở đâu cả. Thực tế tiền này về tài khoản sau vài ngày. Có cần xử lý không? | **Ngoài phạm vi** lần này. Ghi nhận Phase 2 |
| Q10 | Chi phí cố định phân bổ theo ngày (3.5) có được không? | **Có** |

---

## 7. Phase 2 (ghi nhận)
- Lịch sử thay đổi chi phí cố định theo tháng, để sửa số tiền không làm đổi số liệu quá khứ.
- Ghi nhận tiền QR / thẻ về tài khoản (trừ phí thanh toán) để số dư ngân hàng sát thực tế.
- Hàm DB trả tổng lương cho manager (Q8).
