# Testnet Faucet Setup Instructions

## What Was Implemented

✅ **Backend API Route**: `/api/faucet/eth/route.ts`
- Accepts POST requests with user's wallet address
- Uses Foundry's `cast send` with `--password` flag to send 0.005 ETH
- In-memory rate limiting (1 request per address per 24 hours)
- Returns transaction hash on success

✅ **Frontend Integration**: Updated `handleFaucetETH()` in `page.tsx`
- Checks wallet connection
- Shows loading state ("Sending...")
- Displays success message with Basescan link
- Handles errors gracefully (rate limiting, insufficient funds, etc.)

## Environment Variables Needed

Add to your **`frontend/.env` file** (Next.js reads env vars from the frontend directory):

```bash
# ADD THIS - Password for your "testnet" Foundry keystore
KEYSTORE_PASSWORD=your_keystore_password_here

# Already exists in root .env, but add to frontend/.env too
ETH_RPC_URL=https://sepolia.base.org
```

## Testing Steps

### 1. Add Keystore Password to frontend/.env

```bash
cd /Users/jringenberg/Documents/believeth/frontend
echo "KEYSTORE_PASSWORD=your_actual_keystore_password" >> .env
echo "ETH_RPC_URL=https://sepolia.base.org" >> .env
```

**✅ Security Note**: Using the keystore password is more secure than exporting your private key!

### 3. Restart Dev Server

Kill and restart your Next.js dev server so it picks up the new env var:

```bash
npm run dev
```

### 4. Test in Browser

1. Open your app
2. Click the "$" button in header
3. Ensure wallet is connected
4. Click "Get 0.005 ETH"
5. Should see "Sending..." then success message with TX link

### 5. Test Rate Limiting

Try clicking the button again immediately - should get "Rate limited. Try again in 24 hours."

## Troubleshooting

### "KEYSTORE_PASSWORD not set in environment"
- The environment variable isn't being read
- Make sure it's in `frontend/.env` (NOT root `.env`)
- Restart your dev server after adding it

### "Insufficient funds"
- Your testnet keystore wallet is out of ETH
- Check balance: `cast balance --account testnet --rpc-url https://sepolia.base.org`
- Get more from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### "Invalid password" or authentication errors
- Double-check your keystore password is correct
- Test it manually: `cast wallet list --account testnet --password "your_password"`

### Rate limit resets on server restart
- This is expected - rate limiting is in-memory
- For production, use a database or Redis

## Security Notes

- ✅ Rate limiting prevents abuse
- ✅ API route is server-side only (Next.js App Router default)
- ✅ Never expose `KEYSTORE_PASSWORD` in client code
- ✅ Only sends fixed amount (0.005 ETH) - no user-controlled amounts
- ⚠️ In-memory rate limiting resets on restart (fine for testnet)

## Next Steps (Optional)

1. **Persistent Rate Limiting**: Use Vercel KV or database
2. **Faucet Balance Monitoring**: Alert when keystore balance is low
3. **Admin Panel**: View faucet stats (requests, total distributed, etc.)
4. **CAPTCHA**: Add hCaptcha or reCAPTCHA for additional abuse prevention
