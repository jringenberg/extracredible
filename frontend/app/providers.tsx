'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { base, mainnet } from 'viem/chains';
import { ReactNode } from 'react';

const baseRpc = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ?? 'https://mainnet.base.org';
const mainnetRpc = process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? 'https://eth.llamarpc.com';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const isFallback = !process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
  console.log(
    '[ENS] Mainnet RPC:',
    isFallback ? 'LlamaRPC (fallback). Add NEXT_PUBLIC_MAINNET_RPC_URL to frontend/.env.local for Alchemy.' : 'custom (env set)'
  );
}

const wagmiConfig = createConfig({
  chains: [base, mainnet],
  transports: {
    [base.id]: http(baseRpc),
    [mainnet.id]: http(mainnetRpc), // ENS lookups
  },
});

// Create QueryClient outside component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          showWalletLoginFirst: true,
          theme: 'light',
          accentColor: '#002FA7', // Klein Blue
        },
        loginMethods: ['wallet'],
        supportedChains: [base],
        defaultChain: base,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
