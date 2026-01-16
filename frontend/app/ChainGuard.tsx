'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export function ChainGuard() {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    // If connected but on wrong chain, switch to Base Sepolia
    if (isConnected && chain && chain.id !== baseSepolia.id) {
      console.log(
        `Wrong chain detected: ${chain.id}. Switching to Base Sepolia (${baseSepolia.id})...`
      );
      switchChain?.({ chainId: baseSepolia.id });
    }
  }, [isConnected, chain, switchChain]);

  return null;
}
