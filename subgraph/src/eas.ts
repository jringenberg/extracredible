import { Attested as AttestedEvent } from "../generated/EAS/EAS"
import { EAS } from "../generated/EAS/EAS"
import { Belief } from "../generated/schema"
import { BigInt, Address, Bytes, ethereum } from "@graphprotocol/graph-ts"

const BELIEF_SCHEMA_UID = "0x21f7fcf4af0c022d3e7316b6a5b9a04dcaedac59eaea803251e653abd1db9fd6"

/**
 * Create Belief from EAS attestation. No RPC calls — decode belief text from tx calldata.
 */
export function handleAttested(event: AttestedEvent): void {
  if (event.params.schemaUID.toHexString() != BELIEF_SCHEMA_UID) {
    return
  }

  let beliefId = event.params.uid
  let belief = Belief.load(beliefId)
  if (belief != null) return

  belief = new Belief(beliefId)
  belief.beliefText = ""

  let easContract = EAS.bind(event.address)
  let attestationResult = easContract.try_getAttestation(event.params.uid)
  if (!attestationResult.reverted) {
    let decoded = ethereum.decode("string", attestationResult.value.data)
    belief.beliefText = decoded != null ? decoded.toString() : ""
  } else {
    belief.beliefText = ""
  }

  belief.attester = event.params.recipient.toHexString() == Address.zero().toHexString()
    ? event.params.attester
    : event.params.recipient
  belief.totalStaked = BigInt.fromI32(0)
  belief.stakerCount = 0
  belief.createdAt = event.block.timestamp
  belief.lastStakedAt = event.block.timestamp
  belief.save()
}
