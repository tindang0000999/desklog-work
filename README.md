# Desklog — chuẩn bị xác thực thật

Đây là frontend GitHub Pages và SQL cho một người sử dụng. **Chưa hoạt động cho đến khi có dự án Supabase và kiểm thử bảo mật.** Không đặt mật khẩu, `sb_secret_...` hoặc service-role key vào repository.

## Người sở hữu thực hiện trên Supabase

1. Tạo một **project mới** ở https://supabase.com/dashboard (không gửi mật khẩu tài khoản Supabase cho agent).
2. Với **project mới**, trong **SQL Editor** chạy file [`schema.sql`](schema.sql). Nếu đang dùng project Desklog hiện tại, chạy [`migration_add_person_name.sql`](migration_add_person_name.sql) trước khi đưa frontend mới lên; migration thêm cột `person_name` nullable để giữ nguyên các bản ghi cũ chưa có họ tên. Cột `unit` vẫn là text. Bảng `work_items` chỉ grant cho role `authenticated`, RLS bắt buộc `owner_id = auth.uid()` cho đọc/thêm/sửa/xóa; migration không đổi các quyền này.
3. Trong **Authentication → Users**, tạo **một người dùng email + mật khẩu** do anh tự chọn; xác nhận email nếu dự án yêu cầu. Trong **Authentication → Providers → Email**, tắt *Allow new users to sign up* sau khi tạo tài khoản để không ai tự đăng ký. Đừng gửi mật khẩu qua chat.
4. Trong **Authentication → URL Configuration**, đặt Site URL / Redirect URL trỏ đến link Desklog sau khi xuất bản.
5. Cung cấp cho agent **Project URL** dạng `https://<project-ref>.supabase.co` và **publishable key** dạng `sb_publishable_...` (đây là khóa công khai dành cho frontend), hoặc tự điền hai giá trị đó vào [`config.js`](config.js). Không bao giờ sử dụng `sb_secret_...` ở frontend.
6. Kiểm thử: trình duyệt chưa đăng nhập không thể truy vấn `work_items`; đăng nhập chủ sở hữu rồi thêm/xem/sửa/xóa một mục thử; đăng xuất thì dữ liệu không được hiện. Chỉ sau đó mới nhập công việc thật.

## Giới hạn

- GitHub Pages và code frontend là **công khai**. **Dữ liệu** nằm trong Supabase riêng và cần login/RLS mới đọc/ghi được. Đây không phải mã hóa đầu-cuối: nhà cung cấp hạ tầng và quản trị project có quyền hệ thống phù hợp.
- Tài khoản Supabase phải do chủ sở hữu tạo và quản lý. Không có tài khoản demo, không có mật khẩu mặc định.
- Danh mục phòng/khoa trong HTML là ví dụ, sẽ cần thay bằng danh mục thật.
- Bản cũ GitHub Pages chỉ là demo; không nhập dữ liệu thật trước khi hoàn tất kiểm thử.

Nguồn tham khảo: [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
