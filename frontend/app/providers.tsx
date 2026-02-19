'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { base, mainnet } from 'viem/chains';
import { ReactNode } from 'react';
import { BASE_RPC } from '@/lib/contracts';

const mainnetRpc = process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? 'https://eth.llamarpc.com';
const wagmiConfig = createConfig({
  chains: [base, mainnet],
  transports: {
    [base.id]: http(BASE_RPC),
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
