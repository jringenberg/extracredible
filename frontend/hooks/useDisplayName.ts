import { useEnsName } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { Address } from 'viem';

const ENS_STALE_TIME_MS = 24 * 60 * 60 * 1000;

// Base L2 Universal Resolver — required because the Base chain definition in
// viem does not include an ENS universal resolver by default.
const BASE_L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD' as Address;

export function useDisplayName(address: Address | string | undefined) {
  // 1. Base name (e.g. you.base.eth) — resolved via Base chain L2 resolver
  const { data: basename, isLoading: basenameLoading } = useEnsName({
    address: address as Address | undefined,
    chainId: base.id,
    universalResolverAddress: BASE_L2_RESOLVER,
    query: { staleTime: ENS_STALE_TIME_MS },
  });

  // 2. Standard .eth ENS name — resolved via Ethereum mainnet
  const { data: ensName, isLoading: ensLoading } = useEnsName({
    address: address as Address | undefined,
    chainId: mainnet.id,
    query: { staleTime: ENS_STALE_TIME_MS },
  });

  const resolvedName = basename || ensName;
  const displayName = address
    ? resolvedName || `${address.slice(0, 6)}...`
    : '';

  return { displayName, ensName: resolvedName, isLoading: basenameLoading || ensLoading };
}
