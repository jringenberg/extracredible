# Believeth Contract Architecture

## Overview (250 words)

Believeth uses a layered contract architecture that separates concerns and enables future upgrades without user disruption.

**BeliefStake** is the core escrow contract. It receives $2 USDC stakes tied to EAS attestation UIDs, tracks per-user and per-belief totals, and emits events that The Graph indexes. The contract enforces binary stakes: one $2 commitment per user per belief. This isn't a wealth signal—it's a CAPTCHA proving real commitment. BeliefStake is deliberately simple, handling only stake accounting while delegating capital deployment elsewhere.

**IYieldStrategy** is the abstraction layer for idle capital. Instead of holding USDC directly, BeliefStake deposits to a yield strategy contract implementing this interface. The interface defines deposit, withdraw, and yield harvesting functions. This abstraction is the "backdoor"—the hook point for future yield generation.

**NullYieldStrategy** is the initial implementation. It simply holds USDC without generating yield, acting as a passthrough. This establishes the interface pattern from day one, meaning BeliefStake's code never changes when we switch to real yield. The backdoor leads nowhere—for now.

**AaveYieldStrategy** (planned) will deposit USDC to Aave V3 on Base, earning supply APY. Users always receive their $2 principal on unstake; yield accrues to the protocol treasury. Migration happens atomically via `migrateYieldStrategy()`: withdraw all from old strategy, deposit to new, single transaction, zero user action required.

The strategic principle: separate what changes (yield source) from what's stable (stake accounting). Future strategies—Compound, Morpho, novel protocols—plug into the same interface. The architecture is future-proof without being over-engineered.
