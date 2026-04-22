import { ethers } from "ethers";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying CertificateRegistry contract...");

  // Connect to local Hardhat node
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  // Use the first Hardhat account (has ETH)
  const wallet = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );

  // Read the compiled contract artifact
  const artifactPath = path.join(process.cwd(), "artifacts", "contracts", "CertificateRegistry.sol", "CertificateRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create contract factory with bytecode and ABI
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // Deploy the contract
  const contract = await factory.deploy();
  
  // Wait for deployment
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  console.log("\n✅ CertificateRegistry deployed successfully!");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log("\n--- Add this to your .env.local file ---");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("\n--- MetaMask Configuration ---");
  console.log("Network Name: Local Hardhat");
  console.log("RPC URL: http://127.0.0.1:8545");
  console.log("Chain ID: 31337");
  console.log("Currency Symbol: ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying contract:", error);
    process.exit(1);
  });