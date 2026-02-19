import { useEnsName } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Address } from 'viem';

const ENS_STALE_TIME_MS = 24 * 60 * 60 * 1000;

export function useDisplayName(address: Address | string | undefined) {
  const { data: ensName, isLoading } = useEnsName({
    address: address as Address | undefined,
    chainId: mainnet.id,
    query: { staleTime: ENS_STALE_TIME_MS },
  });

  const displayName = address
    ? ensName || `${address.slice(0, 6)}...`
    : '';

  return { displayName, ensName, isLoading };
}
