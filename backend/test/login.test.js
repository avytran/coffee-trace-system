import { ethers } from 'ethers';

const BACKEND_URL = 'http://localhost:5000/api/auth';

const TEST_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const wallet = new ethers.Wallet(TEST_PRIVATE_KEY);

async function runFullTest() {
  try {
    console.log(`🦊 [Mock Wallet]: Mock wallet initialized successfully.`);
    console.log(`🔑 [Wallet Address]: ${wallet.address}`);
    console.log('--------------------------------------------------');

    console.log('📡 1. Requesting authentication nonce from backend...');
    const nonceResponse = await fetch(`${BACKEND_URL}/nonce/${wallet.address}`);
    
    if (!nonceResponse.ok) {
      const errorData = await nonceResponse.json();
      throw new Error(`Fetch Nonce Failed: ${JSON.stringify(errorData)}`);
    }

    const { nonce } = await nonceResponse.json();
    console.log(`📥 [Backend Response] Received signature nonce:\n\n"${nonce}"\n`);
    console.log('--------------------------------------------------');

    console.log('✍️ 2. Signing the cryptographic nonce message...');
    const signature = await wallet.signMessage(nonce);
    console.log(`📝 [Generated Signature]:\n${signature}\n`);
    console.log('--------------------------------------------------');

    console.log('🚀 3. Submitting wallet address and signature to login endpoint...');
    const loginResponse = await fetch(`${BACKEND_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: wallet.address,
        signature: signature
      })
    });

    const loginResult = await loginResponse.json();

    if (!loginResponse.ok) {
      throw new Error(`Authentication Failed: ${loginResult.message}`);
    }

    console.log('🎉 🎉 🎉 WALLET AUTHENTICATION HANDSHAKE SUCCESSFUL! 🎉 🎉 🎉');
    console.log('📊 Agent Profile Profile fetched from PostgreSQL:');
    console.log(`   - Display Name: ${loginResult.agent.name}`);
    console.log(`   - System Role : ${loginResult.agent.role}`);
    console.log(`🔑 [Issued Access JWT Token]:\n${loginResult.token}\n`);
    console.log(' Keep this token to attach as a Bearer Token in the Authorization header for secured business APIs.');

  } catch (error) {
    console.error('Test execution encountered an error:', error.message);
  }
}

runFullTest();