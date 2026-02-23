import { BeliefCreated as BeliefCreatedEvent } from "../generated/BeliefRouter/BeliefRouter"
import { Belief } from "../generated/schema"
import { BigInt } from "@graphprotocol/graph-ts"

const STAKE_AMOUNT = BigInt.fromI32(2000000)

/**
 * BeliefCreated fires after BeliefStakeV2.Staked in the same tx.
 * The belief-stake handler creates the Belief first; we fill in beliefText and attester.
 * If Belief doesn't exist (shouldn't happen), create it.
 */
export function handleBeliefCreated(event: BeliefCreatedEvent): void {
  let belief = Belief.load(event.params.attestationUID)
  if (belief == null) {
    belief = new Belief(event.params.attestationUID)
    belief.totalStaked = STAKE_AMOUNT
    belief.stakerCount = 1
    belief.createdAt = event.block.timestamp
    belief.lastStakedAt = event.block.timestamp
  }
  belief.beliefText = event.params.beliefText
  belief.attester = event.params.staker
  belief.save()
}
