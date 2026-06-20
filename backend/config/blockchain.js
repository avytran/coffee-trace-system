import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

let provider;
let wallet = null;
let contracts = {};
const environment = process.env.NODE_ENV || 'local';

try {
  let rpcUrl;

  if (environment === 'sepolia') {
    console.log('[Server Web3]: Đang chạy môi trường DEV (Sepolia - Alchemy)');
    rpcUrl = process.env.SEPOLIA_RPC_URL;
    
    contracts = {
      userRegistry: process.env.SEPOLIA_USER_REGISTRY,
      batchRegistry: process.env.SEPOLIA_BATCH_REGISTRY,
      eventRegistry: process.env.SEPOLIA_EVENT_REGISTRY
    };

    const primaryProvider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const backupProvider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com", undefined, { staticNetwork: true });

    provider = new ethers.FallbackProvider([
      { provider: primaryProvider, priority: 1, weight: 2 },
      { provider: backupProvider, priority: 2, weight: 1 }
    ]);

    provider.pollingInterval = 15000; 

  } else {
    console.log('[Server Web3]: Đang chạy môi trường LOCAL (Hardhat Node)');
    rpcUrl = process.env.LOCAL_BLOCKCHAIN_RPC || 'http://127.0.0.1:8545';
    
    contracts = {
      userRegistry: process.env.LOCAL_USER_REGISTRY,
      batchRegistry: process.env.LOCAL_BATCH_REGISTRY,
      eventRegistry: process.env.LOCAL_EVENT_REGISTRY
    };

    provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    provider.pollingInterval = 1000;
  }

  if (environment === 'sepolia' && process.env.SEPOLIA_PRIVATE_KEY) {
    const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
    const cleanKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
    wallet = new ethers.Wallet(cleanKey, provider);
    console.log(`[Server Web3]: Đã đồng bộ Ví Quản Trị Hệ Thống: ${wallet.address}`);
  }

  console.log('[Server Web3]: Khởi tạo Provider kết nối Blockchain thành công.');
} catch (error) {
  console.error('[Server Web3 Error]: Lỗi thiết lập kết nối:', error.message);
}

export { provider, wallet, contracts, environment };