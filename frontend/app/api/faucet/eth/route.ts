import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isAddress } from 'viem';

const execAsync = promisify(exec);

// In-memory rate limiting (resets on server restart)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    // Validate address
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    // Check rate limit
    const lastRequest = rateLimitMap.get(address.toLowerCase());
    const now = Date.now();
    
    if (lastRequest) {
      const timeSinceLastRequest = now - lastRequest;
      if (timeSinceLastRequest < RATE_LIMIT_MS) {
        const hoursRemaining = Math.ceil((RATE_LIMIT_MS - timeSinceLastRequest) / (60 * 60 * 1000));
        return NextResponse.json(
          { 
            success: false, 
            error: `Rate limited. Try again in ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}.` 
          },
          { status: 429 }
        );
      }
    }

    console.log(`[Faucet] Sending 0.005 ETH to ${address}`);

    // Get keystore password from environment
    const keystorePassword = process.env.KEYSTORE_PASSWORD;
    
    if (!keystorePassword) {
      console.error('[Faucet] KEYSTORE_PASSWORD not set in environment');
      return NextResponse.json(
        { success: false, error: 'Faucet not configured. Please contact support.' },
        { status: 500 }
      );
    }

    const rpcUrl = process.env.ETH_RPC_URL || 'https://sepolia.base.org';
    
    // Use --password flag to pass password directly (avoids keychain issues)
    const command = `cast send ${address} --value 0.005ether --account testnet --password "${keystorePassword}" --rpc-url ${rpcUrl}`;
    
    console.log('[Faucet] Executing cast send...');
    const { stdout, stderr } = await execAsync(command);

    // Log output for debugging
    console.log('[Faucet] stdout:', stdout);
    if (stderr) console.log('[Faucet] stderr:', stderr);

    // Parse transaction hash from output
    // Cast output format: "transactionHash     0x..."
    const txHashMatch = stdout.match(/transactionHash\s+(0x[a-fA-F0-9]{64})/);
    
    if (!txHashMatch) {
      console.error('[Faucet] Could not parse transaction hash from output:', stdout);
      return NextResponse.json(
        { success: false, error: 'Failed to parse transaction hash' },
        { status: 500 }
      );
    }

    const txHash = txHashMatch[1];
    console.log(`[Faucet] Success! TX: ${txHash}`);

    // Update rate limit
    rateLimitMap.set(address.toLowerCase(), now);

    return NextResponse.json({
      success: true,
      txHash,
      message: 'Sent 0.005 ETH successfully!',
    });

  } catch (error: unknown) {
    console.error('[Faucet] Error:', error);

    // Handle specific error cases
    const errorMessage = error instanceof Error ? error.message : '';
    
    if (errorMessage.includes('insufficient funds')) {
      return NextResponse.json(
        { success: false, error: 'Faucet wallet has insufficient funds. Please contact support.' },
        { status: 503 }
      );
    }

    if (errorMessage.includes('password')) {
      return NextResponse.json(
        { success: false, error: 'Keystore configuration error. Please contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage || 'Failed to send ETH' },
      { status: 500 }
    );
  }
}
