'use client';

import { useEnsName, useEnsAvatar } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Address } from 'viem';
import Link from 'next/link';
import { useInView } from '@/hooks/useInView';

/** 24h cache so we don't hammer mainnet RPC for repeated address lookups */
const ENS_STALE_TIME_MS = 24 * 60 * 60 * 1000;

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
    query: { staleTime: ENS_STALE_TIME_MS },
  });

  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: mainnet.id,
    query: { staleTime: ENS_STALE_TIME_MS },
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

/** Wrapper that only resolves ENS when the element is in the viewport. Use for attester on cards to avoid N lookups on load. */
interface AddressDisplayWhenVisibleProps {
  address: Address | string;
  className?: string;
  linkToAccount?: boolean;
}

export function AddressDisplayWhenVisible({
  address,
  className = '',
  linkToAccount = false,
}: AddressDisplayWhenVisibleProps) {
  const [inView, setRef] = useInView();
  const truncated = `${String(address).slice(0, 6)}…`;

  const placeholder = linkToAccount ? (
    <Link href={`/account/${address}`} className={`address-link ${className}`}>
      {truncated}
    </Link>
  ) : (
    <span className={`address-display ${className}`}>{truncated}</span>
  );

  return (
    <span ref={setRef}>
      {inView ? (
        <AddressDisplay address={address} linkToAccount={linkToAccount} className={className} />
      ) : (
        placeholder
      )}
    </span>
  );
}
