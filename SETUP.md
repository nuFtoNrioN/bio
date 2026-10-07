# NOIR Personal: hướng dẫn cài đặt

## 1. Tạo database (Cloudflare D1)
1. Dashboard → Storage & Databases → D1 → Create → tên `noir-personal`.
2. Copy `database_id` dán vào `wrangler.toml` (dòng `database_id`).
3. Vào D1 → tab Console → dán nội dung `schema.sql` → Execute.
   (Nếu console chỉ nhận 1 lệnh một lần thì dán từng khối CREATE TABLE.)

## 2. Deploy
- Đẩy thư mục này lên GitHub rồi Workers & Pages → Create → Import repository, hoặc chạy `npx wrangler deploy`.

## 3. Khoá trang admin (BẮT BUỘC, chọn 1 trong 2)
**Cách A: Cloudflare Access (khuyên dùng, cần domain riêng nằm trên Cloudflare)**
1. Zero Trust → Access → Applications → Add → Self-hosted.
2. Thêm 2 đường dẫn: `/admin*` và `/api/admin*` của domain bạn.
3. Policy: Allow, Include = Emails = email của bạn. Login method: One-time PIN.
4. Copy "Application Audience (AUD) Tag" và team domain (`xxx.cloudflareaccess.com`) vào `[vars]` trong `wrangler.toml`, điền luôn `ADMIN_EMAIL`, deploy lại.

**Cách B: ADMIN_TOKEN (không cần domain riêng)**
1. Tạo chuỗi ngẫu nhiên dài 40+ ký tự.
2. Worker → Settings → Variables and Secrets → thêm Secret tên `ADMIN_TOKEN`.
3. Vào `/admin`, nhập token. Token lưu trong trình duyệt, nên chỉ đăng nhập trên thiết bị của bạn.

Nếu chưa cấu hình gì thì API admin tự khoá (trả 401), không có chuyện mở toang.

## 4. Kiểm tra
- `/` hiện trang public. `/admin` đăng nhập được.
- Mở tab ẩn danh gọi `/api/admin/data`: phải bị chặn (401 hoặc trang đăng nhập Access).
- Tạo 1 script, bấm Copy loadstring, thử `game:HttpGet` bằng executor.

## Chạy local
Copy `.dev.vars.example` thành `.dev.vars`, chạy `npx wrangler dev`. Cần `npx wrangler d1 execute noir-personal --local --file=schema.sql` một lần đầu.
