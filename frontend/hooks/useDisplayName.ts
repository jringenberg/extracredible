import { useState, useEffect } from 'react';
import { useEnsName } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import type { Address } from 'viem';

const ENS_STALE_TIME_MS = 24 * 60 * 60 * 1000;

const BASE_L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD' as Address;

/** Session cache: one resolved display name per address (normalized). */
const displayNameCache = new Map<string, string>();
/** Addresses we've already started the extra (Coinbase/Farcaster) fetch for this session. */
const extraFetchedAddresses = new Set<string>();

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function normalizeAddress(addr: Address | string | undefined): string | undefined {
  if (!addr) return undefined;
  return addr.toLowerCase();
}

export function useDisplayName(address: Address | string | undefined) {
  const addr = normalizeAddress(address);
  const [extraName, setExtraName] = useState<string | null>(null);
  const [extraLoading, setExtraLoading] = useState(false);

  // 1. Basename (e.g. you.base.eth) — Base chain L2 resolver
  const { data: basename, isLoading: basenameLoading } = useEnsName({
    address: address as Address | undefined,
    chainId: base.id,
    universalResolverAddress: BASE_L2_RESOLVER,
    query: { staleTime: ENS_STALE_TIME_MS, enabled: !!address && !displayNameCache.has(addr!) },
  });

  // 2. Standard ENS — only when Basename is done and null
  const ensEnabled = !!address && !!addr && !displayNameCache.has(addr) && !basenameLoading && !basename;
  const { data: ensName, isLoading: ensLoading } = useEnsName({
    address: address as Address | undefined,
    chainId: mainnet.id,
    query: { staleTime: ENS_STALE_TIME_MS, enabled: ensEnabled },
  });

  const resolvedEns = basename ?? ensName ?? null;

  // Cache ENS result when we get one
  useEffect(() => {
    if (!addr || !resolvedEns) return;
    displayNameCache.set(addr, resolvedEns);
  }, [addr, resolvedEns]);

  // 3 & 4. Coinbase ID then Farcaster — only when both ENS are done and null
  const shouldFetchExtra = !!addr && !displayNameCache.has(addr) && !basenameLoading && !basename && !ensLoading && !ensName && address;

  useEffect(() => {
    if (!shouldFetchExtra || !address || !addr || extraFetchedAddresses.has(addr)) return;
    extraFetchedAddresses.add(addr);
    const ac = new AbortController();
    setExtraLoading(true);

    (async () => {
      try {
        // 3. Coinbase ID
        const cbRes = await fetch(
          `https://resolver.cb.id/name?address=${encodeURIComponent(address)}`,
          { signal: ac.signal }
        );
        if (!cbRes.ok) throw new Error('cb.id not ok');
        const cbJson = (await cbRes.json()) as { name?: string };
        const cbName = typeof cbJson?.name === 'string' ? cbJson.name.trim() : null;
        if (cbName) {
          displayNameCache.set(addr, cbName);
          setExtraName(cbName);
          setExtraLoading(false);
          return;
        }

        // 4. Farcaster
        const fcRes = await fetch(
          `https://api.farcaster.xyz/v2/user-by-verification?address=${encodeURIComponent(address)}`,
          { signal: ac.signal }
        );
        if (!fcRes.ok) throw new Error('farcaster not ok');
        const fcJson = (await fcRes.json()) as { result?: { user?: { username?: string } } };
        const username = fcJson?.result?.user?.username;
        const fcName = typeof username === 'string' ? `${username.trim()}.farcaster` : null;
        if (fcName) {
          displayNameCache.set(addr, fcName);
          setExtraName(fcName);
          setExtraLoading(false);
          return;
        }

        // 5. Truncated address
        const truncated = truncateAddress(address);
        displayNameCache.set(addr, truncated);
        setExtraName(truncated);
      } catch {
        const truncated = truncateAddress(address);
        displayNameCache.set(addr, truncated);
        setExtraName(truncated);
      } finally {
        setExtraLoading(false);
      }
    })();

    return () => ac.abort();
  }, [shouldFetchExtra, address, addr]);

  // Return cached if we have it (avoids re-running resolution)
  const cached = addr ? displayNameCache.get(addr) : undefined;
  if (cached !== undefined) {
    return {
      displayName: cached,
      ensName: basename ?? ensName ?? (cached !== truncateAddress(address || '') ? cached : null) ?? null,
      isLoading: false,
    };
  }

  const displayName = address
    ? (resolvedEns ?? extraName ?? truncateAddress(address))
    : '';
  const isLoading = basenameLoading || (ensEnabled && ensLoading) || extraLoading;

  return {
    displayName,
    ensName: resolvedEns ?? null,
    isLoading,
  };
}
