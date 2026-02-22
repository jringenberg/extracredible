// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// -------------------------------------------------------------------------
// Minimal EAS interface — only what we need
// -------------------------------------------------------------------------

struct AttestationRequestData {
    address recipient;       // Recipient = the user who created the belief
    uint64 expirationTime;  // 0 = no expiry
    bool revocable;         // false per your schema
    bytes32 refUID;         // 0 = no reference
    bytes data;             // abi.encode(beliefText)
    uint256 value;          // 0 = no ETH
}

struct AttestationRequest {
    bytes32 schema;
    AttestationRequestData data;
}

interface IEAS {
    function attest(AttestationRequest calldata request) external payable returns (bytes32);
}

interface IBeliefStakeV2 {
    function stakeFor(bytes32 attestationUID, address staker) external;
}

// -------------------------------------------------------------------------

/**
 * @title BeliefRouter
 * @notice Single-transaction path for smart wallet users (Coinbase Wallet, etc.)
 *
 *         Flow:
 *           1. User pre-approves $2 USDC to this router (one-time or per-tx)
 *           2. User calls createAndStake(beliefText) — one transaction
 *           3. Router pulls USDC, calls EAS.attest(), gets UID back
 *           4. Router transfers USDC to BeliefStakeV2, calls stakeFor(uid, user)
 *           5. Stake is recorded under user's address, not the router's
 *
 *         EOA users can keep using BeliefStakeV2.stake() directly (or V1).
 */
contract BeliefRouter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant STAKE_AMOUNT = 2_000_000; // $2 USDC

    IERC20 public immutable usdc;
    IEAS public immutable eas;
    IBeliefStakeV2 public immutable beliefStake;

    /// @notice EAS schema UID for beliefs — set at deploy time
    bytes32 public immutable schemaUID;

    event BeliefCreated(
        bytes32 indexed attestationUID,
        address indexed staker,
        string beliefText
    );

    constructor(
        address _usdc,
        address _eas,
        address _beliefStake,
        bytes32 _schemaUID
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "BeliefRouter: invalid USDC");
        require(_eas != address(0), "BeliefRouter: invalid EAS");
        require(_beliefStake != address(0), "BeliefRouter: invalid BeliefStake");
        require(_schemaUID != bytes32(0), "BeliefRouter: invalid schema UID");

        usdc = IERC20(_usdc);
        eas = IEAS(_eas);
        beliefStake = IBeliefStakeV2(_beliefStake);
        schemaUID = _schemaUID;

        // Pre-approve BeliefStakeV2 to pull USDC from this router
        // (max approval — router holds no funds between calls, safe)
        IERC20(_usdc).approve(_beliefStake, type(uint256).max);
    }

    /**
     * @notice Create a belief attestation and stake $2 in one transaction.
     * @param beliefText The belief statement to attest and stake on.
     */
    function createAndStake(string calldata beliefText) external nonReentrant returns (bytes32 uid) {
        require(bytes(beliefText).length > 0, "BeliefRouter: empty belief");

        // 1. Pull USDC from user to this contract
        usdc.safeTransferFrom(msg.sender, address(this), STAKE_AMOUNT);

        // 2. Create EAS attestation — captures UID synchronously
        uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: msg.sender,
                    expirationTime: 0,
                    revocable: false,
                    refUID: bytes32(0),
                    data: abi.encode(beliefText),
                    value: 0
                })
            })
        );

        // 3. Stake on behalf of the actual user (USDC already in this contract,
        //    BeliefStakeV2 will pull it via the pre-approved allowance)
        beliefStake.stakeFor(uid, msg.sender);

        emit BeliefCreated(uid, msg.sender, beliefText);
    }
}
