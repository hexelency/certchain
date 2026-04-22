"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { BrowserProvider, JsonRpcProvider } from "ethers";

interface Web3ContextType {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  account: string | null;
  chainId: number | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Blockchain interaction
  contractAddress: string | null;
  networkName: string;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

// Contract ABI - only the functions we need
const CONTRACT_ABI = [
  "function registerCertificate(bytes32 certHash) external",
  "function verifyCertificate(bytes32 certHash) external view returns (uint256)",
  "function isRegistered(bytes32 certHash) external view returns (bool)",
  "event CertificateRegistered(bytes32 indexed certHash, uint256 timestamp, address indexed registrar)"
];

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Get config from environment
  const contractAddress = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null : null;
  const networkName = process.env.NEXT_PUBLIC_BLOCKCHAIN_NETWORK || "localhost";
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
  
  const clearError = useCallback(() => setError(null), []);
  
  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === "undefined" || !window.ethereum) return;
      
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
          setIsConnected(true);
          
          const network = await provider.getNetwork();
          setChainId(Number(network.chainId));
        }
      } catch (err) {
        console.error("Error checking connection:", err);
      }
    };
    
    checkConnection();
  }, []);
  
  // Listen for account changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null);
        setIsConnected(false);
        setChainId(null);
      } else {
        setAccount(accounts[0]);
        setIsConnected(true);
      }
    };
    
    const handleChainChanged = () => {
      window.location.reload();
    };
    
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    
    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, []);
  
  const connect = useCallback(async () => {
    if (typeof window === "undefined") {
      setError("Web3 not available on server");
      return;
    }
    
    if (!window.ethereum) {
      setError("MetaMask not installed. Please install MetaMask to continue.");
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const provider = new BrowserProvider(window.ethereum);
      
      // Request account access
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length === 0) {
        setError("No accounts found. Please unlock MetaMask.");
        setIsConnecting(false);
        return;
      }
      
      setAccount(accounts[0]);
      setIsConnected(true);
      
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      
      // Check if connected to correct network
      const expectedChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "31337", 10);
      if (Number(network.chainId) !== expectedChainId) {
        setError(`Please switch to the correct network (Chain ID: ${expectedChainId})`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(errorMessage);
      console.error("Wallet connection error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);
  
  const disconnect = useCallback(() => {
    setAccount(null);
    setIsConnected(false);
    setChainId(null);
    setError(null);
  }, []);
  
  const value: Web3ContextType = {
    isConnected,
    isConnecting,
    account,
    chainId,
    connect,
    disconnect,
    contractAddress,
    networkName,
    error,
    clearError,
  };
  
  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  
  return context;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}