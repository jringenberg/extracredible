// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {BeliefStake} from "../BeliefStake.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BeliefStakeTest is Test {
    MockUSDC internal usdc;
    BeliefStake internal beliefStake;

    address internal user;
    bytes32 internal uid;

    function setUp() public {
        usdc = new MockUSDC();
        beliefStake = new BeliefStake(address(usdc));

        user = makeAddr("user");
        uid = keccak256("attestation-uid-1");

        usdc.mint(user, 10_000_000); // 10 USDC (6 decimals)

        // Important: compute STAKE_AMOUNT before prank, otherwise prank applies to the first external call.
        uint256 stakeAmount = beliefStake.STAKE_AMOUNT();
        vm.prank(user);
        usdc.approve(address(beliefStake), stakeAmount);
    }

    function testUserCanStake2OnAttestationUID() public {
        uint256 stakeAmount = beliefStake.STAKE_AMOUNT();

        uint256 userBalBefore = usdc.balanceOf(user);
        uint256 contractBalBefore = usdc.balanceOf(address(beliefStake));

        uint256 t = 123_456;
        vm.warp(t);

        vm.prank(user);
        beliefStake.stake(uid);

        (uint256 amount, uint256 timestamp) = beliefStake.getStake(uid, user);
        assertEq(amount, stakeAmount);
        assertEq(timestamp, t);

        assertEq(usdc.balanceOf(user), userBalBefore - stakeAmount);
        assertEq(usdc.balanceOf(address(beliefStake)), contractBalBefore + stakeAmount);
    }

    function testTotalStakedAndStakerCountIncrementCorrectly() public {
        uint256 stakeAmount = beliefStake.STAKE_AMOUNT();

        assertEq(beliefStake.totalStaked(uid), 0);
        assertEq(beliefStake.stakerCount(uid), 0);

        vm.prank(user);
        beliefStake.stake(uid);

        assertEq(beliefStake.totalStaked(uid), stakeAmount);
        assertEq(beliefStake.stakerCount(uid), 1);
    }

    function testUserCanUnstakeAndGet2Back() public {
        uint256 stakeAmount = beliefStake.STAKE_AMOUNT();

        vm.prank(user);
        beliefStake.stake(uid);

        uint256 userBalAfterStake = usdc.balanceOf(user);
        uint256 contractBalAfterStake = usdc.balanceOf(address(beliefStake));

        vm.prank(user);
        beliefStake.unstake(uid);

        // stake cleared
        (uint256 amount, uint256 timestamp) = beliefStake.getStake(uid, user);
        assertEq(amount, 0);
        assertEq(timestamp, 0);

        // totals cleared
        assertEq(beliefStake.totalStaked(uid), 0);
        assertEq(beliefStake.stakerCount(uid), 0);

        // balances restored
        assertEq(usdc.balanceOf(user), userBalAfterStake + stakeAmount);
        assertEq(usdc.balanceOf(address(beliefStake)), contractBalAfterStake - stakeAmount);
    }

    function testUserCannotStakeTwiceOnSameUID() public {
        vm.prank(user);
        beliefStake.stake(uid);

        vm.prank(user);
        vm.expectRevert(bytes("BeliefStake: already staked"));
        beliefStake.stake(uid);
    }

    function testUserCannotUnstakeIfTheyHaventStaked() public {
        vm.prank(user);
        vm.expectRevert(bytes("BeliefStake: no stake found"));
        beliefStake.unstake(uid);
    }
}

