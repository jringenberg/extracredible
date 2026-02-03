import { Attested as AttestedEvent } from "../generated/EAS/EAS"
import { EAS } from "../generated/EAS/EAS"
import { Belief } from "../generated/schema"
import { ethereum, BigInt } from "@graphprotocol/graph-ts"

// Your belief schema UID on Base Sepolia
const BELIEF_SCHEMA_UID = "0x21f7fcf4af0c022d3e7316b6a5b9a04dcaedac59eaea803251e653abd1db9fd6"

export function handleAttested(event: AttestedEvent): void {
  // Only process attestations using our belief schema
  if (event.params.schemaUID.toHexString() != BELIEF_SCHEMA_UID) {
    return
  }

  let beliefId = event.params.uid
  let belief = Belief.load(beliefId)
  
  if (belief == null) {
    belief = new Belief(beliefId)
    belief.totalStaked = BigInt.fromI32(0)
    belief.stakerCount = 0
    belief.createdAt = event.block.timestamp
  }
  
  // Fetch the full attestation data from EAS contract
  let easContract = EAS.bind(event.address)
  let attestation = easContract.getAttestation(event.params.uid)
  
  // Decode the attestation data (ABI-encoded string)
  // Schema is just "string belief", so decode as (string)
  let decoded = ethereum.decode('(string)', attestation.data)
  if (decoded) {
    let tuple = decoded.toTuple()
    belief.beliefText = tuple[0].toString()
  } else {
    belief.beliefText = "" // fallback if decode fails
  }
  
  belief.save()
}
