// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BeliefStakeV2} from "../contracts/BeliefStakeV2.sol";
import {BeliefRouter} from "../contracts/BeliefRouter.sol";

/**
 * @title DeployRouter
 * @notice Deploys a new BeliefRouter and wires it into the existing BeliefStakeV2
 *         via BeliefStakeV2.setRouter(). Use this when only the router needs to change.
 *
 * Usage:
 *   forge script scripts/DeployRouter.s.sol \
 *     --rpc-url https://mainnet.base.org \
 *     --account testnet \
 *     --sender 0x7A7798cdc11cCeFDaa5aA7b07bb076280a4e4c3F \
 *     --broadcast
 */
contract DeployRouter is Script {
    // Existing mainnet deployments
    address constant BELIEF_STAKE_V2 = 0x4A26D06EA005Bd18f38fBa19D06612566A98f502;
    address constant BASE_MAINNET_USDC       = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant BASE_MAINNET_EAS        = 0x4200000000000000000000000000000000000021;
    bytes32 constant BASE_MAINNET_SCHEMA_UID = 0x21f7fcf4af0c022d3e7316b6a5b9a04dcaedac59eaea803251e653abd1db9fd6;

    function run() external {
        uint256 pk       = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pk != 0 ? vm.addr(pk) : msg.sender;

        console2.log("=== DeployRouter ===");
        console2.log("Chain ID:       ", block.chainid);
        console2.log("Deployer:       ", deployer);
        console2.log("BeliefStakeV2:  ", BELIEF_STAKE_V2);
        console2.log("");

        if (pk != 0) { vm.startBroadcast(pk); } else { vm.startBroadcast(); }

        // Deploy new BeliefRouter pointing to the existing BeliefStakeV2.
        // Constructor automatically max-approves V2 to pull USDC from the router.
        BeliefRouter router = new BeliefRouter(
            BASE_MAINNET_USDC,
            BASE_MAINNET_EAS,
            BELIEF_STAKE_V2,
            BASE_MAINNET_SCHEMA_UID
        );
        console2.log("BeliefRouter deployed: ", address(router));

        // Wire the existing BeliefStakeV2 to accept calls from the new router.
        BeliefStakeV2(BELIEF_STAKE_V2).setRouter(address(router));
        console2.log("BeliefStakeV2.router updated to: ", address(router));

        vm.stopBroadcast();

        // Sanity checks
        require(BeliefStakeV2(BELIEF_STAKE_V2).router() == address(router), "router mismatch");
        require(address(router.beliefStake()) == BELIEF_STAKE_V2, "beliefStake mismatch");
        require(router.schemaUID() == BASE_MAINNET_SCHEMA_UID, "schemaUID mismatch");

        console2.log("");
        console2.log("=== Deployment complete ===");
        console2.log("BeliefStakeV2:  ", BELIEF_STAKE_V2);
        console2.log("BeliefRouter:   ", address(router));
        console2.log("");
        console2.log("Update frontend CONTRACTS.BELIEF_ROUTER to:", address(router));
    }
}
