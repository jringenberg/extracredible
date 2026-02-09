'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

export function ConnectButton() {
  const { login, logout, ready, authenticated } = usePrivy();
  const { address, isConnected } = useAccount();

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
    <button onClick={handleClick} className="btn-connect">
      {connected
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : 'Connect'}
    </button>
  );
}
