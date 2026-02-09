'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { baseSepolia, mainnet } from 'viem/chains';
import { ReactNode } from 'react';

// Privy wagmi config
// Import createConfig from @privy-io/wagmi, NOT from wagmi directly
const wagmiConfig = createConfig({
  chains: [baseSepolia, mainnet],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [mainnet.id]: http(), // Public RPC for ENS lookups
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
        supportedChains: [baseSepolia, mainnet],
        defaultChain: baseSepolia,
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
