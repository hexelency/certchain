"use client";

import { useState, useCallback } from "react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { useWeb3 } from "./context";

// Contract ABI - only the functions we need
const CONTRACT_ABI = [
  "function registerCertificate(bytes32 certHash) external",
  "function verifyCertificate(bytes32 certHash) external view returns (uint256)",
  "function isRegistered(bytes32 certHash) external view returns (bool)",
  "event CertificateRegistered(bytes32 indexed certHash, uint256 timestamp, address indexed registrar)"
];

interface BlockchainResult {
  success: boolean;
  transactionHash?: string;
  timestamp?: number;
  error?: string;
}

interface UseCertificateBlockchainReturn {
  // Register certificate on blockchain
  registerCertificate: (certHash: string) => Promise<BlockchainResult>;
  
  // Verify certificate on blockchain
  verifyCertificate: (certHash: string) => Promise<{ verified: boolean; timestamp?: number }>;
  
  // Loading states
  isRegistering: boolean;
  isVerifying: boolean;
  
  // Error
  error: string | null;
}

export function useCertificateBlockchain(): UseCertificateBlockchainReturn {
  const { isConnected, account, contractAddress } = useWeb3();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const getContract = useCallback(async () => {
    if (!contractAddress) {
      throw new Error("Contract address not configured");
    }
    
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }
    
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    return new Contract(contractAddress, CONTRACT_ABI, signer);
  }, [contractAddress]);
  
const rpcUrl = "http://127.0.0.1:8545";
const getReadOnlyContract = useCallback(async () => {
  if (!contractAddress) {
    throw new Error("Contract address not configured");
  }
  
  // Use read-only provider (doesn't require wallet connection)
  const provider = new JsonRpcProvider(rpcUrl);
    
    return new Contract(contractAddress, CONTRACT_ABI, provider);
  }, [contractAddress]);
  
  const registerCertificate = useCallback(async (certHash: string): Promise<BlockchainResult> => {
    if (!isConnected || !account) {
      return {
        success: false,
        error: "Wallet not connected. Please connect your wallet first.",
      };
    }
    
    setIsRegistering(true);
    setError(null);
    
    try {
      // Convert certHash to bytes32
      const hashBytes32 = certHash.startsWith("0x") ? certHash : `0x${certHash}`;
      
      const contract = await getContract();
      
      // Send transaction
      const tx = await contract.registerCertificate(hashBytes32);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Get the timestamp from the event
      let timestamp: number | undefined;
      if (receipt.logs && receipt.logs.length > 0) {
        // The event should contain the timestamp
        const parsedLog = contract.interface.parseLog(receipt.logs[0]);
        if (parsedLog && parsedLog.args.timestamp) {
          timestamp = Number(parsedLog.args.timestamp);
        }
      }
      
      return {
        success: true,
        transactionHash: receipt.hash,
        timestamp,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to register certificate on blockchain";
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsRegistering(false);
    }
  }, [isConnected, account, getContract]);
  
  const verifyCertificate = useCallback(async (certHash: string): Promise<{ verified: boolean; timestamp?: number }> => {
    setIsVerifying(true);
    setError(null);
    
    try {
      // Convert certHash to bytes32
      const hashBytes32 = certHash.startsWith("0x") ? certHash : `0x${certHash}`;
      
      const contract = await getReadOnlyContract();
      
      // Call the contract to verify
      const timestamp = await contract.verifyCertificate(hashBytes32);
      
      return {
        verified: timestamp > 0,
        timestamp: timestamp > 0 ? Number(timestamp) : undefined,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to verify certificate on blockchain";
      setError(errorMessage);
      
      return {
        verified: false,
      };
    } finally {
      setIsVerifying(false);
    }
  }, [getReadOnlyContract]);
  
  return {
    registerCertificate,
    verifyCertificate,
    isRegistering,
    isVerifying,
    error,
  };
}