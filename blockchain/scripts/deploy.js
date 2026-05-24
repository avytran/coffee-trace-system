const hre = require("hardhat");

async function main() {
  console.log("Starting deployment process for CoffeeTraceability contract...");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Account balance: ${hre.ethers.formatEther(balance)} ETH`);
  console.log("--------------------------------------------------");

  const CoffeeTraceability = await hre.ethers.getContractFactory("CoffeeTraceability");
  
  console.log("Sending deployment transaction to the network...");
  const coffeeContract = await CoffeeTraceability.deploy();

  await coffeeContract.waitForDeployment();

  const contractAddress = await coffeeContract.getAddress();

  console.log("--------------------------------------------------");
  console.log("CONTRACT DEPLOYED SUCCESSFULLY!");
  console.log(`Contract Address: ${contractAddress}`);
  console.log("Copy this address to configure your backend/frontend blockchain config file.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment encountered an error:", error);
    process.exit(1);
  });