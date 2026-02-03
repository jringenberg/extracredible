import {
  OwnershipTransferred as OwnershipTransferredEvent,
  Staked as StakedEvent,
  Unstaked as UnstakedEvent
} from "../generated/BeliefStake/BeliefStake"
import { Belief, Stake } from "../generated/schema"
import { Bytes } from "@graphprotocol/graph-ts"

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
}

export function handleStaked(event: StakedEvent): void {
  let beliefId = event.params.attestationUID
  let belief = Belief.load(beliefId)
  
  // Belief should already exist from EAS attestation
  // But handle gracefully if stake comes before attestation is indexed
  if (belief == null) {
    belief = new Belief(beliefId)
    belief.beliefText = "" // Will be filled by EAS handler when it processes
    belief.totalStaked = event.params.amount
    belief.stakerCount = 1
    belief.createdAt = event.params.timestamp
  } else {
    belief.totalStaked = belief.totalStaked.plus(event.params.amount)
    belief.stakerCount = belief.stakerCount + 1
  }

  let stakeId = beliefId.toHexString() + "-" + event.params.staker.toHexString()
  let stake = new Stake(stakeId)
  stake.belief = beliefId
  stake.staker = event.params.staker
  stake.amount = event.params.amount
  stake.stakedAt = event.params.timestamp
  stake.unstakedAt = null
  stake.active = true
  stake.transactionHash = event.transaction.hash

  belief.save()
  stake.save()
}

export function handleUnstaked(event: UnstakedEvent): void {
  let beliefId = event.params.attestationUID
  let belief = Belief.load(beliefId)
  if (belief == null) {
    return
  }

  let stakeId = beliefId.toHexString() + "-" + event.params.staker.toHexString()
  let stake = Stake.load(stakeId)
  if (stake == null) {
    return
  }

  stake.active = false
  stake.unstakedAt = event.block.timestamp

  belief.totalStaked = belief.totalStaked.minus(event.params.amount)
  if (belief.stakerCount > 0) {
    belief.stakerCount = belief.stakerCount - 1
  }

  belief.save()
  stake.save()
}
