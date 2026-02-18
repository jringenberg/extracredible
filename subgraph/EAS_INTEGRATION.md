# EAS Attestation Indexing - Implementation Complete

## Summary

The subgraph now indexes both BeliefStake contract events AND EAS attestation events, storing belief text directly in the Belief entity. This eliminates the need for separate EAS API calls from the frontend.

## Changes Made

### 1. Schema Update (`schema.graphql`)
- Added `beliefText: String!` field to Belief entity
- This stores the actual belief statement from EAS attestations

### 2. New Files Created

#### `abis/EAS.json`
- Contains EAS contract ABI with:
  - `Attested` event definition
  - `getAttestation()` function definition (for contract calls in handlers)

#### `src/eas.ts`
- New mapping file for EAS events
- `handleAttested()`: Processes attestation creation events
  - Filters for belief schema UID: `0x21f7fcf4af0c022d3e7316b6a5b9a04dcaedac59eaea803251e653abd1db9fd6`
  - Calls `EAS.getAttestation()` to retrieve attestation data
  - Decodes ABI-encoded string using `ethereum.decode('(string)', data)`
  - Stores decoded text in `belief.beliefText`

### 3. Updated Files

#### `subgraph.yaml`
- Added EAS as second data source:
  - Contract: `0x4200000000000000000000000000000000000021` (Base Sepolia)
  - Event: `Attested(indexed address,indexed address,bytes32,indexed bytes32)`
  - Start block: 36069795 (same as BeliefStake)

#### `src/belief-stake.ts`
- Updated `handleStaked()` to handle race conditions:
  - If Belief doesn't exist yet, creates it with empty `beliefText`
  - EAS handler will populate text when attestation event is processed
- Fixed type handling: Use `Bytes` directly instead of converting to hex strings

## Build Verification

✅ `npm run codegen` - Successful
✅ `npm run build` - Successful

Both data sources (BeliefStake and EAS) compiled without errors.

## Deployment Steps

### 1. Deploy to The Graph Studio

```bash
cd subgraph
npm run deploy
```

This will deploy version with tag (enter version when prompted, e.g., `v0.2.0`).

### 2. Monitor Indexing

After deployment:
1. Go to The Graph Studio dashboard
2. Watch subgraph sync progress
3. Check logs for any indexing errors
4. Verify it reindexes from block 36069795

### 3. Test Query

Once synced, test that belief text is populated:

```graphql
{
  beliefs(first: 5, orderBy: totalStaked, orderDirection: desc) {
    id
    beliefText
    totalStaked
    stakerCount
    createdAt
    stakes(where: { active: true }, first: 3) {
      staker
      amount
      stakedAt
    }
  }
}
```

Expected result: All beliefs should have `beliefText` populated (not empty strings).

## Frontend Updates Needed

After subgraph deployment, update the frontend to use `beliefText` directly:

### Update `lib/subgraph.ts`

```typescript
type Belief = {
  id: string;
  beliefText: string; // NEW
  totalStaked: string;
  stakerCount: number;
  createdAt: string;
  lastStakedAt: string;
  stakes: Array<{
    stakedAt: string;
    active: boolean;
  }>;
};

const beliefsQuery = gql`
  query GetBeliefs {
    beliefs(first: 1000, orderBy: totalStaked, orderDirection: desc) {
      id
      beliefText
      totalStaked
      stakerCount
      createdAt
      stakes(where: { active: true }, orderBy: stakedAt, orderDirection: desc, first: 1) {
        stakedAt
        active
      }
    }
  }
`;
```

### Update `app/page.tsx`

Remove EAS SDK calls and use `beliefText` directly:

```typescript
// BEFORE: Separate EAS fetching
const beliefTexts = await fetchBeliefTexts(fetchedBeliefs.map(b => b.id));

// AFTER: Use beliefText from subgraph
const beliefsWithText = fetchedBeliefs.map(belief => ({
  ...belief,
  text: belief.beliefText
}));
```

This eliminates:
- EAS SDK initialization
- Separate `getAttestation()` calls for each belief
- Query explosion on page load
- Slow initial page render

## Benefits

✅ **Single Query**: One GraphQL query returns complete belief data
✅ **No Query Explosion**: Eliminates N+1 EAS API calls
✅ **Faster Load**: No waiting for separate attestation fetches
✅ **Simpler Code**: Remove EAS SDK from frontend
✅ **Better UX**: Instant page load with all data ready

## Technical Notes

- **Schema UID Filtering**: Handler only processes attestations from our belief schema
- **Race Condition Handling**: Gracefully handles stakes arriving before attestations
- **Type Safety**: Uses `Bytes` type consistently for attestation UIDs
- **Contract Calls**: `getAttestation()` call is efficient (read-only, handled by Graph nodes)
- **Reindexing**: Existing beliefs will populate with text during reindex

## Rollback Plan

If issues arise, previous subgraph version remains deployed and can be switched back in Studio settings. Frontend can continue using EAS SDK temporarily.
