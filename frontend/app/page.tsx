'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Header } from './Header';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { decodeAbiParameters, encodeAbiParameters } from 'viem';
import { getBeliefs } from '@/lib/subgraph';
import { ProgressBar } from './ProgressBar';
import {
  CONTRACTS,
  EAS_ABI,
  EAS_WRITE_ABI,
  BELIEF_STAKE_ABI,
  BELIEF_STAKE_WRITE_ABI,
  ERC20_ABI,
  STAKE_AMOUNT,
} from '@/lib/contracts';

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...`;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [belief, setBelief] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [beliefs, setBeliefs] = useState<
    Array<{
      id: string;
      totalStaked: string;
      stakerCount: number;
      createdAt: string;
      lastStakedAt: string;
    }>
  >([]);
  const [beliefTexts, setBeliefTexts] = useState<Record<string, string>>({});
  const [sortOption, setSortOption] = useState<'popular' | 'recent' | 'wallet'>('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [userStakes, setUserStakes] = useState<Record<string, boolean>>({});
  const [loadingBeliefId, setLoadingBeliefId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  
  // Memoize the modal toggle to prevent unnecessary re-renders
  const toggleFaucetModal = useCallback(() => {
    setShowFaucetModal(prev => !prev);
  }, []);
  const [faucetLoading, setFaucetLoading] = useState<'eth' | 'usdc' | null>(null);
  const [faucetStatus, setFaucetStatus] = useState('');
  const [faucetTxHash, setFaucetTxHash] = useState<{ eth?: string; usdc?: string }>({});
  const [contractAddressCopied, setContractAddressCopied] = useState(false);

  // Toggle faucet mode body class
  useEffect(() => {
    if (showFaucetModal) {
      document.body.classList.add('faucet-active');
    } else {
      document.body.classList.remove('faucet-active');
    }
    return () => {
      document.body.classList.remove('faucet-active');
    };
  }, [showFaucetModal]);

  // Auto-grow textarea as content changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [belief]);

  useEffect(() => {
    async function fetchBeliefs() {
      try {
        const fetchedBeliefs = await getBeliefs();
        setBeliefs(fetchedBeliefs);
      } catch (error) {
        console.error('Error fetching beliefs:', error);
      }
    }

    fetchBeliefs();
  }, []);

  // Reset to "popular" if user disconnects while on "wallet" filter
  useEffect(() => {
    if (!isConnected && sortOption === 'wallet') {
      setSortOption('popular');
    }
  }, [isConnected, sortOption]);

  // Filter and sort beliefs based on selected option
  const displayedBeliefs = beliefs.filter((belief) => {
    if (sortOption === 'popular' || sortOption === 'recent') {
      // Only show beliefs with non-zero stake
      return BigInt(belief.totalStaked || '0') > 0n;
    }
    // For 'wallet' option, show beliefs where connected wallet has an active stake
    if (sortOption === 'wallet' && address) {
      return userStakes[belief.id] === true;
    }
    return false;
  }).sort((a, b) => {
    if (sortOption === 'popular') {
      // Sort by total staked (descending)
      return Number(BigInt(b.totalStaked || '0') - BigInt(a.totalStaked || '0'));
    } else if (sortOption === 'recent') {
      // Sort by most recent stake activity (most recent first)
      return Number(b.lastStakedAt) - Number(a.lastStakedAt);
    }
    // Default sort (for wallet option)
    return 0;
  });

  useEffect(() => {
    async function fetchBeliefTexts() {
      if (!publicClient || beliefs.length === 0) return;

      // Use a ref check inside the effect instead of dependency array
      const missingIds = beliefs
        .map((belief) => belief.id)
        .filter((id) => !beliefTexts[id]);

      if (missingIds.length === 0) return;

      try {
        const entries = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const attestation = await publicClient.readContract({
                address: CONTRACTS.EAS_REGISTRY as `0x${string}`,
                abi: EAS_ABI,
                functionName: 'getAttestation',
                args: [id as `0x${string}`],
              });

              const data = attestation.data as `0x${string}`;
              if (!data || data === '0x') {
                return [id, '[Test stake - no belief text]'] as const;
              }

              const decoded = decodeAbiParameters(
                [{ name: 'belief', type: 'string' }],
                data
              );
              const decodedText = decoded[0] ?? '';

              return [
                id,
                decodedText || '[Test stake - no belief text]',
              ] as const;
            } catch (error) {
              console.error(`Error fetching belief ${id}:`, error);
              return [id, '[Test stake - no belief text]'] as const;
            }
          })
        );

        setBeliefTexts((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      } catch (error) {
        console.error('Error fetching belief text:', error);
      }
    }

    fetchBeliefTexts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beliefs, publicClient]);

  // Check which beliefs the user has staked on
  useEffect(() => {
    async function checkUserStakes() {
      if (!publicClient || !address || beliefs.length === 0) return;

      try {
        const stakeChecks = await Promise.all(
          beliefs.map(async (belief) => {
            try {
              const result = await publicClient.readContract({
                address: CONTRACTS.BELIEF_STAKE as `0x${string}`,
                abi: BELIEF_STAKE_ABI,
                functionName: 'getStake',
                args: [belief.id as `0x${string}`, address],
              });
              
              const [amount] = result as [bigint, bigint];
              return [belief.id, amount > 0n] as const;
            } catch (error) {
              console.error('Error checking stake:', error);
              return [belief.id, false] as const;
            }
          })
        );

        // Merge with existing state instead of replacing to preserve optimistic updates
        setUserStakes((prev) => ({ ...prev, ...Object.fromEntries(stakeChecks) }));
      } catch (error) {
        console.error('Error checking user stakes:', error);
      }
    }

    checkUserStakes();
  }, [beliefs, address, publicClient]);

  const handleFaucetETH = (openConnectModal?: () => void) => async () => {
    if (!address) {
      if (openConnectModal) {
        openConnectModal();
      }
      return;
    }

    setFaucetLoading('eth');
    setFaucetStatus('');

    try {
      const response = await fetch('/api/faucet/eth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (data.success) {
        setFaucetTxHash((prev) => ({ ...prev, eth: data.txHash }));
      } else {
        setFaucetStatus(data.error);
      }
    } catch (error: unknown) {
      console.error('[Faucet ETH] Error:', error);
      setFaucetStatus('Failed to request ETH. Please try again.');
    } finally {
      setFaucetLoading(null);
    }
  };
  
  const handleFaucetUSDC = (openConnectModal?: () => void) => async () => {
    if (!walletClient || !address) {
      if (openConnectModal) {
        openConnectModal();
      }
      return;
    }
    
    setFaucetLoading('usdc');
    setFaucetStatus('');
    
    try {
      const mintTx = await walletClient.writeContract({
        address: CONTRACTS.MOCK_USDC as `0x${string}`,
        abi: [
          {
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            name: 'mint',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'mint',
        args: [address, 20000000n], // 20 USDC
        chain: baseSepolia,
      });

      await publicClient?.waitForTransactionReceipt({ hash: mintTx });
      
      setFaucetTxHash((prev) => ({ ...prev, usdc: mintTx }));
    } catch (error: unknown) {
      console.error('Faucet USDC error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mint USDC';
      setFaucetStatus(errorMessage);
    } finally {
      setFaucetLoading(null);
    }
  };

  function handleCopyContractAddress() {
    navigator.clipboard.writeText(CONTRACTS.MOCK_USDC);
    setContractAddressCopied(true);
    setTimeout(() => setContractAddressCopied(false), 2000);
  }

  async function handleStake(attestationUID: string) {
    if (!walletClient || !publicClient || !address) return;
    
    // Prevent double-staking
    if (userStakes[attestationUID]) {
      setStatus('❌ You have already staked on this belief');
      return;
    }

    setLoadingBeliefId(attestationUID);
    setStatus('');
    setProgress(10);
    setProgressMessage('Checking balance...');

    try {
      // Check USDC balance first
      const balance = await publicClient.readContract({
        address: CONTRACTS.MOCK_USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (balance < STAKE_AMOUNT) {
        const balanceFormatted = (Number(balance) / 1_000_000).toFixed(2);
        setStatus(`❌ Insufficient USDC balance. You have $${balanceFormatted}, need $2.00. Click the "$" button to mint test USDC.`);
        setProgress(0);
        setProgressMessage('');
        setLoadingBeliefId(null);
        return;
      }

      // Step 1: Approve USDC
      setProgress(33);
      setProgressMessage('Approving USDC...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      const approveTx = await walletClient.writeContract({
        address: CONTRACTS.MOCK_USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.BELIEF_STAKE as `0x${string}`, STAKE_AMOUNT],
        chain: baseSepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Step 2: Stake
      setProgress(66);
      setProgressMessage('Staking $2...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      const stakeTx = await walletClient.writeContract({
        address: CONTRACTS.BELIEF_STAKE as `0x${string}`,
        abi: BELIEF_STAKE_WRITE_ABI,
        functionName: 'stake',
        args: [attestationUID as `0x${string}`],
        chain: baseSepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash: stakeTx });

      // Update user stakes state immediately so UI updates
      setUserStakes((prev) => ({ ...prev, [attestationUID]: true }));

      // Poll subgraph to wait for indexing
      setProgress(75);
      setProgressMessage('Reading transaction from latest block...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      const maxAttempts = 10;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const progressIncrement = (100 - 75) / maxAttempts;
        setProgress(75 + progressIncrement * (attempt + 1));
      }

      // Refresh beliefs and switch to Recent
      const fetchedBeliefs = await getBeliefs();
      setBeliefs(fetchedBeliefs);
      setSortOption('recent');

      setProgress(100);
      setProgressMessage('Staked!');

      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
        setLoadingBeliefId(null);
      }, 1000);
    } catch (error: unknown) {
      console.error('Stake error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Stake failed';
      setStatus(`❌ ${errorMessage}`);
      setProgress(0);
      setProgressMessage('');
      setLoadingBeliefId(null);
    }
  }

  async function handleUnstake(attestationUID: string) {
    if (!walletClient || !publicClient) return;
    
    // Prevent unstaking when no stake exists
    if (!userStakes[attestationUID]) {
      setStatus('❌ You do not have an active stake on this belief');
      return;
    }

    setLoadingBeliefId(attestationUID);
    setStatus('');
    setProgress(0);
    setProgressMessage('Unstaking...');
    
    try {
      // Ease to 50%
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for render
      setProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      const unstakeTx = await walletClient.writeContract({
        address: CONTRACTS.BELIEF_STAKE as `0x${string}`,
        abi: BELIEF_STAKE_WRITE_ABI,
        functionName: 'unstake',
        args: [attestationUID as `0x${string}`],
        chain: baseSepolia,
      });

      setProgress(75);
      setProgressMessage('Waiting for confirmation...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      await publicClient.waitForTransactionReceipt({ hash: unstakeTx });

      // Update user stakes state immediately so UI updates
      setUserStakes((prev) => ({ ...prev, [attestationUID]: false }));

      // Poll subgraph to wait for indexing
      setProgress(75);
      setProgressMessage('Reading transaction from latest block...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      const maxAttempts = 10;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const progressIncrement = (100 - 75) / maxAttempts;
        setProgress(75 + progressIncrement * (attempt + 1));
      }

      // Refresh beliefs and switch to Recent
      const fetchedBeliefs = await getBeliefs();
      setBeliefs(fetchedBeliefs);
      setSortOption('recent');

      setProgress(100);
      setProgressMessage('Unstaked!');

      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
        setLoadingBeliefId(null);
      }, 1000);
    } catch (error: unknown) {
      console.error('Unstake error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unstake failed';
      setStatus(`❌ ${errorMessage}`);
      setProgress(0);
      setProgressMessage('');
      setLoadingBeliefId(null);
    }
  }

  async function handleCreateAndStake() {
    if (!walletClient || !publicClient || !address) return;
    if (!belief.trim()) {
      setStatus('Please enter a belief');
      return;
    }

    setLoading(true);
    setStatus('');
    setProgress(5);
    setProgressMessage('Checking balance...');

    try {
      // Check USDC balance first
      const balance = await publicClient.readContract({
        address: CONTRACTS.MOCK_USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (balance < STAKE_AMOUNT) {
        const balanceFormatted = (Number(balance) / 1_000_000).toFixed(2);
        setStatus(`❌ Insufficient USDC balance. You have $${balanceFormatted}, need $2.00. Click the "$" button to mint test USDC.`);
        setProgress(0);
        setProgressMessage('');
        setLoading(false);
        return;
      }

      // Step 1: Create attestation
      setProgress(10);
      setProgressMessage('Creating attestation (TX 1 of 3)...');
      const encodedData = encodeAbiParameters(
        [{ name: 'belief', type: 'string' }],
        [belief]
      );

      const attestTx = await walletClient.writeContract({
        address: CONTRACTS.EAS_REGISTRY as `0x${string}`,
        abi: EAS_WRITE_ABI,
        functionName: 'attest',
        args: [
          {
            schema: CONTRACTS.BELIEF_SCHEMA_UID as `0x${string}`,
            data: {
              recipient:
                '0x0000000000000000000000000000000000000000' as `0x${string}`,
              expirationTime: 0n,
              revocable: false,
              refUID:
                '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
              data: encodedData,
              value: 0n,
            },
          },
        ],
        chain: baseSepolia,
      });

      setProgress(20);
      setProgressMessage('Confirming attestation...');

      const attestReceipt = await publicClient.waitForTransactionReceipt({
        hash: attestTx,
      });

      setProgress(30);

      // Parse attestation UID from the Attested event data
      const attestedLog = attestReceipt.logs[0];
      const decodedUid = decodeAbiParameters(
        [{ name: 'uid', type: 'bytes32' }],
        attestedLog.data as `0x${string}`
      );
      const attestationUID = decodedUid[0];
      if (!attestationUID) throw new Error('Failed to get attestation UID');

      // Step 2: Approve USDC
      setProgress(40);
      setProgressMessage('Approving USDC (TX 2 of 3)...');

      const approveTx = await walletClient.writeContract({
        address: CONTRACTS.MOCK_USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.BELIEF_STAKE as `0x${string}`, STAKE_AMOUNT],
        chain: baseSepolia,
      });

      setProgress(50);
      setProgressMessage('Confirming approval...');
      await publicClient.waitForTransactionReceipt({
        hash: approveTx,
        confirmations: 2,
      });

      // Step 3: Stake
      setProgress(60);
      setProgressMessage('Staking $2 (TX 3 of 3)...');

      const stakeTx = await walletClient.writeContract({
        address: CONTRACTS.BELIEF_STAKE as `0x${string}`,
        abi: BELIEF_STAKE_WRITE_ABI,
        functionName: 'stake',
        args: [attestationUID],
        chain: baseSepolia,
      });

      setProgress(70);
      setProgressMessage('Confirming stake...');
      await publicClient.waitForTransactionReceipt({ hash: stakeTx });

      // Poll subgraph for new belief
      setProgress(90);
      setProgressMessage('Reading transaction from latest block...');
      setBelief('');

      // Poll for the new attestation in subgraph
      const maxAttempts = 20;
      let attempts = 0;
      let found = false;

      while (attempts < maxAttempts && !found) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          const latestBeliefs = await getBeliefs();
          found = latestBeliefs.some((b) => b.id === attestationUID);

          if (found) {
            setProgress(100);
            setProgressMessage('Belief created!');
            setBeliefs(latestBeliefs);
            // Switch to Recent Beliefs to show the new belief at the top
            setSortOption('recent');
            setTimeout(() => {
              setProgress(0);
              setProgressMessage('');
            }, 2000);
            break;
          }
        } catch (error) {
          console.error('Error polling subgraph:', error);
        }

        attempts++;
        const progressIncrement = (99 - 90) / maxAttempts;
        setProgress(90 + progressIncrement * attempts);
      }

      if (!found) {
        setProgress(99);
        setProgressMessage('Almost there - refresh to see your belief');
      }
    } catch (error: unknown) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      setStatus(`❌ ${errorMessage}`);
      setProgress(0);
      setProgressMessage('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <>
            <Header onDollarClick={toggleFaucetModal} isInverted={showFaucetModal} />

            <div className="page">
              <main className="main">
              {showFaucetModal ? (
                <section className="faucet-modal">
                  <h1 className="headline">Free Fake Money<br />For Testing</h1>
                  
                  <p className="content">You need two things to test Believeth on Base Sepolia testnet:</p>
                  
                  <div className="faucet-section">
                    <p className="content">Base Sepolia ETH pays for gas fees. You need about 0.0005 ETH per belief (three transactions: approve, attest, stake).</p>
                    
                    <button 
                      className="btn btn-outline" 
                      onClick={handleFaucetETH(openConnectModal)}
                      disabled={faucetLoading === 'eth' || !!faucetTxHash.eth}
                    >
                      {faucetLoading === 'eth' 
                        ? 'Sending...' 
                        : faucetTxHash.eth 
                        ? (
                          <a 
                            href={`https://sepolia.basescan.org/tx/${faucetTxHash.eth}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            TX: {faucetTxHash.eth.slice(0, 6)}...
                          </a>
                        )
                        : 'Get 0.005 ETH'
                      }
                    </button>
                  </div>
                  
                  <div className="faucet-section">
                    <p className="content">USDC is used for staking. Each belief costs $2. This is testnet money with no real value.</p>
                    
                    <button 
                      className="btn btn-outline" 
                      onClick={handleFaucetUSDC(openConnectModal)}
                      disabled={faucetLoading === 'usdc' || !!faucetTxHash.usdc}
                    >
                      {faucetLoading === 'usdc' 
                        ? 'Minting...' 
                        : faucetTxHash.usdc 
                        ? (
                          <a 
                            href={`https://sepolia.basescan.org/tx/${faucetTxHash.usdc}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            TX: {faucetTxHash.usdc.slice(0, 6)}...
                          </a>
                        )
                        : 'Get 20 USDC'
                      }
                    </button>
                  </div>
                  
                  <div className="faucet-section">
                    <p className="content">
                      To see (fake) USDC in your wallet on the Base Sepolia network, add this custom token:{' '}
                      <span className="contract-address" onClick={handleCopyContractAddress}>
                        {CONTRACTS.MOCK_USDC}
                      </span>
                      {' '}
                      {contractAddressCopied ? 'Copied!' : '(click to copy)'}
                    </p>
                    <p className="content">In MetaMask: Assets → Import Tokens → Custom Token. Symbol: USDC, Decimals: 6</p>
                  </div>
                  
                                {faucetStatus && (
                                  <p className="status">{faucetStatus}</p>
                                )}
                </section>
              ) : (
                <>
                <h1 className="headline">
                  Costly Signals<br />Prove Conviction
                </h1>

                {!isConnected ? (
                <section className="hero">
                  <p className="content">
                    $2 says you mean it. The fact that it costs money to make a claim
                    shows that it is valuable to you and you&apos;re not just yapping. You have
                    conviction.
                  </p>

                  <div className="hero-input">
                    <textarea
                      className="belief-textarea"
                      value={belief}
                      onChange={(e) => setBelief(e.target.value)}
                      placeholder="about..."
                      maxLength={280}
                    />
                  </div>

                  <button 
                    className="btn btn-primary btn-disabled-style" 
                    onClick={openConnectModal}
                  >
                    Attest and Stake $2
                  </button>

                  <div className="hero-info">
                    <p className="content">
                      If you change your mind, unstake and take your money back.
                      There is no resolution, no reward. Just the fact that you said
                      it onchain, timestamped, verifiable forever.
                    </p>
                  </div>
                </section>
              ) : (
          <section className="compose">
            <p className="content">
              $2 says you mean it. The fact that it costs money to make a claim
              shows that it is valuable to you and you&apos;re not just yapping. You have
              conviction.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateAndStake();
              }}
            >
              <div className="compose-input">
                {textareaFocused && (
                  <div className="char-counter-top">{belief.length}/280</div>
                )}
                <textarea
                  ref={textareaRef}
                  className="belief-textarea"
                  value={belief}
                  onChange={(e) => setBelief(e.target.value)}
                  onFocus={() => setTextareaFocused(true)}
                  onBlur={() => setTextareaFocused(false)}
                  onPaste={(e) => {
                    const paste = e.clipboardData.getData('text');
                    if (belief.length + paste.length > 280) {
                      e.preventDefault();
                      const remaining = 280 - belief.length;
                      setBelief(belief + paste.slice(0, remaining));
                    }
                  }}
                  placeholder="about..."
                  disabled={loading}
                  rows={1}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !belief.trim()}
              >
                Attest and Stake $2
              </button>

              {loading && progress > 0 && (
                <ProgressBar progress={progress} message={progressMessage} />
              )}
              {!loading && status && <p className="status">{status}</p>}
            </form>

            <div className="compose-info">
              <p className="content">
                If you change your mind, unstake and take your money back.
                There is no resolution, no reward. Just the fact that you said
                it onchain, timestamped, verifiable forever.
              </p>
            </div>
          </section>
        )}

        <section className="beliefs">
          <div className="sort-dropdown">
            <button
              className="sort-button"
              onClick={() => setShowSortMenu(!showSortMenu)}
            >
              {sortOption === 'popular' && 'Popular Beliefs'}
              {sortOption === 'recent' && 'Recent Beliefs'}
              {sortOption === 'wallet' && address && `Connected Wallet ${truncateAddress(address)}`}
              <span className="dropdown-arrow">{showSortMenu ? '▲' : '▼'}</span>
            </button>
            {showSortMenu && (
              <ul className="sort-menu">
                <li>
                  <button
                    onClick={() => {
                      setSortOption('popular');
                      setShowSortMenu(false);
                    }}
                  >
                    Popular Beliefs
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setSortOption('recent');
                      setShowSortMenu(false);
                    }}
                  >
                    Recent Beliefs
                  </button>
                </li>
                {isConnected && address && (
                  <li>
                    <button
                      onClick={() => {
                        setSortOption('wallet');
                        setShowSortMenu(false);
                      }}
                    >
                      Connected Wallet {truncateAddress(address)}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          <ul className="beliefs-list">
            {displayedBeliefs.map((beliefItem) => {
              const totalStaked = BigInt(beliefItem.totalStaked || '0');
              const dollars = Number(totalStaked) / 1_000_000;
              const text =
                beliefTexts[beliefItem.id] || '[Test stake - no belief text]';
              const hasStaked = userStakes[beliefItem.id] || false;

              const isLoading = loadingBeliefId === beliefItem.id;

              return (
                <li key={beliefItem.id} className="belief-card">
                  <div className="belief-text">{text}</div>
                  <div className="belief-footer">
                    <div className="belief-amount">${Math.floor(dollars)}</div>
                    {hasStaked ? (
                      <button 
                        className="btn-stake"
                        onClick={() => handleUnstake(beliefItem.id)}
                        disabled={loading}
                      >
                        Unstake $2
                      </button>
                    ) : (
                      <button 
                        className="btn-stake"
                        onClick={() => {
                          if (!isConnected) {
                            openConnectModal();
                          } else {
                            handleStake(beliefItem.id);
                          }
                        }}
                        disabled={loading}
                      >
                        Stake $2
                      </button>
                    )}
                  </div>
                  {isLoading && progress > 0 && (
                    <div className="belief-progress">
                      <ProgressBar progress={progress} message={progressMessage} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {!loading && status && <p className="status">{status}</p>}
        </section>
        </>
      )}
      </main>
      </div>
          </>
        )}
      </ConnectButton.Custom>
    </>
  );
}
