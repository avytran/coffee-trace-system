const hre = require("hardhat");

async function main() {
  console.log("🚀 Bắt đầu quy trình Deploy hệ thống 3 Smart Contracts...");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Đang sử dụng tài khoản Deployer: ${deployer.address}`);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Số dư tài khoản: ${hre.ethers.formatEther(balance)} ETH`);
  console.log("----------------------------------------------------------------");

  console.log("Đang gửi giao dịch deploy UserRegistry...");
  const UserRegistry = await hre.ethers.getContractFactory("UserRegistry");
  const userRegistryContract = await UserRegistry.deploy();
  await userRegistryContract.waitForDeployment();
  
  const userRegistryAddress = await userRegistryContract.getAddress();
  console.log(` UserRegistry deployed thành công tại: ${userRegistryAddress}`);
  console.log("----------------------------------------------------------------");


  console.log("Đang gửi giao dịch deploy BatchRegistry...");
  const BatchRegistry = await hre.ethers.getContractFactory("BatchRegistry");
  
  const batchRegistryContract = await BatchRegistry.deploy(userRegistryAddress); 
  await batchRegistryContract.waitForDeployment();
  
  const batchRegistryAddress = await batchRegistryContract.getAddress();
  console.log(` BatchRegistry deployed thành công tại: ${batchRegistryAddress}`);
  console.log("----------------------------------------------------------------");


  console.log("Đang gửi giao dịch deploy BatchEventRegistry...");
  const BatchEventRegistry = await hre.ethers.getContractFactory("BatchEventRegistry");
  
  const batchEventRegistryContract = await BatchEventRegistry.deploy(batchRegistryAddress);
  await batchEventRegistryContract.waitForDeployment();
  
  const batchEventRegistryAddress = await batchEventRegistryContract.getAddress();
  console.log(` BatchEventRegistry deployed thành công tại: ${batchEventRegistryAddress}`);


  console.log("----------------------------------------------------------------");
  console.log("TẤT CẢ SMART CONTRACTS ĐÃ ĐƯỢC DEPLOY THÀNH CÔNG!");
  console.log("Hãy sao chép các địa chỉ sau vào file cấu hình (.env hoặc config.js) của Backend:");
  console.log(`{\n  USER_REGISTRY_ADDRESS: "${userRegistryAddress}",\n  BATCH_REGISTRY_ADDRESS: "${batchRegistryAddress}",\n  EVENT_REGISTRY_ADDRESS: "${batchEventRegistryAddress}"\n}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Quá trình deploy gặp lỗi nghiêm trọng:", error);
    process.exit(1);
  });