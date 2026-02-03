'use client';

import { getDefaultConfig, RainbowKitProvider, lightTheme, AvatarComponent } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { http } from 'viem';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ChainGuard } from './ChainGuard';
import { ErrorSuppressor } from './ErrorSuppressor';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  'f663d58e37395d5dad4d6ba0fe9fd134';

// Explicit Base Sepolia configuration with RPC URL
const config = getDefaultConfig({
  appName: 'Believeth',
  projectId: walletConnectProjectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
  ssr: true,
  // Explicit metadata for WalletConnect
  metadata: {
    name: 'Believeth',
    description: 'Stake beliefs onchain',
    url: 'https://believeth.xyz',
    icons: ['https://believeth.xyz/icon.png'],
  },
});

const appInfo = {
  appName: 'Believeth',
  learnMoreUrl: 'https://believeth.xyz',
};

const customTheme = lightTheme({
  accentColor: '#002FA7', // Klein Blue (International Klein Blue)
  accentColorForeground: '#FFF',
  borderRadius: 'large',
  overlayBlur: 'small',
  fontStack: 'system',
});

// Custom avatar that returns null (no avatar)
const CustomAvatar: AvatarComponent = () => null;

// Create QueryClient outside component to prevent reinitialization on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          appInfo={appInfo} 
          initialChain={baseSepolia}
          theme={customTheme}
          avatar={CustomAvatar}
          modalSize="compact"
        >
          <ErrorSuppressor />
          <ChainGuard />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

