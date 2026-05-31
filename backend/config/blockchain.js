// backend/src/config/blockchain.js
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
