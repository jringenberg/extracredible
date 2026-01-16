# Believeth

## Core Concept

A protocol where users stake cryptocurrency on belief statements to create public, costly, revocable commitments. Time-weighted stakes become reputation signals - proving conviction through sustained attention and capital at risk.

**Key insight:** Belief without cost is infinite. Belief with sustained cost over time is the rarest signal. Every day you maintain a stake, you're actively choosing to keep your attention and capital on this claim rather than moving to something else.

**Core principle:** $2 is a CAPTCHA, not a signal amplifier. One stake per person per belief. The signal is binary commitment, not wealth. 847 people backing a belief > 1 whale with $1,694.

## Current Status

**Phase:** Testnet MVP complete - full create + stake flow working end-to-end on Base Sepolia
**Tests:** Foundry tests passing for `BeliefStake.sol`
**Frontend:** Next.js app running, wallet connection + create belief + stake working
**Subgraph:** Deployed and indexing on The Graph Studio
**Next:** Enable staking on existing beliefs, add unstake UI, build account/belief detail pages

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
- **$2 as CAPTCHA, not signal amplifier**: One stake per account per belief. More money only proves disposable income, not conviction. The $2 is proof you're real and willing to commit - the binary signal is what matters.
- **No multiple stakes on same belief**: Contract enforces one $2 stake per user per belief. Can't "double down" to show more conviction. 847 people > 1 whale with $1,694.
- **All-or-nothing unstake**: When you unstake, you withdraw your entire $2 position. No partial withdrawals.
- **All yield to protocol**: No user yield-sharing, pure treasury revenue model
- **Primary signal is staker count**: Total stake is secondary - 847 people matters more than total dollars
- **No belief-gating of data**: Everything on-chain is public, gate participation not viewing
- **"Believeth" as name**: Archaic/Biblical form of "believe" - suggests conviction, testimony, putting your beliefs on record

### Naming & Copy

- **Brand:** Believeth (believeth.xyz)
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

1. ~~When to allow variable stake amounts?~~ **DECIDED:** Stay fixed at $2 forever. It's a CAPTCHA, not a signal amplifier.
2. ~~Multiple stakes per user per belief?~~ **DECIDED:** No. One $2 stake per account per belief. Binary signal only.
3. Belief text character limit? (Suggest 280 chars for gas efficiency)
4. Counter-staking feature? (stake against beliefs)
5. How to incentivize consolidation? (prevent duplicate beliefs)
6. When to add premium features? (analytics, API access)
7. Token or no token long-term?
8. Should individual stakes have optional commentary/reasoning attached?

## Testnet Milestone - COMPLETE ✅

**Development:**

- [x] Foundry development environment set up
- [x] BeliefStake.sol written and compiling
- [x] Foundry tests passing

**Contracts:**

- [x] EAS schema registered on Base Sepolia
- [x] BeliefStake.sol deployed (escrow only, no yield yet)
- [x] MockUSDC deployed for testing
- [x] Genesis belief created and staked

**Frontend:**

- [x] Next.js app running on localhost:3000
- [x] Wallet connection working (RainbowKit + wagmi)
- [x] Top beliefs visible (sorted by stake amount)
- [x] Input field + "+$2" button
- [x] Create belief flow works end-to-end
- [x] Chrome extension error suppression added
- [x] Vercel production deployment with custom domains (believeth.xyz, legitify.xyz)

**Indexing:**

- [x] The Graph subgraph deployed to Graph Studio
- [x] Query returns beliefs with stakes + staker counts
- [x] Frontend uses subgraph for display

## Next Phase: Complete Core Features

**Immediate Priorities (in order):**

1. **Enable staking on existing beliefs** - The "+$2" buttons on belief list currently disabled
2. **Add unstake flow** - Contract has `unstake()` function, need UI + flow
3. **Build account page** - `/account/[address]` showing user's beliefs + their stakes
4. **Build belief detail page** - `/belief/[uid]` showing single belief + all activity
5. **Add view toggles** - Chronological vs. by-stake sorting
6. **Styling improvements** - Polish current UI
7. **Yield integration (Aave)** - Generate protocol revenue from staked capital

**Missing Features for V1:**

