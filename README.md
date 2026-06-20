# ⚙️ CoffeeTrace Backend & Smart Contracts - Node.js Express Application

CoffeeTrace Backend là hạt nhân xử lý logic dịch vụ, API và quản lý trạng thái của hệ thống truy xuất nguồn gốc chuỗi cung ứng cà phê Robusta Đắk Lắk. Dự án kết hợp sức mạnh của **Hợp đồng thông minh (Smart Contracts)** chạy trên môi trường EVM Blockchain để đảm bảo tính minh bạch, bất biến của dòng đời hạt cà phê, cùng cơ sở dữ liệu **PostgreSQL** để tăng tốc khả năng truy vấn, lưu trữ dữ liệu off-chain nặng.

Hệ thống sử dụng **Prisma ORM** để quản lý cơ sở dữ liệu và áp dụng kiến trúc Event-Driven (Indexer) lắng nghe các sự kiện on-chain tự động đồng bộ hóa ngược về cơ sở dữ liệu off-chain, tối ưu hóa tối đa hiệu năng trải nghiệm người dùng cuối.

## 🛠 Kiến Trúc Công Nghệ

- **Smart Contract & Node:** Solidity, Hardhat, Ethers.js
- **Backend API Server:** Node.js, Express.js
- **Database ORM:** PostgreSQL, Prisma ORM
- **Phân tán tệp nặng:** IPFS (InterPlanetary File System) via Pinata

## 🏃‍♂️ Quy Trình Khởi Chạy Hệ Thống

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
- Tìm dòng `Private Key (0)` để lấy secret key của `Account #0`.
- Copy chuỗi hex bắt đầu bằng `0x...`.

### Bước 3: Cấu Hình Biến Môi Trường Backend (`.env`)

Quay lại Terminal chính (hoặc mở terminal mới), di chuyển vào thư mục `backend` và `blockchain` , mỗi phần tạo file `.env` dựa theo `.env.example` và dán chuỗi private key bạn vừa copy vào:

```env
BLOCKCHAIN_PRIVATE_KEY=<your_key>
```

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

## 🔍 Quick Verification (Kiểm Tra Nhanh)

```bash
curl http://localhost:5000/health
```

## Nhóm sinh viên thực hiện
Nhóm E:
1.  Nguyễn Mạc Gia Huy	    MSSV: 31231025016
2.	Nguyễn Nguyên Khuyến 	MSSV: 31231026626
3.	Nguyễn Thị Thiên Nhi	MSSV: 31231023551
4.	Lê Vũ Uyên Phương	    MSSV: 31231025809
5.	Trần Anh Vy			    MSSV: 31231020502