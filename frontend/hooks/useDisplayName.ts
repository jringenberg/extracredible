import { useEnsName } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { Address, toCoinType } from 'viem';

const ENS_STALE_TIME_MS = 24 * 60 * 60 * 1000;
const BASE_COIN_TYPE = toCoinType(base.id);

export function useDisplayName(address: Address | string | undefined) {
  // ENSIP-19: resolve Base primary name (basename) via mainnet ENS
  const { data: basename, isLoading: basenameLoading } = useEnsName({
    address: address as Address | undefined,
    chainId: mainnet.id,
    coinType: BASE_COIN_TYPE,
    query: { staleTime: ENS_STALE_TIME_MS },
  });

  // Fallback: standard .eth ENS name
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