- Unstaking UI and flow
- Staking on existing beliefs (not just creating new ones)
- Account pages (see all beliefs you've backed)
- Belief detail pages (see all stakers + activity timeline)
- Different sort/filter views (newest, most staked, etc.)
- Activity feeds
- Yield generation strategy (Aave USDC deposits)

## Mainnet Readiness

**Blockers for mainnet:**

1. **Yield Integration** - Need Aave V3 integration for USDC → aUSDC deposits
   - Swappable yield module interface (already designed)
   - AaveYieldStrategy implementation
   - Test on Base mainnet with real USDC
   - Protocol treasury for yield collection

2. **Real USDC** - Switch from MockUSDC to actual USDC on Base
   - Base mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

3. **Contract Audit** - Security review before mainnet deployment
   - Especially important for yield/Aave integration
   - ReentrancyGuard and access controls verified

4. **Mainnet Subgraph** - Deploy subgraph to index Base mainnet
   - Frontend already deployed to production (believeth.xyz)

5. **Gas Cost Testing** - Verify costs acceptable on mainnet
   - Current estimates: ~$0.15-0.25 for create+stake
   - Aave integration adds ~$0.10 per transaction

**Testnet is sufficient for:**
- All UI/UX development
- Feature testing
- User flow validation
- Community testing

## Development Setup

## Contract Addresses & Important Info

**Network:** Base Sepolia (Chain ID: 84532)

**Deployed Contracts:**
- EAS Registry: 0x4200000000000000000000000000000000000021
- EAS Schema UID: 0x21f7fcf4af0c022d3e7316b6a5b9a04dcaedac59eaea803251e653abd1db9fd6
- MockUSDC: 0xA5c82FCFBe1274166D01B1f3cd9f69Eb79bd74E8
- BeliefStake: 0xa37c9A89375134374a866EeD3E57EAF2789d9613

**The Graph:**
- Deploy Key: c8318ab3ea00f0ed2835201278fa5cbe
- Status: Deployed and indexing
- Subgraph queries: Beliefs with stakes, staker counts, timestamps

**Production URLs:**
- Primary: https://believeth.xyz
- Alt domain: https://legitify.xyz
- Vercel deployment: believes-d88dc1v71-jringenbergs-projects.vercel.app

**Development Wallet:**
- Address: 0x7A7798cdc11cCeFDaa5aA7b07bb076280a4e4c3F

**Test Data:**
- Genesis Belief UID: 0x52314b57ebbe83ebe00c02aa3a74df3cf1a55acd682318f7d88777945aa5c1dd
- Genesis Belief Text: "costly signals prove conviction"
- First Stake: $2 USDC by 0x7A7798cdc11cCeFDaa5aA7b07bb076280a4e4c3F

**Environment Variables:**

```text
# Frontend (.env.local)
NEXT_PUBLIC_SUBGRAPH_URL=<The Graph Studio endpoint>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<WalletConnect project ID>

# Deployment scripts (.env)
PRIVATE_KEY=<encrypted keystore via cast wallet>
ETH_RPC_URL=https://sepolia.base.org
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
- Set up testnet wallet (dev wallet)
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

**Session 5 (January 12, 2026):**

- Registered EAS schema on Base Sepolia (non-revocable, single field: `string belief`)
- Created genesis belief attestation: "Costly beliefs are more credible than free words"
- Minted MockUSDC and successfully staked $2 on genesis belief
- Verified full attestation + stake flow works end-to-end on testnet
- Updated testnet wallet address to correct value: 0x7A7798cdc11cCeFDaa5aA7b07bb076280a4e4c3F
- Next: Build minimal frontend for create+stake flow

**Session 6 (January 16, 2026):**

- Got Next.js dev server running on localhost:3000
- Fixed noisy Chrome extension errors with global error suppression
- Confirmed end-to-end flow working: create belief → stake $2 → appears in subgraph
- Verified subgraph deployed and indexing on The Graph Studio
- Confirmed production deployment live at believeth.xyz and legitify.xyz
- Assessed current state: testnet MVP complete, ready for feature expansion
- Updated PROJECT.md with accurate status and roadmap
- Next priorities: Enable staking on existing beliefs, add unstake UI, build account/belief pages

## Repository Structure

```text
believeth/
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

**Last Updated:** January 16, 2026
**Current Phase:** Feature expansion - complete core functionality
**Next Action:** Enable staking on existing beliefs + add unstake flow