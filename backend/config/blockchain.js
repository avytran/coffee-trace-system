// src/config/blockchain.js
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

let provider;
let wallet;

try {
  provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  
  if (process.env.BLOCKCHAIN_PRIVATE_KEY) {
    wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);
  }
  
  console.log('🔗 [Blockchain Config]: Khởi tạo cấu hình Provider & Wallet thành công.');
} catch (error) {
  console.error('❌ [Blockchain Config Error]: Cấu hình Blockchain thất bại:', error.message);
}

export { provider, wallet };