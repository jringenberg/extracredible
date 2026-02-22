'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectButton } from './ConnectButton';
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { base } from 'wagmi/chains';
import { publicClient } from '@/lib/client';
import { getBeliefs, getBeliefStakes, getAccountStakes, getBelief } from '@/lib/subgraph';
import { ProgressBar } from './ProgressBar';
import Link from 'next/link';
import { AddressDisplay, AddressDisplayWhenVisible } from '@/components/AddressDisplay';
import { useDisplayName } from '@/hooks/useDisplayName';
import { BeliefCard } from '@/components/BeliefCard';
import {
  CONTRACTS,
  BELIEF_ROUTER_ABI,
  BELIEF_STAKE_ABI,
  BELIEF_STAKE_WRITE_ABI,
  ERC20_ABI,
  STAKE_AMOUNT,
} from '@/lib/contracts';

function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...`;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
function isZeroOrEmpty(addr: string | undefined): boolean {
  return !addr || addr.toLowerCase() === ZERO_ADDRESS;
}

/** Total time only (no "ago"). fullLabels: MINUTES/HOURS for creation; false = MIN/HR for compact (e.g. stake rows) */
function formatTime(timestamp: string, fullLabels = false): string {
  const now = Date.now();
  const then = parseInt(timestamp) * 1000;
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (fullLabels) {
    if (minutes === 1) return '1 MINUTE';
    if (minutes < 60) return `${minutes} MINUTES`;
    if (hours === 1) return '1 HOUR';
    if (hours < 24) return `${hours} HOURS`;
    if (days === 1) return '1 DAY';
    if (days < 30) return `${days} DAYS`;
    const months = Math.floor(days / 30);
    if (months === 1) return '1 MONTH';
    if (months < 12) return `${months} MONTHS`;
    const years = Math.floor(days / 365);
    if (years === 1) return '1 YEAR';
    return `${years} YEARS`;
  }
  if (minutes === 1) return '1 MIN';
  if (minutes < 60) return `${minutes} MIN`;
  if (hours === 1) return '1 HR';
  if (hours < 24) return `${hours} HR`;
  if (days === 1) return '1 DAY';
  if (days < 30) return `${days} DAYS`;

  const months = Math.floor(days / 30);
  if (months === 1) return '1 MONTH';
  if (months < 12) return `${months} MONTHS`;

  const years = Math.floor(days / 365);
  if (years === 1) return '1 YEAR';
  return `${years} YEARS`;
}

function formatTxHash(hash: string): string {
  if (!hash) return '';
  return `${hash.slice(0, 6)}...`;
}

/** Normalize tx hash: some wallets return 64 hex chars without 0x prefix */
function normalizeTxHash(hash: string | undefined): `0x${string}` {
  if (!hash || typeof hash !== 'string') throw new Error('No transaction hash received');
  const raw = hash.startsWith('0x') ? hash.slice(2) : hash;
  if (raw.length !== 64 || !/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`Invalid transaction hash: ${hash} (length: ${hash.length})`);
  }
  return `0x${raw}` as `0x${string}`;
}

/** Convert raw viem/contract errors into short, user-friendly messages */
function friendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('user rejected') || msg.includes('User rejected') || msg.includes('User denied')) {
    return 'Transaction cancelled.';
  }
  if (msg.includes('Cannot decode zero data') || msg.includes('returned no data')) {
    return 'Contract not available — please make sure your wallet is on Base.';
  }
  if (msg.includes('Insufficient') || msg.includes('insufficient funds')) {
    return 'Insufficient funds for gas. Use the "$" button to get testnet ETH.';
  }
  if (msg.includes('network') || msg.includes('provider') || msg.includes('timeout') || msg.includes('connection') || msg.includes('disconnected')) {
    return 'Network error. Try disconnecting and reconnecting your wallet.';
  }
  if (msg.includes('chain') || msg.includes('Chain')) {
    return 'Wrong network — please switch to Base.';
  }

  // Truncate raw errors so users don't see a wall of text
  const firstLine = msg.split('\n')[0];
  return firstLine.length > 120 ? firstLine.slice(0, 120) + '…' : firstLine;
}

export type SortOption = 'popular' | 'recent' | 'wallet' | 'account' | 'belief';

export interface HomeContentProps {
  initialSort?: SortOption;
  filterValue?: string;
}

export function HomeContent({ initialSort = 'popular', filterValue }: HomeContentProps) {
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const { switchChain } = useSwitchChain();
  const { login: openConnectModal } = usePrivy();

  // Auto-switch to Base when connected on wrong chain
  useEffect(() => {
    if (isConnected && chain && chain.id !== base.id) {
      switchChain({ chainId: base.id });
    }
  }, [isConnected, chain, switchChain]);

  const [belief, setBelief] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [beliefs, setBeliefs] = useState<
    Array<{
      id: string;
      beliefText: string;
      attester: string;
      totalStaked: string;
      stakerCount: number;
      createdAt: string;
      lastStakedAt: string;
    }>
  >([]);
  const [sortOption, setSortOption] = useState<SortOption>(initialSort);
  const [userStakes, setUserStakes] = useState<Record<string, boolean>>({});
  const [userStakeV2, setUserStakeV2] = useState<Record<string, boolean>>({});
  const [loadingBeliefId, setLoadingBeliefId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  
  // Memoize the modal toggle to prevent unnecessary re-renders
  const toggleFaucetModal = useCallback(() => {
    setShowFaucetModal(prev => !prev);
  }, []);
  const [faucetLoading, setFaucetLoading] = useState<'eth' | 'usdc' | null>(null);
  const [faucetStatus, setFaucetStatus] = useState('');
  const [faucetTxHash, setFaucetTxHash] = useState<{ eth?: string; usdc?: string }>({});
  const [contractAddressCopied, setContractAddressCopied] = useState(false);
  const [leftColOpen, setLeftColOpen] = useState(true);
  const [openBeliefDetails, setOpenBeliefDetails] = useState<Record<string, boolean>>({});
  const [beliefStakes, setBeliefStakes] = useState<Record<string, Array<{
    staker: string;
    amount: string;
    timestamp: string;
    transactionHash: string;
  }>>>({});

  const filterAddress = sortOption === 'wallet' ? address ?? undefined : sortOption === 'account' ? filterValue : undefined;
  const { ensName: filterEnsName } = useDisplayName(filterAddress);

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




  // Track which belief IDs belong to a filtered account view
  const [accountBeliefIds, setAccountBeliefIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchBeliefs() {
      try {
        const fetchedBeliefs = await getBeliefs();
        setBeliefs(fetchedBeliefs);

        // For 'account' sort, also fetch that address's stakes and merge beliefs
        if (initialSort === 'account' && filterValue) {
          const accountStakes = await getAccountStakes(filterValue);
          const accountBeliefs = accountStakes.map(s => s.belief);
          const accountIds = new Set(accountBeliefs.map(b => b.id));
          setAccountBeliefIds(accountIds);

          // Merge any beliefs not already in the main list
          const existingIds = new Set(fetchedBeliefs.map(b => b.id));
          const newBeliefs = accountBeliefs.filter(b => !existingIds.has(b.id));
          if (newBeliefs.length > 0) {
            setBeliefs(prev => [...prev, ...newBeliefs]);
          }
        }

        // For 'belief' sort, ensure the specific belief is in the list
        if (initialSort === 'belief' && filterValue) {
          const existingIds = new Set(fetchedBeliefs.map(b => b.id));
          if (!existingIds.has(filterValue)) {
            const singleBelief = await getBelief(filterValue);
            if (singleBelief) {
              setBeliefs(prev => [...prev, singleBelief]);
            }
          }
        }

        // Eagerly fetch stakes for beliefs with a zero/missing attester so we can
        // display the first staker as a fallback without waiting for detail open.
        const zeroAttesterBeliefs = fetchedBeliefs.filter(b => isZeroOrEmpty(b.attester));
        if (zeroAttesterBeliefs.length > 0) {
          const stakeFetches = await Promise.all(
            zeroAttesterBeliefs.map(async (b) => {
              const stakes = await getBeliefStakes(b.id);
              return {
                id: b.id,
                stakes: stakes.map(s => ({
                  staker: s.staker,
                  amount: s.amount,
                  timestamp: s.stakedAt,
                  transactionHash: s.transactionHash,
                })),
              };
            })
          );
          setBeliefStakes(prev => ({
            ...prev,
            ...Object.fromEntries(stakeFetches.map(({ id, stakes }) => [id, stakes])),
          }));
        }
      } catch (error) {
        console.error('Error fetching beliefs:', error);
      }
    }

    fetchBeliefs();
  }, [initialSort, filterValue]);

  // Reset to "popular" if user disconnects while on "wallet" filter
  useEffect(() => {
    if (!isConnected && sortOption === 'wallet') {
      setSortOption('popular');
    }
  }, [isConnected, sortOption]);

  // Filter and sort beliefs based on selected option
  const displayedBeliefs = beliefs.filter((b) => {
    if (sortOption === 'popular' || sortOption === 'recent') {
      return BigInt(b.totalStaked || '0') > 0n;
    }
    if (sortOption === 'wallet' && address) {
      return userStakes[b.id] === true;
    }
    if (sortOption === 'account' && filterValue) {
      return accountBeliefIds.has(b.id);
    }
    if (sortOption === 'belief' && filterValue) {
      return b.id === filterValue;
    }
    return false;
  }).sort((a, b) => {
    if (sortOption === 'popular') {
      return Number(BigInt(b.totalStaked || '0') - BigInt(a.totalStaked || '0'));
    } else if (sortOption === 'recent') {
      return Number(b.lastStakedAt) - Number(a.lastStakedAt);
    }
    return 0;
  });

  // beliefText now comes from subgraph - no need to fetch separately

  // Check which beliefs the user has staked on (V1 and V2 in parallel)
  useEffect(() => {
    async function checkUserStakes() {
      if (!address || beliefs.length === 0) return;

      try {
        const stakeChecks = await Promise.all(
          beliefs.map(async (belief) => {
            const getAmount = async (contractAddress: string) => {
              try {
                const result = await publicClient.readContract({
                  address: contractAddress as `0x${string}`,
                  abi: BELIEF_STAKE_ABI,
                  functionName: 'getStake',
                  args: [belief.id as `0x${string}`, address],
                });
                return (result as [bigint, bigint])[0];
              } catch {
                return 0n;
              }
            };

            const [v1Amount, v2Amount] = await Promise.all([
              getAmount(CONTRACTS.BELIEF_STAKE),
              getAmount(CONTRACTS.BELIEF_STAKE_V2),
            ]);

            return { id: belief.id, v1: v1Amount > 0n, v2: v2Amount > 0n };
          })
        );

        // Merge with existing state to preserve optimistic updates
        setUserStakes((prev) => ({ ...prev, ...Object.fromEntries(stakeChecks.map((s) => [s.id, s.v1])) }));
        setUserStakeV2((prev) => ({ ...prev, ...Object.fromEntries(stakeChecks.map((s) => [s.id, s.v2])) }));
      } catch (error) {
        console.error('Error checking user stakes:', error);
      }
    }

    checkUserStakes();
  }, [beliefs, address]);

  const handleFaucetETH = async () => {
    if (!address) {
      openConnectModal();
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
  
  const handleFaucetUSDC = async () => {
    if (!walletClient || !address) {
      openConnectModal();
      return;
    }
    
    setFaucetLoading('usdc');
    setFaucetStatus('');
    
    try {
      const mintTx = await walletClient.writeContract({
        address: CONTRACTS.USDC as `0x${string}`,
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
        chain: base,
      });

      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      setFaucetTxHash((prev) => ({ ...prev, usdc: mintTx }));
    } catch (error: unknown) {
      console.error('Faucet USDC error:', error);
      setFaucetStatus(friendlyError(error));
    } finally {
      setFaucetLoading(null);
    }
  };

  function handleCopyContractAddress() {
    navigator.clipboard.writeText(CONTRACTS.USDC);
    setContractAddressCopied(true);
    setTimeout(() => setContractAddressCopied(false), 2000);
  }


  async function toggleBeliefDetails(beliefId: string) {
    const isCurrentlyOpen = openBeliefDetails[beliefId];
    
    // Toggle open state
    setOpenBeliefDetails(prev => ({
      ...prev,
      [beliefId]: !isCurrentlyOpen
    }));
    
    // If opening and we don't have stakes data yet, fetch it
    if (!isCurrentlyOpen && !beliefStakes[beliefId]) {
      try {
        const stakes = await getBeliefStakes(beliefId);
        setBeliefStakes(prev => ({
          ...prev,
          [beliefId]: stakes.map(stake => ({
            staker: stake.staker,
            amount: stake.amount,
            timestamp: stake.stakedAt,
            transactionHash: stake.transactionHash
          }))
        }));
      } catch (error) {
        console.error('Error fetching belief stakes:', error);
      }
    }
  }

  async function handleStake(attestationUID: string) {
    if (!address) {
      openConnectModal();
      return;
    }
    if (!walletClient) {
      if (!chain || chain.id !== base.id) {
        switchChain({ chainId: base.id });
        setStatus('⚠️ Switching to Base — please try again.');
      } else {
        setStatus('⚠️ Wallet is connecting, please try again in a moment.');
      }
      return;
    }
    
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
        address: CONTRACTS.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (balance < STAKE_AMOUNT) {
        const balanceFormatted = (Number(balance) / 1_000_000).toFixed(2);
        setStatus(`❌ Insufficient USDC balance. You have $${balanceFormatted}, need $2.00.`);
        setProgress(0);
        setProgressMessage('');
        setLoadingBeliefId(null);
        return;
      }

      // Step 1: Approve USDC
      setProgress(33);
      setProgressMessage('Approving USDC (TX 1 of 2)...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      const approveTx = await walletClient.writeContract({
        address: CONTRACTS.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.BELIEF_STAKE as `0x${string}`, STAKE_AMOUNT],
        chain: base,
      });

      const approveHash = normalizeTxHash(approveTx);
      setProgressMessage('Confirming approval...');
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2: Stake
      setProgress(66);
      setProgressMessage('Staking $2 (TX 2 of 2)...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      const stakeTx = await walletClient.writeContract({
        address: CONTRACTS.BELIEF_STAKE as `0x${string}`,
        abi: BELIEF_STAKE_WRITE_ABI,
        functionName: 'stake',
        args: [attestationUID as `0x${string}`],
        chain: base,
      });

      const stakeHash = normalizeTxHash(stakeTx);
      setProgressMessage('Confirming stake...');
      await publicClient.waitForTransactionReceipt({ hash: stakeHash });

      // Update user stakes state immediately so UI updates
      setUserStakes((prev) => ({ ...prev, [attestationUID]: true }));

      // Poll subgraph to wait for indexing
      setProgress(75);
      setProgressMessage('Refreshing to latest block...');
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
      setStatus(`❌ ${friendlyError(error)}`);
      setProgress(0);
      setProgressMessage('');
      setLoadingBeliefId(null);
    }
  }

  async function handleUnstake(attestationUID: string) {
    if (!walletClient) {
      if (!chain || chain.id !== base.id) {
        switchChain({ chainId: base.id });
        setStatus('⚠️ Switching to Base — please try again.');
      } else {
        setStatus('⚠️ Wallet is connecting, please try again in a moment.');
      }
      return;
    }
    
    // Prevent unstaking when no stake exists in either contract
    const isV2Stake = userStakeV2[attestationUID] || false;
    if (!userStakes[attestationUID] && !isV2Stake) {
      setStatus('❌ You do not have an active stake on this belief');
      return;
    }

    setLoadingBeliefId(attestationUID);
    setStatus('');
    setProgress(0);
    setProgressMessage('Unstaking...');

    try {
      // Animate from 0% to 50% over 2s
      await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay for render
      setProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation complete

      // Route to V2 (BeliefStakeV2) for router-created beliefs, V1 otherwise
      const stakeContract = isV2Stake ? CONTRACTS.BELIEF_STAKE_V2 : CONTRACTS.BELIEF_STAKE;
      const unstakeTx = await walletClient.writeContract({
        address: stakeContract as `0x${string}`,
        abi: BELIEF_STAKE_WRITE_ABI,
        functionName: 'unstake',
        args: [attestationUID as `0x${string}`],
        chain: base,
      });

      const unstakeHash = normalizeTxHash(unstakeTx);
      setProgress(75);
      setProgressMessage('Waiting for confirmation...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Let animation play

      await publicClient.waitForTransactionReceipt({ hash: unstakeHash });

      // Clear the correct stake map immediately so UI updates
      if (isV2Stake) {
        setUserStakeV2((prev) => ({ ...prev, [attestationUID]: false }));
      } else {
        setUserStakes((prev) => ({ ...prev, [attestationUID]: false }));
      }

      // Poll subgraph to wait for indexing
      setProgress(75);
      setProgressMessage('Refreshing to latest block...');
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
      setStatus(`❌ ${friendlyError(error)}`);
      setProgress(0);
      setProgressMessage('');
      setLoadingBeliefId(null);
    }
  }

  async function handleCreateAndStake() {
    if (!address) {
      openConnectModal();
      return;
    }
    if (!walletClient) {
      if (!chain || chain.id !== base.id) {
        switchChain({ chainId: base.id });
        setStatus('⚠️ Switching to Base — please try again.');
      } else {
        setStatus('⚠️ Wallet is connecting, please try again in a moment.');
      }
      return;
    }
    
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
        address: CONTRACTS.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (balance < STAKE_AMOUNT) {
        const balanceFormatted = (Number(balance) / 1_000_000).toFixed(2);
        setStatus(`❌ Insufficient USDC balance. You have $${balanceFormatted}, need $2.00.`);
        setProgress(0);
        setProgressMessage('');
        setLoading(false);
        return;
      }

      // Step 1: Approve USDC to BeliefRouter
      setProgress(10);
      setProgressMessage('Approving USDC (TX 1 of 2)...');

      const approveTx = await walletClient.writeContract({
        address: CONTRACTS.USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.BELIEF_ROUTER as `0x${string}`, STAKE_AMOUNT],
        chain: base,
      });

      setProgress(25);
      setProgressMessage('Confirming approval...');
      const approveHash = normalizeTxHash(approveTx);
      await publicClient.waitForTransactionReceipt({
        hash: approveHash,
        confirmations: 2,
      });

      // Step 2: BeliefRouter.createAndStake — attest + stake in one transaction
      setProgress(40);
      setProgressMessage('Creating belief and staking $2 (TX 2 of 2)...');

      const routerTx = await walletClient.writeContract({
        address: CONTRACTS.BELIEF_ROUTER as `0x${string}`,
        abi: BELIEF_ROUTER_ABI,
        functionName: 'createAndStake',
        args: [belief, address as `0x${string}`],
        chain: base,
      });

      setProgress(60);
      setProgressMessage('Confirming...');
      const routerHash = normalizeTxHash(routerTx);
      const routerReceipt = await publicClient.waitForTransactionReceipt({ hash: routerHash });

      // Extract attestation UID from the BeliefCreated event (attestationUID is topics[1])
      const routerLog = routerReceipt.logs.find(
        (log) => log.address.toLowerCase() === CONTRACTS.BELIEF_ROUTER.toLowerCase()
      );
      const attestationUID = routerLog?.topics[1] as `0x${string}` | undefined;
      if (!attestationUID) throw new Error('Failed to get attestation UID from router');

      // Poll subgraph for new belief
      setProgress(90);
      setProgressMessage('Refreshing to latest block...');
      setBelief('');

      // Poll for the new attestation in subgraph
      const maxAttempts = 20;
      let attempts = 0;
      let found = false;

      while (attempts < maxAttempts && !found) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          const latestBeliefs = await getBeliefs();
          found = latestBeliefs.some((b) => b.id === attestationUID && BigInt(b.totalStaked || '0') > 0n);

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
      setStatus(`❌ ${friendlyError(error)}`);
      setProgress(0);
      setProgressMessage('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button 
        className={`dollar-button nav-fixed nav-left ${showFaucetModal ? 'inverted' : ''}`}
        onClick={toggleFaucetModal}
        title="Get test funds"
      >
        $
      </button>
      <div className="nav-fixed nav-right">
        <ConnectButton />
      </div>

            <div className="page">
              <main className="main">
                <div className="two-col">
                <div className="col-left">
                <div className="col-left-fixed">
                  <h1 className="col-title">
                    Extracredible
                    {!showFaucetModal && (
                      <button
                        type="button"
                        className="col-left-toggle"
                        onClick={() => setLeftColOpen(prev => !prev)}
                      >
                        [{leftColOpen ? 'hide' : 'show'}]
                      </button>
                    )}
                  </h1>
                <div className={`col-left-body${leftColOpen || showFaucetModal ? '' : ' collapsed'}`}>
                {showFaucetModal ? (
                <section className="hero hero-info-view">
                  <p className="content">
                    Built on Base using Ethereum Attestation Service for immutable belief records, The Graph for indexing, and Privy for wallet connectivity. Money Legos stacked together into a lightweight utility. Your deposit sits in a simple escrow contract (view on <a href={`https://basescan.org/address/${CONTRACTS.BELIEF_STAKE}`} target="_blank" rel="noopener noreferrer">Basescan</a>) and you can pull it out anytime.
                  </p>
                  <p className="content">
                    As spam and slop become indistinguishable from human expression, verified statements backed by real cost (even just a little) signal additional (extra) credibility. Extracredible is the smallest, simplest, most narrow expression of that. Staking 2 USDC on a public statement gives it weight. 
                  </p>
                </section>
                ) : !isConnected ? (
                <section className="hero">
                  <p className="content">
                    Staking money on a statement makes it more believable. Even $2 proves conviction. Anyone can say anything online, but a costly signal carries sincerity. $2 says you mean it.
                  </p>

                  <div className="hero-input compose-input">
                    <textarea
                      className="belief-textarea"
                      value={belief}
                      onChange={(e) => setBelief(e.target.value)}
                      placeholder="State your claim, belief, prediction, commitment..."
                      maxLength={550}
                    />
                    {belief.length > 0 && <div className="char-counter">{belief.length}/550</div>}
                  </div>

                  <button
                    type="button"
                    className="btn-cta btn-cta--create"
                    disabled
                  >
                    Attest and Stake $2
                  </button>

                  <div className="hero-info">
                    <p className="content">
                      Unstake and get your money back. No loss, no reward. Just the record of your words onchain, timestamped and verified.
                    </p>
                  </div>
                </section>
              ) : (
          <section className="compose">
            <p className="content">
              Staking money on a statement makes it more believable. Even $2 proves conviction. Anyone can say anything online, but a costly signal carries sincerity. $2 says you mean it.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateAndStake();
              }}
            >
              <div className="compose-input">
                <textarea
                  ref={textareaRef}
                  className="belief-textarea"
                  value={belief}
                  onChange={(e) => setBelief(e.target.value)}
                  onPaste={(e) => {
                    const paste = e.clipboardData.getData('text');
                    if (belief.length + paste.length > 550) {
                      e.preventDefault();
                      const remaining = 550 - belief.length;
                      setBelief(belief + paste.slice(0, remaining));
                    }
                  }}
                  placeholder="State your claim, belief, prediction, commitment..."
                  maxLength={550}
                  disabled={loading}
                  rows={1}
                />
                {belief.length > 0 && <div className="char-counter">{belief.length}/550</div>}
              </div>

              <button
                type="submit"
                className="btn-cta btn-cta--create"
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
                Unstake and get your money back. No loss, no reward. Just the record of your words onchain, timestamped and verified.
              </p>
            </div>
          </section>
        )}
        </div>
        </div>
        </div>

        <div className="col-right">
          {!showFaucetModal && (
          <div className="col-right-inner">
          <div className="col-right-header">
              <h2 className="col-title">
                <span className="sort-controls">
                  <span className="sort-trigger btn-cta btn-cta--sort" aria-hidden="true">
                    <svg className="sort-filter-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className="sort-label">
                    {sortOption === 'popular' && 'Popular Beliefs'}
                    {sortOption === 'recent' && 'Recent Beliefs'}
                    {sortOption === 'wallet' && address && (
                      filterEnsName ? filterEnsName : `WALLET ${truncateAddress(address)}`
                    )}
                    {sortOption === 'account' && filterValue && (
                      filterEnsName ? filterEnsName : `WALLET ${truncateAddress(filterValue)}`
                    )}
                    {sortOption === 'belief' && filterValue && (
                      `BELIEF ${truncateAddress(filterValue)}`
                    )}
                  </span>
                  <select
                    id="belief-sort-select"
                    className="sort-native"
                    value={sortOption}
                    onChange={(e) => {
                      setSortOption(e.target.value as SortOption);
                    }}
                  >
                    <option value="popular">Popular Beliefs</option>
                    <option value="recent">Recent Beliefs</option>
                    {isConnected && address && (
                      <option value="wallet">My Wallet ({truncateAddress(address)})</option>
                    )}
                    {sortOption === 'account' && filterValue && (
                      <option value="account">Wallet ({truncateAddress(filterValue)})</option>
                    )}
                    {sortOption === 'belief' && filterValue && (
                      <option value="belief">Belief ({truncateAddress(filterValue)})</option>
                    )}
                  </select>
                </span>
              </h2>
          </div>
        <section className="beliefs">
          <ul className="beliefs-list">
            {displayedBeliefs.map((beliefItem) => {
              const totalStaked = BigInt(beliefItem.totalStaked || '0');
              const dollars = Number(totalStaked) / 1_000_000;
              const text = beliefItem.beliefText || '[No belief text]';
              const hasStaked = userStakes[beliefItem.id] || userStakeV2[beliefItem.id] || false;

              const isLoading = loadingBeliefId === beliefItem.id;

              const isDetailsOpen = openBeliefDetails[beliefItem.id] || false;
              const stakes = beliefStakes[beliefItem.id] || [];

              // If attester is zero/missing, fall back to the first staker
              const displayAttester = isZeroOrEmpty(beliefItem.attester)
                ? (stakes[0]?.staker ?? beliefItem.attester)
                : beliefItem.attester;

              return (
                <li key={beliefItem.id} className="belief-card">
                  <div className="belief-card-inner">
                    <div className="belief-card-square">
                      <BeliefCard text={text} />
                    </div>
                    <div className="belief-details-panel">
                      <div className="belief-detail-row">
                        <span className="belief-detail-line">
                          <AddressDisplayWhenVisible address={displayAttester as `0x${string}`} linkToAccount />
                        </span>
                        <span className="belief-detail-line belief-detail-line--right">
                          {formatTime(beliefItem.createdAt, true)}
                        </span>
                      </div>
                      <div className="belief-detail-row">
                        <div className="belief-detail-block">
                          <button
                            type="button"
                            className="belief-detail-link"
                            onClick={() => toggleBeliefDetails(beliefItem.id)}
                          >
                            ${Math.floor(dollars)} total staked
                          </button>
                          {isDetailsOpen && stakes.length > 0 && (
                            <ul className="belief-stakes-list">
                              {stakes.map((stake, index) => (
                                <li key={index} className="belief-stake-row">
                                  <span className="stake-prefix"> + </span>
                                  <span className="stake-amount">$2</span>
                                  <span className="stake-time">
                                    <a
                                      href={`https://basescan.org/tx/${stake.transactionHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="belief-detail-link"
                                    >
                                      {formatTime(stake.timestamp)}
                                    </a>
                                  </span>
                                  <span className="stake-address">
                                    <AddressDisplay address={stake.staker} linkToAccount />
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <span className="belief-detail-line belief-detail-line--right">
                          {hasStaked ? (
                            <button
                              type="button"
                              className="belief-detail-link"
                              onClick={() => handleUnstake(beliefItem.id)}
                              disabled={loading}
                            >
                              Unstake $2
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="belief-detail-link"
                              onClick={() => {
                                if (!isConnected) {
                                  openConnectModal();
                                } else {
                                  handleStake(beliefItem.id);
                                }
                              }}
                              disabled={loading}
                            >
                              ADD YOUR $2
                            </button>
                          )}
                        </span>
                      </div>
                    </div>
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
          </div>
          )}
        </div>
        </div>
      </main>
      </div>
    </>
  );
}

export default function Home() {
  return <HomeContent />;
}
