// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {BeliefStake} from "../contracts/BeliefStake.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

/// @notice Deploy BeliefStake (and optionally a MockUSDC) via Foundry.
///
/// Env vars:
/// - PRIVATE_KEY (uint256): deployer private key (recommended: load from .env, don't pass on CLI)
/// - DEPLOY_MOCK_USDC (bool, optional): if true, deploy a fresh MockUSDC
/// - USDC_ADDRESS (address, optional): if set and DEPLOY_MOCK_USDC is false, use this address
contract DeployBeliefStake is Script {
    address internal constant DEFAULT_EXISTING_USDC =
        0xA5c82FCFBe1274166D01B1f3cd9f69Eb79bd74E8;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        bool deployMock = vm.envOr("DEPLOY_MOCK_USDC", false);
        address usdcAddr = vm.envOr("USDC_ADDRESS", DEFAULT_EXISTING_USDC);

        vm.startBroadcast(deployerKey);

        if (deployMock) {
            MockUSDC usdc = new MockUSDC();
            usdcAddr = address(usdc);
        }

        BeliefStake beliefStake = new BeliefStake(usdcAddr);

        vm.stopBroadcast();

        console2.log("USDC:", usdcAddr);
        console2.log("BeliefStake:", address(beliefStake));
    }
}

