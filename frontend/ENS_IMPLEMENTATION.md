# Cross-Chain ENS Resolution Implementation ✅

## Overview

Successfully implemented ENS (Ethereum Name Service) resolution for Believeth, which runs on Base Sepolia testnet. This allows displaying user-friendly ENS names (like `vitalik.eth`) instead of hex addresses, even though ENS doesn't exist on Base chains.

## The Challenge

- **Problem:** Believeth runs on Base Sepolia (L2), but ENS only exists on Ethereum L1
- **Key insight:** Wallet addresses are identical across all EVM chains
- **Solution:** Query ENS from Ethereum mainnet while transactions happen on Base Sepolia

## Smart Strategy: Always Use Mainnet ENS

We query **Ethereum mainnet** ENS even when running on Base Sepolia testnet because:

1. Most real users have ENS names on Ethereum mainnet (not testnet)
2. Zero configuration changes needed when deploying to Base mainnet
3. Works immediately with real-world ENS names

### Configuration Matrix

| Environment | Transactions | ENS Lookups | Config Changes on Mainnet Deploy |
|------------|--------------|-------------|----------------------------------|
| **Testnet** | Base Sepolia | Ethereum Mainnet | ✅ None |
| **Mainnet** | Base Mainnet | Ethereum Mainnet | ✅ None |

## Implementation

### 1. Multi-Chain Wagmi Config

**File:** `app/providers.tsx`

```tsx
import { baseSepolia, mainnet } from 'wagmi/chains';

const config = defaultWagmiConfig({
  chains: [baseSepolia, mainnet], // Always include mainnet for ENS
  projectId: walletConnectProjectId,
  metadata,
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [mainnet.id]: http(), // Use public RPC for ENS lookups
  },
});
```

**Key points:**
- Base Sepolia is the primary chain (for transactions)
- Mainnet is included for ENS resolution only
- No need to switch networks in wallet
- Public RPC is fine for ENS (low volume, read-only)

### 2. AddressDisplay Component

**File:** `components/AddressDisplay.tsx`

A reusable component that:
- Queries ENS name from Ethereum mainnet
- Falls back to truncated address if no ENS name
- Optionally displays ENS avatar
- Works with any address from any chain

**Usage:**
```tsx
// Simple usage
<AddressDisplay address="0x7A7798cdc11cCeFDaa5aA7b07bb076280a4e4c3F" />

// With avatar
<AddressDisplay address={userAddress} showAvatar={true} />

// Full address (no truncation)
<AddressDisplay address={userAddress} truncate={false} />
```

**What it displays:**
- If ENS exists: `vitalik.eth`
- If no ENS: `0x7A77...4c3F`

### 3. useDisplayName Hook

**File:** `hooks/useDisplayName.ts`

For programmatic access to ENS names:

```tsx
const { displayName, ensName, isLoading } = useDisplayName(address);

// displayName: Either ENS name or truncated address
// ensName: The ENS name if it exists, undefined otherwise
// isLoading: true while fetching
```

### 4. Integration Points

**Stake table addresses** - Shows ENS names or truncated addresses:
```tsx
// Before:
<td className="stake-address">
  0<span>x</span>{formattedAddress}
</td>

// After:
<td className="stake-address">
  <AddressDisplay address={stake.staker} />
</td>
```

## How It Works

### The Magic of Cross-Chain Resolution

1. **User connects wallet** on Base Sepolia
2. **Address is identical** on Base Sepolia and Ethereum mainnet
3. **Wagmi queries mainnet ENS** for that address
4. **ENS name displays** if it exists on mainnet
5. **User never switches networks** - it all happens in the background

### Example Flow

```
User address: 0x7A7798cdc11cCeFDaa5aA7b07bb076280a4e4c3F

1. User stakes on Base Sepolia ✅
2. Frontend queries Ethereum mainnet ENS ✅
3. Returns: "alice.eth" (if registered) ✅
4. Displays in stake table ✅
```

## Benefits

### For Development
- ✅ Works immediately on testnet with real ENS names
- ✅ Zero changes needed when deploying to mainnet
- ✅ Can test with your own ENS name right now

### For Users
- ✅ See recognizable names instead of hex addresses
- ✅ Builds trust (verified identities)
- ✅ Better UX when viewing stake history
- ✅ Works with Basenames (`.base.eth`) via CCIP-Read

### For Deployment
- ✅ No configuration changes
- ✅ No environment variables to update
- ✅ No separate testnet/mainnet ENS logic

## Testing

### On Base Sepolia (Testnet)

Test these scenarios:

1. **Your own ENS:**
   - If your wallet has an ENS name on Ethereum mainnet, it will display
   - Even though you're on Base Sepolia testnet

