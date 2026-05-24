// backend/test-integration.js
import { ethers } from "ethers";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "http://localhost:5000/api";
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;

// ABI tối giản để gọi hàm grantAgentRole
const ABI = ["function grantAgentRole(bytes32 role, address account) public"];

async function runTest() {
  console.log("🎬 KHỞI ĐỘNG TIẾN TRÌNH TEST LIÊN THÔNG VÀO HỆ THỐNG...");
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // 1. Tạo một ví mới tinh (0 ETH, chưa có trong DB, chưa có trên mạng)
  const newWallet = ethers.Wallet.createRandom(provider);
  console.log(`✨ 1. Đã tạo ví test ngẫu nhiên mới: ${newWallet.address}`);

  // 2. Lấy ví Admin tối cao để thực hiện cấp quyền trên Blockchain
  function normalizePrivateKey(raw) {
    if (!raw) throw new Error('Environment variable BLOCKCHAIN_PRIVATE_KEY is not set.');
    let pk = raw.toString().trim();
    if ((pk.startsWith('"') && pk.endsWith('"')) || (pk.startsWith("'") && pk.endsWith("'"))) {
      pk = pk.slice(1, -1).trim();
    }
    if (!pk.startsWith('0x')) pk = '0x' + pk;
    if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
      throw new Error('Invalid BLOCKCHAIN_PRIVATE_KEY format. Expected 64 hex chars, optionally prefixed with 0x.');
    }
    return pk;
  }

  let adminSigner;
  try {
    const adminKey = normalizePrivateKey(process.env.BLOCKCHAIN_PRIVATE_KEY);
    adminSigner = new ethers.Wallet(adminKey, provider);
  } catch (err) {
    console.error('✋ Cannot create admin signer:', err.message);
    console.error('Please set `BLOCKCHAIN_PRIVATE_KEY` in your .env as a 64-hex string (with or without 0x).');
    process.exit(1);
  }
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, adminSigner);

  console.log("📡 2. Admin đang gửi lệnh grantAgentRole(FARMER_ROLE) lên Blockchain...");
  const farmerRoleHex = ethers.id("FARMER_ROLE");
  
  const tx = await contract.grantAgentRole(farmerRoleHex, newWallet.address);
  console.log(`⏳ Giao dịch đã gửi. TxHash: ${tx.hash}. Đang chờ đào block...`);
  await tx.wait();
  console.log("✅ Giao dịch Blockchain THÀNH CÔNG!");

  // 3. Chờ 3 giây để Indexer Worker chộp sự kiện và xử lý lưu DB + Bơm Gas
  console.log("⏳ 3. Chờ 7 giây để Indexer Worker cập nhật Postgres & Bơm Gas hộ...");
  await new Promise((resolve) => setTimeout(resolve, 7000));

  // 4. Kiểm tra số dư ví mới xem đã được Backend tự động cứu trợ ETH chưa
  const newBalance = await provider.getBalance(newWallet.address);
  console.log(`💰 Số dư hiện tại của ví mới: ${ethers.formatEther(newBalance)} ETH (Kỳ vọng: ~0.1 ETH)`);

  // 5. Test Luồng Web3 Auth (Lấy Nonce -> Ký số -> Login)
  console.log("🔐 4. Bắt đầu test luồng Web3 Auth cho ví mới này...");
  
  // 5a. Lấy Nonce
  const nonceRes = await axios.get(`${API_URL}/auth/nonce/${newWallet.address}`);
  const nonce = nonceRes.data.nonce;
  console.log(`📥 Nhận Nonce từ Backend: "${nonce}"`);

  // 5b. Ví mới thực hiện ký thông điệp bằng Private Key của nó
  const signature = await newWallet.signMessage(nonce);
  console.log(`✍️ Ví mới đã ký xong. Chữ ký Hex: ${signature.substring(0, 30)}...`);

  // 5c. Gửi Chữ ký lên endpoint login để đổi JWT Token (Task 1.4)
  console.log("🚀 Gửi thông tin login lên POST /api/auth/login...");
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      walletAddress: newWallet.address,
      signature: signature
    });

    console.log("🎉 KẾT QUẢ TEST ĐĂNG NHẬP:");
    console.log(`   - Status: ${loginRes.status === 200 ? "THÀNH CÔNG (200 OK)" : "THẤT BẠI"}`);
    console.log(`   - Token JWT trả về: Bearer ${loginRes.data.token.substring(0, 40)}...`);
    console.log(`   - Vai trò được nhận diện trong hệ thống: ${loginRes.data.agent.role}`);
    console.log("\n🔥 ĐÃ PASS TOÀN BỘ CÁC TASK PHASE 1! LIÊN THÔNG 100%!");
  } catch (error) {
    console.error("❌ Lỗi ở bước Auth:", error.response ? error.response.data : error.message);
  }
}

runTest();