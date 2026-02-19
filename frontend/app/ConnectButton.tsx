'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { useDisplayName } from '@/hooks/useDisplayName';

export function ConnectButton() {
  const { login, logout, ready, authenticated } = usePrivy();
  const { address, isConnected } = useAccount();
  const { displayName } = useDisplayName(address);

  const connected = authenticated && isConnected && address;

  const handleClick = () => {
    if (connected) {
      if (window.confirm('Disconnect wallet?')) {
        logout();
      }
    } else {
      login();
    }
  };

  if (!ready) return null;

  return (
    <button onClick={handleClick} className="btn-cta btn-cta--connect">
      {connected ? displayName || `${address.slice(0, 6)}...` : 'Connect'}
    </button>
  );
}
