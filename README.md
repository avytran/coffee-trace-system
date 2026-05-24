# Setup Guide — dApp-Coffee-Trace

Minimal, copyable setup instructions for local development.

---

## Prerequisites

- Node.js 22.x
- Docker Desktop
- Git

---

## 🏃‍♂️ Quy Trình Khởi Chạy Hệ Thống (Thứ Tự Bắt Buộc)

Để cơ chế **Seed dữ liệu Agent động** hoạt động chính xác (Backend tự kết nối lên Blockchain lấy danh sách ví thực tế để map quyền vào Postgres), bạn **bắt buộc** phải khởi chạy mạng Blockchain trước khi chạy lệnh Seed và Backend.

### Bước 1: Clone Dự Án & Bật PostgreSQL

Trước khi chạy Docker Compose, hãy tải và bật Docker Desktop.

```bash
git clone <repo-url>
cd coffee-trace-system

docker compose up -d
```

### Bước 2: Khởi Chạy Local Blockchain Node (Hardhat)

Mở một Terminal mới, di chuyển vào thư mục `blockchain` và khởi chạy node EVM local:

```bash
cd blockchain
npx hardhat node
```

⚠️ QUAN TRỌNG: Giữ Terminal này luôn mở để mạng Blockchain chạy liên tục.

### 🔑 Cách lấy `BLOCKCHAIN_PRIVATE_KEY` điền vào `.env`

Ngay sau khi lệnh `npx hardhat node` hoàn tất, Terminal của bạn sẽ hiển thị danh sách 20 tài khoản test kèm Private Key.

- Tìm mục `Started HTTP and JSON-RPC server at http://127.0.0.1:8545/`.
- Bên dưới sẽ có danh sách các tài khoản.
- `Account #0` được dùng làm `ADMIN` (ví mặc định: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`).
- `Account #1` được dùng làm `FARMER` (ví mặc định: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`).
- Tìm dòng `Private Key (0)` để lấy secret key của `Account #0`.
- Copy chuỗi hex bắt đầu bằng `0x...`.

### Bước 3: Cấu Hình Biến Môi Trường Backend (`.env`)

Quay lại Terminal chính (hoặc mở terminal mới), di chuyển vào thư mục `backend`, tạo file `.env` và dán chuỗi private key bạn vừa copy vào:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@localhost:5432/coffee_trace_db?schema=public
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=0x... # DÁN_PRIVATE_KEY_(0)_CỦA_HARDHAT
BLOCKCHAIN_CONTRACT_ADDRESS=0x... # DÁN_CONTRACT_ADDRESS
JWT_SECRET=your_strong_jwt_secret_here
```

> Lưu ý: Không bao giờ commit file `.env` này lên GitHub.

### Bước 4: Deploy Smart Contract lên Local Network

Quay lại Terminal của thư mục `blockchain` (hoặc mở tab mới nếu cần) để biên dịch và deploy contract lên node `localhost` đang chạy:

```bash
cd blockchain
npx hardhat clean
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

📝 Lưu ý: Sau khi hoàn tất, Terminal sẽ in ra địa chỉ Contract (ví dụ: `0x5FbDB...`). Hãy lưu lại địa chỉ này để cấu hình cho ứng dụng Client/Frontend. Bạn cũng có thể chép địa chỉ này vào file cấu hình hoặc ghi chú nội bộ để dùng cho môi trường local.

> Smart contract address example:
> `0x5FbDB2315678afecb367f032d93F642f64180aa3`

### Bước 5: Khởi Tạo Database & Seed Dữ Liệu Động

```bash
cd ../backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
```

> Yêu cầu: `prisma.config.ts` đã map `seed` tới `node ./prisma/seed.js`.

Log mong đợi khi Seed thành công:

```text
🔄 Đang kết nối tới Blockchain Node để nạp danh sách tài khoản thực tế...
🌱 Bắt đầu gieo dữ liệu cho bảng Agent (Đồng bộ theo danh sách ví Blockchain)...
✅ Seed thành công Agent: Ban Quản Trị Hệ Thống | Ví: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 -> Quyền: ADMIN
✅ Seed thành công Agent: Nông hộ Y Miên | Ví: 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 -> Quyền: FARMER
🌿 Quá trình gieo dữ liệu Agent hoàn tất!
```

### Bước 6: Khởi Động Express Backend Server

```bash
cd backend
npm run dev
```

Hoặc chạy thuần bằng Node:

```bash
cd backend
node src/index.js
```

---

## 🔍 Quick Verification (Kiểm Tra Nhanh)

```bash
curl http://localhost:5000/health
```

*Kỳ vọng nhận về JSON phản hồi có trạng thái* `status: "OK"` *và* `postgresql: "UP"`.

Kiểm tra luồng xác thực ví Web3 tự động:

```bash
cd backend
node test-login.js
```

(Script giả lập MetaMask ký mã số Nonce ngẫu nhiên từ server, thực hiện login bằng Account #1 và nhận JWT Token phân vai `FARMER`).

---

## ⚠️ Security Notes

- Tuyệt đối không đưa private key thật của ví chính (Mainnet) vào file `.env` phát triển.
- Sử dụng cấu hình quản lý bí mật như KMS cho `BLOCKCHAIN_PRIVATE_KEY` và `JWT_SECRET` khi triển khai production.
- Trong môi trường phân tán đa máy chủ, lưu nonce vào Redis thay vì dùng `nonceMap` trong Node.js để tránh lệch session.

---

Last updated: 2026-05-24
