import {
  OwnershipTransferred as OwnershipTransferredEvent,
  Staked as StakedEvent,
  Unstaked as UnstakedEvent
} from "../generated/BeliefStake/BeliefStake"
import { Belief, Stake } from "../generated/schema"

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
}

export function handleStaked(event: StakedEvent): void {
  let belief = Belief.load(event.params.attestationUID)
  if (belief == null) {
    belief = new Belief(event.params.attestationUID)
    belief.totalStaked = event.params.amount
    belief.stakerCount = 1
    belief.createdAt = event.params.timestamp
  } else {
    belief.totalStaked = belief.totalStaked.plus(event.params.amount)
    belief.stakerCount = belief.stakerCount + 1
  }

  let stakeId =
    event.params.attestationUID.toHexString() +
    "-" +
    event.params.staker.toHexString()
  let stake = new Stake(stakeId)
  stake.belief = belief.id
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
  let belief = Belief.load(event.params.attestationUID)
  if (belief == null) {
    return
  }

  let stakeId =
    event.params.attestationUID.toHexString() +
    "-" +
    event.params.staker.toHexString()
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
