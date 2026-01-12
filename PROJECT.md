# Legitify

## Core Concept

A protocol where users stake cryptocurrency on belief statements to create public, costly, revocable commitments. Time-weighted stakes become reputation signals - proving conviction through sustained attention and capital at risk.

**Key insight:** Belief without cost is infinite. Belief with sustained cost over time is the rarest signal. Every day you maintain a stake, you're actively choosing to keep your attention and capital on this claim rather than moving to something else.

## Current Status

**Phase:** Contracts deployed + escrow staking working on Base Sepolia (no yield yet)
**Tests:** Foundry tests written and passing for `BeliefStake.sol`
**Next:** Register EAS schema on Base Sepolia and set `NEXT_PUBLIC_BELIEF_SCHEMA_UID`, then build a minimal frontend create+stake flow

## Technical Architecture

### Core Components

1. **EAS (Ethereum Attestation Service)** - Attestation layer
   - Immutable belief statements on-chain
   - Schema: `belief (string), timestamp (uint256)`
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
- **No conviction field in schema**: Removed to reduce friction; the stake itself is the confidence signal
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
7. Should individual stakes have optional commentary/reasoning attached?

## Testnet Milestone (2 weeks)

**Development:**

- [x] Foundry development environment set up
- [x] BeliefStake.sol written and compiling

**Contracts:**

- [ ] EAS schema registered on Base Sepolia
- [x] BeliefStake.sol deployed (escrow only, no yield yet)
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

**Contract Addresses (Base Sepolia):**

- EAS Registry: 0x4200000000000000000000000000000000000021
- Belief Schema UID: (not yet registered)
- MockUSDC: 0xA5c82FCFBe1274166D01B1f3cd9f69Eb79bd74E8
- BeliefStake: 0xa37c9A89375134374a866EeD3E57EAF2789d9613

**Environment Variables:**

```text
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

**Session 2 (January 9, 2026):**

- Explored naming, decided on believeth.xyz (runner-up: publicbelief.xyz)
- Removed conviction score from schema - friction kills momentum, stake itself is the confidence signal
- Clarified core thesis: beliefs are constraint commitments made coordinable through cost
- Next: Set up Next.js frontend scaffold, write contract tests

**Session 3 (January 9, 2026):**

- Wrote and passed all Foundry tests for BeliefStake.sol
- Set up testnet wallet (0x7a77...)
- Learned critical security lesson: never paste private keys in commands
- Set up .env file for environment variables
- Hit confusion with .env variable naming conventions (NEXT_PUBLIC_ vs plain vars)
- Next: Clarify .env setup, deploy MockUSDC to testnet, then deploy BeliefStake

**Session 4 (January 9, 2026):**

- Debugged .env and Foundry configuration extensively
- Learned: `forge create` needs `--rpc-url` before contract path, or use `ETH_RPC_URL` env var
- Set up encrypted keystore with `cast wallet import testnet` (more secure than raw private keys)
- Successfully deployed MockUSDC to Base Sepolia: 0xA5c82FCFBe1274166D01B1f3cd9f69Eb79bd74E8
- Successfully deployed BeliefStake to Base Sepolia: 0xa37c9A89375134374a866EeD3E57EAF2789d9613
- Tested contract functionality: staked $2 on test attestation UID, verified with getStake()
- Contract is live and working on testnet!
- Next: Register EAS schema, build frontend

## Repository Structure

```text
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

- EAS Docs: <https://docs.attest.sh>
- Base Sepolia: <https://sepolia.basescan.org>
- The Graph: <https://thegraph.com>
- Aave V3: <https://docs.aave.com>

---

**Last Updated:** January 12, 2026
**Current Phase:** Testnet integration (schema + minimal frontend)
**Next Action:** Register EAS schema on Base Sepolia, then wire `NEXT_PUBLIC_BELIEF_SCHEMA_UID` into the frontend