2. **Stake with multiple accounts:**
   - Accounts with ENS: Shows ENS name
   - Accounts without ENS: Shows truncated address
   - Mix displays correctly in stake table

3. **ENS avatars:**
   - Accounts with ENS avatars should display them
   - Test with `showAvatar={true}` prop

### Known Addresses with ENS (for testing)

These addresses have ENS names on mainnet:
- `vitalik.eth` → `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`
- `brantly.eth` → `0x983110309620D911731Ac0932219af06091b6744`

## Deployment Checklist

When switching from testnet to mainnet:

### Changes Required ✏️
- [ ] Update Base RPC from Sepolia to mainnet
- [ ] Update contract addresses
- [ ] Set `NEXT_PUBLIC_ENABLE_TESTNETS=false` (or remove)

### NO Changes Required ✅
- [ ] **ENS configuration** - Already queries mainnet
- [ ] **AddressDisplay component** - Works as-is
- [ ] **useDisplayName hook** - Works as-is
- [ ] **Wagmi config** - Just swap `baseSepolia` for `base`

## Code Locations

### Core Files
- `app/providers.tsx` - Multi-chain wagmi config
- `components/AddressDisplay.tsx` - ENS display component
- `hooks/useDisplayName.ts` - ENS resolution hook
- `app/page.tsx` - Using AddressDisplay in stake tables

### Usage Examples
```tsx
// In stake table
<AddressDisplay address={stake.staker} />

// In sort dropdown (if needed)
<AddressDisplay address={address} truncate={false} />

// With avatar
<AddressDisplay address={creator} showAvatar={true} />
```

## Technical Notes

### Why Mainnet for Testnet?

Most users won't register ENS names on Sepolia testnet because:
1. Costs real testnet ETH
2. No real-world use
3. Gets reset periodically

But they likely **do** have ENS on Ethereum mainnet. By querying mainnet, we show real names immediately, even during testnet development.

### RPC Considerations

**ENS lookups are:**
- Read-only (no gas costs)
- Infrequent (cached by wagmi)
- Small data transfer

**Therefore:**
- Public RPC is fine for mainnet ENS
- If you want faster lookups, add Alchemy/Infura mainnet URL:
  ```tsx
  [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY')
  ```

### Basenames Support

Basenames (e.g., `alice.base.eth`) automatically work via ENS CCIP-Read:
1. ENS query goes to mainnet
2. Mainnet ENS recognizes `.base.eth` subdomain
3. CCIP-Read forwards to Base L2
4. Basename resolves correctly

No additional code needed!

## Future Enhancements

### Optional Improvements

1. **ENS avatars everywhere:**
   ```tsx
   <AddressDisplay address={staker} showAvatar={true} />
   ```

2. **Dedicated user profile pages:**
   ```tsx
   <Link href={`/user/${address}`}>
     <AddressDisplay address={address} showAvatar={true} />
   </Link>
   ```

3. **ENS-based search:**
   ```tsx
   // Allow users to search beliefs by ENS name
   const { address } = useEnsAddress({ name: searchQuery });
   ```

4. **Mainnet deployment:**
   When deploying to Base mainnet, just change:
   ```tsx
   // providers.tsx
   chains: [base, mainnet] // Was: [baseSepolia, mainnet]
   ```

## Troubleshooting

### ENS names not showing

**Check:**
1. Does the address actually have an ENS name on Ethereum mainnet?
   - Visit https://app.ens.domains/
   - Search the address
2. Is the ENS name expired?
3. Is mainnet included in wagmi config?
4. Check browser console for errors

### Slow ENS resolution

**Solutions:**
- Add Alchemy/Infura mainnet RPC URL
- ENS lookups are cached by wagmi after first load
- Consider loading states: `const { isLoading } = useDisplayName(address)`

### Testing ENS locally

**Use known ENS addresses:**
```tsx
// Test addresses
const vitalik = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth
const brantly = "0x983110309620D911731Ac0932219af06091b6744"; // brantly.eth

<AddressDisplay address={vitalik} /> // Shows: vitalik.eth
<AddressDisplay address={brantly} /> // Shows: brantly.eth
```

## Resources

- ENS Documentation: https://docs.ens.domains/
- Basenames: https://www.base.org/names
- Wagmi ENS hooks: https://wagmi.sh/react/api/hooks/useEnsName
- CCIP-Read: https://eips.ethereum.org/EIPS/eip-3668

---

**Implementation date:** February 3, 2026  
**Status:** ✅ Complete and tested  
**Build status:** ✅ Passing  
**Ready for:** Production deployment
