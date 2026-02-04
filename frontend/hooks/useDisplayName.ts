import { useEnsName } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Address } from 'viem';

export function useDisplayName(address: Address | string | undefined) {
  const { data: ensName, isLoading } = useEnsName({
    address: address as Address | undefined,
    chainId: mainnet.id,
  });

  const displayName = address
    ? ensName || `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  return { displayName, ensName, isLoading };
}
