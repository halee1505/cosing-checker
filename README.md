# CosIng Checker

Kiểm tra thành phần mỹ phẩm theo cơ sở dữ liệu [CosIng](https://ec.europa.eu/growth/tools-databases/cosing/) của EU và các Annex của Quy định (EC) 1223/2009.

- **Kiểm tra công thức**: tải file Excel (hoặc dán danh sách), tự nhận diện cột tên / CAS / %, hỗ trợ nhiều sản phẩm trong một sheet, tick chọn dòng, xuất kết quả ra Excel.
- **Tra cứu nhanh**: tìm theo tên INCI hoặc theo mã CAS / EC.

Trang tĩnh, chạy trên GitHub Pages: https://halee1505.github.io/cosing-checker/

## Chạy local

```bash
npm install
npm run web
```

Mở http://localhost:3000. Đăng nhập bằng tài khoản Firebase của dự án.

## Deploy lên GitHub Pages

```bash
npm run deploy
```

Lệnh này build bản web vào `build/` rồi đẩy lên nhánh `gh-pages`. App dùng `HashRouter` và `"homepage": "."`, nên chạy được ở đường dẫn con `/cosing-checker/` mà không cần cấu hình thêm.

Lưu ý:

- Không đổi sang `BrowserRouter`: GitHub Pages không có rewrite, tải lại trang sẽ ra 404.
- Mọi file tĩnh phải tham chiếu bằng đường dẫn tương đối (`./...` hoặc `process.env.PUBLIC_URL`).
- Domain `halee1505.github.io` phải nằm trong **Authorized domains** của Firebase Authentication.

## Kiểm tra

```bash
npm test
```

## App desktop (Electron)

```bash
npm start        # web + cửa sổ Electron khi phát triển
npm run build    # build web rồi đóng gói bằng electron-builder
```

Nguồn dữ liệu: European Commission – CosIng. Kết quả chỉ để tham khảo; CosIng không có giá trị pháp lý.
