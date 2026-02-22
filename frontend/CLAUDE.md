# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npx tsc --noEmit # Type checking (no typecheck script; use this directly)
```

## Architecture Overview

**Extracredible** is a belief-staking dApp on **Base** (Ethereum L2). Users write beliefs and stake $2 USDC on them, backed by EAS (Ethereum Attestation Service) attestations.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS 16 · REACT 19                              │
│                     App Router · pages · CSS Variables                       │
└──────────────────────────────────────────────────────────────────────────────┘
┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐
│        WAGMI v3        │  │      PRIVY       │  │       REACT QUERY v5         │
│  wallet · write txns   │  │    auth / UX     │  │     server state cache       │
└───────────────────────┘  └─────────────────┘  └──────────────────────────────┘
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│               VIEM v2                │  │           ENS RESOLVER             │
│        publicClient · read RPC       │  │   useDisplayName · mainnet calls   │
└──────────────────────────────────────┘  └───────────────────────────────────┘
┌─────────┐  ┌───────────────┐  ┌────────┐  ┌───────────────────────────────┐
│   EAS   │  │  BELIEFSTAKE  │  │  USDC  │  │      THE GRAPH SUBGRAPH        │
│ attest. │  │  stake/query  │  │$2 ERC20│  │  lib/subgraph.ts · GraphQL     │
└─────────┘  └───────────────┘  └────────┘  └───────────────────────────────┘
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│          BASE MAINNET (L2)           │  │         ETHEREUM MAINNET           │
│    transactions · attestations       │  │         ENS resolution only        │
└──────────────────────────────────────┘  └───────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│                              ALCHEMY                                         │
│                     RPC provider for both chains                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Provider Stack (`app/layout.tsx` → `app/providers.tsx`)

```
PrivyProvider (wallet auth)
  └─ QueryClientProvider (React Query)
    └─ WagmiProvider (Base + Ethereum mainnet)
```

Wagmi is configured with two chains: **Base** (for transactions) and **Ethereum mainnet** (for ENS resolution only).

### Data Layer (`lib/`)

- **`lib/subgraph.ts`** — GraphQL queries against a The Graph subgraph for beliefs and stakes (indexed from on-chain events)
- **`lib/client.ts`** — Viem `publicClient` for Base mainnet direct contract reads
- **`lib/contracts.ts`** — Contract addresses and ABIs for EAS registry, BeliefStake, and USDC

### Core Contracts (Base Mainnet)

| Name | Address |
|---|---|
| EAS Registry | `0x4200000000000000000000000000000000000021` |
| BeliefStake | `0xaff45F0Fc8AF91B9D3A317d550307Efe0FFb7956` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Beliefs are EAS attestations using a custom schema. Staking is a 2-step flow: USDC approve → `BeliefStake.stake(attestationUID)`.

### Pages & Routing (App Router)

- `/` — Home: belief list (filterable) + creation UI
- `/belief/[uid]` — Single belief detail (filters the home component)
- `/account/[address]` — User's beliefs/stakes (filters the home component)
- `/api/faucet/eth` — Server route: sends testnet ETH via Foundry `cast` CLI using `KEYSTORE_PASSWORD`

The home `page.tsx` (~1100 lines) is the core of the app and handles belief creation, listing, staking/unstaking, and the faucet modal.

### ENS Resolution

ENS names are resolved against **Ethereum mainnet** (not Base) using a separate wagmi config entry with `NEXT_PUBLIC_MAINNET_RPC_URL`. The `AddressDisplayWhenVisible` component defers resolution until the element enters the viewport to avoid unnecessary RPC calls. Results are cached 24h in localStorage.

### Environment Variables

| Variable | Used For |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy wallet auth |
| `NEXT_PUBLIC_SUBGRAPH_URL` | The Graph endpoint |
| `ETH_RPC_URL` | Base RPC (server + client) |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | Ethereum mainnet RPC (ENS) |
| `KEYSTORE_PASSWORD` | Faucet server-side only |

### Styling

CSS variables drive the color system. Key accents: Klein Blue (`#002FA7`) for primary actions, a 3-tier yellow scale (`--yellow-*`) for interactive/hover states. `app/styles.css` is the main stylesheet; `app/globals.css` is the reset.
