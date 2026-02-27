'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { useRef, useState, useEffect } from 'react';
import { useDisplayName } from '@/hooks/useDisplayName';
import { useWalletButtonGlow } from '@/hooks/useWalletButtonGlow';
import styles from '@/styles/GlowConnectButton.module.css';

export function GlowConnectButton() {
  const { login, logout, ready, authenticated } = usePrivy();
  const { address, isConnected } = useAccount();
  const { displayName } = useDisplayName(address);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isPending, setIsPending] = useState(false);

  const connected = !!(authenticated && isConnected && address);
  const walletDetected = typeof window !== 'undefined' && !!window.ethereum;

  const connectionState: 'connected' | 'pending' | 'disconnected' = connected
    ? 'connected'
    : isPending
      ? 'pending'
      : 'disconnected';

  // Clear isPending when Privy auth resolves (success path).
  useEffect(() => {
    if (authenticated) setIsPending(false);
  }, [authenticated]);

  const { cssVars, dataState, handleMouseEnter, handleMouseLeave, handleClick, handleReject } =
    useWalletButtonGlow({ buttonRef, walletDetected, connectionState });

  const onButtonClick = async () => {
    if (connected) {
      if (window.confirm('Disconnect wallet?')) logout();
      return;
    }
    handleClick();
    setIsPending(true);
    try {
      await login();
    } catch {
      setIsPending(false);
      handleReject();
    }
  };

  if (!ready) return null;

  const label = connected
    ? displayName || `${address!.slice(0, 6)}...${address!.slice(-4)}`
    : 'Connect';

  return (
    <button
      ref={buttonRef}
      className={styles.button}
      style={cssVars}
      data-state={dataState}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onButtonClick}
    >
      {label}
    </button>
  );
}
