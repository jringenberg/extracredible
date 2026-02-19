'use client';

import { useEnsName, useEnsAvatar } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Address } from 'viem';
import Link from 'next/link';

interface AddressDisplayProps {
  address: Address | string;
  showAvatar?: boolean;
  truncate?: boolean;
  className?: string;
  linkToAccount?: boolean;
}

export function AddressDisplay({ 
  address, 
  showAvatar = false,
  truncate = true,
  className = '',
  linkToAccount = false,
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
      ? `${address.slice(0, 6)}…`
      : address
  );

  const content = (
    <>
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
    </>
  );

  if (linkToAccount) {
    return (
      <Link href={`/account/${address}`} className={`address-link ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <span className={`address-display ${className}`}>
      {content}
    </span>
  );
}
