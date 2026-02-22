export const CONTRACTS = {
  EAS_REGISTRY: '0x4200000000000000000000000000000000000021',
  BELIEF_SCHEMA_UID:
    '0x21f7fcf4af0c022d3e7316b6a5b9a04dcaedac59eaea803251e653abd1db9fd6',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  // V1 — kept for reading/displaying existing beliefs and staking on existing attestations
  BELIEF_STAKE: '0xaff45F0Fc8AF91B9D3A317d550307Efe0FFb7956',
  // V2 router — used for new belief creation (attest + stake in one tx)
  BELIEF_ROUTER: '0xC4E2A0d57801c65bf4f2bc1ee5f516d3b52545f4',
} as const;

export const BASE_RPC = 'https://mainnet.base.org';

// BeliefStake ABI - read functions
export const BELIEF_STAKE_ABI = [
  {
    inputs: [{ name: 'attestationUID', type: 'bytes32' }],
    name: 'getStakerCount',
    outputs: [{ name: 'count', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'attestationUID', type: 'bytes32' },
      { name: 'staker', type: 'address' },
    ],
    name: 'getStake',
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// EAS ABI for attest function
export const EAS_WRITE_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'schema', type: 'bytes32' },
          {
            components: [
              { name: 'recipient', type: 'address' },
              { name: 'expirationTime', type: 'uint64' },
              { name: 'revocable', type: 'bool' },
              { name: 'refUID', type: 'bytes32' },
              { name: 'data', type: 'bytes' },
              { name: 'value', type: 'uint256' },
            ],
            name: 'data',
            type: 'tuple',
          },
        ],
        name: 'request',
        type: 'tuple',
      },
    ],
    name: 'attest',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// BeliefStake write functions
export const BELIEF_STAKE_WRITE_ABI = [
  {
    inputs: [{ name: 'attestationUID', type: 'bytes32' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'attestationUID', type: 'bytes32' }],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ERC20 functions
export const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// BeliefRouter — single-tx belief creation for smart wallets
export const BELIEF_ROUTER_ABI = [
  {
    inputs: [{ name: 'beliefText', type: 'string' }],
    name: 'createAndStake',
    outputs: [{ name: 'uid', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export const STAKE_AMOUNT = 2_000_000n; // $2 USDC (6 decimals)

