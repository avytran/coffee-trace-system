// backend/src/config/blockchain.js
// Cấu hình ethers.js - dùng chung cho toàn bộ dự án
// Không hardcode Private Key - đọc từ .env

import { ethers } from 'ethers';
import contractABI from './CoffeeTraceability.abi.json' assert { type: 'json' };

let _provider = null;
let _contract  = null;

/**
 * Lấy Provider (kết nối đến mạng blockchain)
 * Lazy-init: chỉ tạo một lần duy nhất (singleton)
 */
export const getProvider = () => {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  }
  return _provider;
};

/**
 * Lấy Contract Instance đã ký bằng Signer của backend
 * Dùng BACKEND_PRIVATE_KEY từ .env để ký giao dịch
 */
export const getContractInstance = () => {
  if (!_contract) {
    const provider = getProvider();
    const signer   = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
    _contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      contractABI,
      signer
    );
  }
  return _contract;
};
