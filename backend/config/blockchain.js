import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

let provider;
let wallet;

try {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';

  provider = new ethers.JsonRpcProvider(
    rpcUrl,
    {
      name: 'hardhat',
      chainId: 31337
    },
    { 
      disableFilterId: true 
    }
  );

  provider.pollingInterval = 4000; 
  
  if (process.env.BLOCKCHAIN_PRIVATE_KEY) {
    wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);
  }
  
  console.log('🔗 [Blockchain Config]: Khởi tạo cấu hình Provider (với disableFilterId) & Wallet thành công.');
} catch (error) {
  console.error('❌ [Blockchain Config Error]: Cấu hình Blockchain thất bại:', error.message);
}

export { provider, wallet };