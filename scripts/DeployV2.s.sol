// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BeliefStakeV2} from "../contracts/BeliefStakeV2.sol";
import {BeliefRouter} from "../contracts/BeliefRouter.sol";

/**
 * @title DeployV2
 * @notice Deploys BeliefStakeV2 + BeliefRouter and wires them together.
 *
 * @dev Circular dependency resolution:
 *      - BeliefStakeV2 constructor needs the router address
 *      - BeliefRouter constructor needs the BeliefStakeV2 address
 *
 *      Solution: predict BeliefRouter's address using CREATE nonce, deploy
 *      BeliefStakeV2 first with that predicted address, then deploy BeliefRouter.
 *
 * Usage:
 *   # Testnet (Base Sepolia)
 *   forge script scripts/DeployV2.s.sol \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast \
 *     --verify
 *
 *   # Mainnet (Base)
 *   forge script scripts/DeployV2.s.sol \
 *     --rpc-url https://mainnet.base.org \
 *     --broadcast \
 *     --verify
 *
 * Required environment variables:
 *   PRIVATE_KEY          - Deployer private key
 *
 * Optional environment variables:
 *   USDC_ADDRESS         - Override USDC address (defaults to chain constants below)
 *   EAS_ADDRESS          - Override EAS address (defaults to chain constants below)
 *   BELIEF_SCHEMA_UID    - Override schema UID (defaults to chain constants below)
 */
contract DeployV2 is Script {
    // Base mainnet
    address constant BASE_MAINNET_USDC       = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant BASE_MAINNET_EAS        = 0x4200000000000000000000000000000000000021;
    bytes32 constant BASE_MAINNET_SCHEMA_UID = 0x21f7fcf4af0c022d3e7316b6a5b9a04dcaedac59eaea803251e653abd1db9fd6;

    // Base Sepolia
    address constant BASE_SEPOLIA_USDC       = 0xA5c82FCFBe1274166D01B1f3cd9f69Eb79bd74E8;
    address constant BASE_SEPOLIA_EAS        = 0x4200000000000000000000000000000000000021;
    bytes32 constant BASE_SEPOLIA_SCHEMA_UID = 0x21f7fcf4af0c022d3e7316b6a5b9a04dcaedac59eaea803251e653abd1db9fd6;

    function run() external {
        // Supports two signing methods:
        //   a) PRIVATE_KEY env var: `PRIVATE_KEY=0x... forge script ... --broadcast`
        //   b) Cast keystore:       `forge script ... --account <name> --sender <addr> --broadcast`
        //      (--sender is required so msg.sender == the keystore address in the script context)
        uint256 pk       = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pk != 0 ? vm.addr(pk) : msg.sender;

        address usdcAddress = _getEnvOrDefault("USDC_ADDRESS",      _defaultUsdc());
        address easAddress  = _getEnvOrDefault("EAS_ADDRESS",       _defaultEas());
        bytes32 schemaUID   = _getEnvOrDefaultBytes32("BELIEF_SCHEMA_UID", _defaultSchemaUID());

        console2.log("=== DeployV2 ===");
        console2.log("Chain ID:  ", block.chainid);
        console2.log("Deployer:  ", deployer);
        console2.log("USDC:      ", usdcAddress);
        console2.log("EAS:       ", easAddress);
        console2.log("Schema UID:", vm.toString(schemaUID));
        console2.log("");

        if (pk != 0) { vm.startBroadcast(pk); } else { vm.startBroadcast(); }

        // Step 1: Predict BeliefRouter address (it will deploy at nonce+1).
        uint64 currentNonce         = vm.getNonce(deployer);
        address predictedRouter     = vm.computeCreateAddress(deployer, currentNonce + 1);
        console2.log("Predicted BeliefRouter:  ", predictedRouter);

        // Step 2: Deploy BeliefStakeV2 with predicted router address.
        BeliefStakeV2 stakeV2 = new BeliefStakeV2(usdcAddress, predictedRouter);
        console2.log("BeliefStakeV2 deployed:  ", address(stakeV2));

        // Step 3: Deploy BeliefRouter — also pre-approves V2 to pull USDC from it.
        BeliefRouter router = new BeliefRouter(usdcAddress, easAddress, address(stakeV2), schemaUID);
        console2.log("BeliefRouter deployed:   ", address(router));

        vm.stopBroadcast();

        // Sanity checks (run after broadcast so they don't cost gas on-chain)
        require(address(router) == predictedRouter,  "BeliefRouter address mismatch");
        require(stakeV2.router() == address(router), "BeliefStakeV2.router mismatch");
        require(address(router.beliefStake()) == address(stakeV2), "BeliefRouter.beliefStake mismatch");
        require(router.schemaUID() == schemaUID, "BeliefRouter.schemaUID mismatch");

        console2.log("");
        console2.log("=== Deployment complete ===");
        console2.log("BeliefStakeV2:", address(stakeV2));
        console2.log("BeliefRouter: ", address(router));
        console2.log("");
        console2.log("Next steps:");
        console2.log("  1. Verify contracts on Basescan");
        console2.log("  2. Update frontend CONTRACTS with new V2 addresses");
        console2.log("  3. Update subgraph to index BeliefStakeV2 events");
        console2.log("  4. Smoke-test createAndStake() with a small amount");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _defaultUsdc() internal view returns (address) {
        if (block.chainid == 8453)  return BASE_MAINNET_USDC;
        if (block.chainid == 84532) return BASE_SEPOLIA_USDC;
        revert("Unknown chain: set USDC_ADDRESS");
    }

    function _defaultEas() internal view returns (address) {
        if (block.chainid == 8453)  return BASE_MAINNET_EAS;
        if (block.chainid == 84532) return BASE_SEPOLIA_EAS;
        revert("Unknown chain: set EAS_ADDRESS");
    }

    function _defaultSchemaUID() internal view returns (bytes32) {
        if (block.chainid == 8453)  return BASE_MAINNET_SCHEMA_UID;
        if (block.chainid == 84532) return BASE_SEPOLIA_SCHEMA_UID;
        revert("Unknown chain: set BELIEF_SCHEMA_UID");
    }

    function _getEnvOrDefault(string memory key, address fallback_) internal view returns (address) {
        address val = vm.envOr(key, address(0));
        return val != address(0) ? val : fallback_;
    }

    function _getEnvOrDefaultBytes32(string memory key, bytes32 fallback_) internal view returns (bytes32) {
        bytes32 val = vm.envOr(key, bytes32(0));
        return val != bytes32(0) ? val : fallback_;
    }
}
