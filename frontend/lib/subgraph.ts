const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

export type Belief = {
  id: string;
  beliefText: string;
  attester: string;
  totalStaked: string;
  stakerCount: number;
  createdAt: string;
  lastStakedAt: string;
};

async function subgraphFetch(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (json.errors) {
    console.error('[subgraph] errors:', json.errors);
  }
  if (json.data?._meta) {
    console.log('[subgraph] indexed block:', json.data._meta.block.number, '| errors:', json.data._meta.hasIndexingErrors);
  }
  return json;
}

export type Stake = {
  id: string;
  staker: string;
  amount: string;
  stakedAt: string;
  unstakedAt: string | null;
  active: boolean;
  transactionHash: string;
  belief?: Belief;
};

/**
 * Fetch all beliefs, sorted by total staked (descending)
 */
export async function getBeliefs(): Promise<Belief[]> {
  if (!SUBGRAPH_URL) {
    console.warn('SUBGRAPH_URL not configured');
    return [];
  }

  const query = `
    query GetBeliefs {
      beliefs(first: 100, where: { totalStaked_gt: "0" }, orderBy: totalStaked, orderDirection: desc) {
        id
        beliefText
        attester
        totalStaked
        stakerCount
        createdAt
        lastStakedAt
      }
      _meta { block { number } hasIndexingErrors }
    }
  `;

  try {
    const json = await subgraphFetch(query);
    return json.data?.beliefs || [];
  } catch (error) {
    console.error('Error fetching beliefs:', error);
    return [];
  }
}

/**
 * Fetch a single belief by its attestation UID
 */
export async function getBelief(uid: string): Promise<Belief | null> {
  if (!SUBGRAPH_URL) {
    console.warn('SUBGRAPH_URL not configured');
    return null;
  }

  const query = `
    query GetBelief($id: ID!) {
      belief(id: $id) {
        id
        beliefText
        attester
        totalStaked
        stakerCount
        createdAt
        lastStakedAt
      }
    }
  `;

  try {
    const json = await subgraphFetch(query, { id: uid });
    return json.data?.belief || null;
  } catch (error) {
    console.error('Error fetching belief:', error);
    return null;
  }
}

/**
 * Fetch all stakes for a specific belief
 */
export async function getBeliefStakes(beliefId: string): Promise<Stake[]> {
  if (!SUBGRAPH_URL) {
    console.warn('SUBGRAPH_URL not configured');
    return [];
  }

  const query = `
    query GetBeliefStakes($beliefId: String!) {
      stakes(where: { belief: $beliefId }, orderBy: stakedAt, orderDirection: asc) {
        id
        staker
        amount
        stakedAt
        unstakedAt
        active
        transactionHash
      }
    }
  `;

  try {
    const json = await subgraphFetch(query, { beliefId });
    return json.data?.stakes || [];
  } catch (error) {
    console.error('Error fetching belief stakes:', error);
    return [];
  }
}

/**
 * Fetch all active stakes for a specific address (for account page)
 */
export async function getAccountStakes(address: string): Promise<(Stake & { belief: Belief })[]> {
  if (!SUBGRAPH_URL) {
    console.warn('SUBGRAPH_URL not configured');
    return [];
  }

  const normalizedAddress = address.toLowerCase();

  const query = `
    query GetAccountStakes($staker: Bytes!) {
      stakes(where: { staker: $staker, active: true }, orderBy: stakedAt, orderDirection: desc) {
        id
        staker
        amount
        stakedAt
        unstakedAt
        active
        transactionHash
        belief {
          id
          beliefText
          attester
          totalStaked
          stakerCount
          createdAt
          lastStakedAt
        }
      }
    }
  `;

  try {
    const json = await subgraphFetch(query, { staker: normalizedAddress });
    return json.data?.stakes || [];
  } catch (error) {
    console.error('Error fetching account stakes:', error);
    return [];
  }
}
