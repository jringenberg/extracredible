'use client';

import { useEnsName, useEnsAvatar } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Address } from 'viem';

interface AddressDisplayProps {
  address: Address | string;
  showAvatar?: boolean;
  truncate?: boolean;
  className?: string;
}

export function AddressDisplay({ 
  address, 
  showAvatar = false,
  truncate = true,
  className = ''
}: AddressDisplayProps) {
  // Always query from mainnet, regardless of which Base chain we're on
  const { data: ensName } = useEnsName({
    address: address as Address,
    chainId: mainnet.id,
  });

  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: mainnet.id,
  });

  const displayName = ensName || (
    truncate 
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address
  );

  return (
    <span className={`address-display ${className}`}>
      {showAvatar && ensAvatar && (
        <img 
          src={ensAvatar} 
          alt={ensName || ''} 
          className="address-avatar"
          style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            marginRight: '8px',
            verticalAlign: 'middle'
          }}
        />
      )}
      {displayName}
    </span>
  );
}
