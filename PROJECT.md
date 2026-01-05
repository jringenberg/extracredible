# OnRecord

## Core Concept

A protocol where users stake cryptocurrency on belief statements to create public, costly, revocable commitments. Time-weighted stakes become reputation signals - proving conviction through sustained attention and capital at risk.

**Key insight:** Belief without cost is infinite. Belief with sustained cost over time is the rarest signal. Every day you maintain a stake, you're actively choosing to keep your attention and capital on this claim rather than moving to something else.

## Current Status

**Phase:** Development environment ready
**Next:** Write tests for BeliefStake.sol

## Technical Architecture

### Core Components

1. **EAS (Ethereum Attestation Service)** - Attestation layer
   - Immutable belief statements on-chain
   - Schema: `belief (string), conviction (uint8 0-100), timestamp (uint256)`
   - One attestation per unique belief text
   - Returns attestation UID for reference

2. **BeliefStake Contract** - Stake management
   - Holds USDC stakes in escrow
   - Maps attestation UIDs to stake amounts per user
   - Tracks timestamps for duration tracking
   - Upgradeable via proxy pattern

3. **Yield Strategy (Swappable Module)** - Revenue generation
   - Interface: `depositToYield()` / `withdrawFromYield()`
   - Initial implementation: Aave USDC deposits
   - Yield accrues to protocol treasury
   - Users always get back their $2 principal

4. **The Graph** - Indexing layer
   - Watches EAS attestations + stake events
   - Creates unified Belief entities
   - Frontend queries for sorted/filtered lists

### Data Flow

User stakes $2 → BeliefStake receives USDC → Deposits to Aave → Tracks aUSDC shares → User unstakes → Withdraws from Aave → Returns $2 principal → Excess yield stays as protocol revenue

### Blockchain

- **Primary chain:** Base (Optimism L2)
- **Testnet:** Base Sepolia
- **Stake token:** USDC

## Key Decisions

### Architecture Decisions

- **EAS for attestations** (not custom contracts): Composability and established standard over full control
- **Separate stake contract** (not EAS resolver): Flexibility to upgrade stake logic without touching attestation layer
- **No category field in schema**: Keep tight, categories can be frontend tags
- **Conviction field included**: Worth the gas for interesting signal (staking at 60% vs 95% confidence)
- **Swappable yield module**: Don't hard-code Aave, use interface so strategy can change

### Product Decisions

- **Fixed $2 stakes in V1**: Decided against variable amounts to keep UI simple and remove "how much should I stake?" friction. Can be made variable in V2 if needed.
- **All yield to protocol**: No user yield-sharing, pure treasury revenue model
- **Primary signal is staker count**: Total stake is secondary - 847 people matters more than total dollars
- **No belief-gating of data**: Everything on-chain is public, gate participation not viewing
- **"OnRecord" as name**: "I put it on record" → "I put it on OnRecord" - understated, permanent, action-oriented

### Naming & Copy

- **Brand:** OnRecord (onrecord.xyz)
- **Main feed:** "Popular Beliefs" (not repeated elsewhere)
- **Action verbs:** "Back This" / "Co-Sign" (not "stake" in UI)
- **Tagline direction:** "Put your money where your beliefs are" / "Words are cheap. Prove what you believe."

## Staking & Yield (V1)

**Fixed stake amount:** $2 USDC per belief (can be manually adjusted later)

**Yield model:**
- All staked USDC deposited to Aave
- 100% of yield goes to protocol treasury
- Users always get back exactly their $2 principal on unstake
- No duration bonuses, no tiers, no yield-sharing in V1

**Rationale:** Simplest possible implementation. Fixed amount removes UI complexity and makes "back this" action instant. Pure protocol revenue model proven before adding user incentives. Future versions can add variable amounts and yield-sharing if needed.

## Gas Cost Estimates (Base)

- Create new belief + $2 stake: ~$0.15-0.25
- Add $2 to existing belief: ~$0.05-0.10
- With Aave integration: +~$0.10 per transaction

$2 stake is 10-20x larger than gas costs - gas not a barrier.

## Open Questions

1. When to allow variable stake amounts? (Stay fixed at $2 or add flexibility?)
2. Belief text character limit? (Suggest 280 chars for gas efficiency)
3. Counter-staking feature? (stake against beliefs)
4. How to incentivize consolidation? (prevent duplicate beliefs)
5. When to add premium features? (analytics, API access)
6. Token or no token long-term?
7. Should conviction scores be updatable after staking? If yes, require additional stake + commentary?
8. Should individual stakes have optional commentary/reasoning attached?

## Testnet Milestone (2 weeks)

**Development:**
- [x] Foundry development environment set up
- [x] BeliefStake.sol written and compiling

**Contracts:**
- [ ] EAS schema registered on Base Sepolia
- [ ] BeliefStake.sol deployed (with Aave yield to treasury)
- [ ] 10 test beliefs created

**Frontend:**
- [ ] One page deployed to Vercel
- [ ] Top 3 beliefs visible
- [ ] Input field + "Back This $2" button
- [ ] Wallet connection (Privy or wagmi)
- [ ] Create belief flow works end-to-end

**Indexing:**
- [ ] The Graph subgraph deployed
- [ ] Query returns beliefs with stakes + staker counts
- [ ] Frontend uses subgraph for display

## Development Setup

*(To be filled in once contracts deployed)*

**Contract Addresses (Base Sepolia):**
- EAS Registry: 
- Belief Schema UID:
- BeliefStake:

**Environment Variables:**
```
NEXT_PUBLIC_BASE_RPC_URL=
NEXT_PUBLIC_BELIEF_SCHEMA_UID=
NEXT_PUBLIC_STAKE_CONTRACT=
PRIVATE_KEY=
```

## Session Log

**Session 1 (January 05, 2026):**
- Created repo and PROJECT.md
- Wrote BeliefStake.sol (basic escrow, $2 fixed stakes)
- Installed Foundry and OpenZeppelin
- Contract compiles successfully
- Next: Write Foundry tests

## Repository Structure
```
onrecord/
├── PROJECT.md              # This file - single source of truth
├── README.md               # Public-facing documentation
├── contracts/              # Smart contracts
│   ├── BeliefStake.sol
│   ├── YieldStrategy.sol
│   ├── AaveYieldStrategy.sol
│   └── test/
├── frontend/               # Next.js app
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
├── subgraph/               # The Graph indexing
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── src/
└── scripts/                # Deploy/seed scripts
```

## Resources

- EAS Docs: https://docs.attest.sh
- Base Sepolia: https://sepolia.basescan.org
- The Graph: https://thegraph.com
- Aave V3: https://docs.aave.com

---

**Last Updated:** January 05, 2026
**Current Phase:** Development environment ready
**Next Action:** Write Foundry tests for BeliefStake.sol