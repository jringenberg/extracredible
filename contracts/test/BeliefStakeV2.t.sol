// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BeliefStakeV2} from "../BeliefStakeV2.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Simulates the router calling stakeFor on behalf of a user.
///      Holds USDC and pre-approves BeliefStakeV2 to pull from it.
contract MockRouter {
    BeliefStakeV2 public immutable stakeContract;

    constructor(address _stakeContract, address _usdc) {
        stakeContract = BeliefStakeV2(_stakeContract);
        IERC20(_usdc).approve(_stakeContract, type(uint256).max);
    }

    function callStakeFor(bytes32 uid, address staker) external {
        stakeContract.stakeFor(uid, staker);
    }
}

contract BeliefStakeV2Test is Test {
    MockUSDC internal usdc;
    MockRouter internal router;
    BeliefStakeV2 internal stakeV2;

    address internal owner;
    address internal user1;
    address internal user2;
    address internal attacker;

    bytes32 internal uid1 = keccak256("belief-1");
    bytes32 internal uid2 = keccak256("belief-2");

    uint256 constant STAKE_AMOUNT = 2_000_000;

    event Staked(bytes32 indexed attestationUID, address indexed staker, uint256 amount, uint256 timestamp);
    event Unstaked(bytes32 indexed attestationUID, address indexed staker, uint256 amount);

    function setUp() public {
        owner    = makeAddr("owner");
        user1    = makeAddr("user1");
        user2    = makeAddr("user2");
        attacker = makeAddr("attacker");

        usdc = new MockUSDC();

        // Circular dependency: router needs V2 address, V2 needs router address.
        // Solution: predict V2 address (deployed at nonce+1 from owner).
        vm.startPrank(owner);
        uint64 nonce = vm.getNonce(owner);
        address predictedV2 = vm.computeCreateAddress(owner, nonce + 1);

        router  = new MockRouter(predictedV2, address(usdc)); // nonce
        stakeV2 = new BeliefStakeV2(address(usdc), address(router)); // nonce+1
        require(address(stakeV2) == predictedV2, "address prediction failed");
        vm.stopPrank();

        // Fund EOA users and approve V2
        usdc.mint(user1, 100_000_000);
        vm.prank(user1);
        usdc.approve(address(stakeV2), type(uint256).max);

        usdc.mint(user2, 100_000_000);
        vm.prank(user2);
        usdc.approve(address(stakeV2), type(uint256).max);

        // Fund router (V2 will pull from it in stakeFor)
        usdc.mint(address(router), 100_000_000);
    }

    // -------------------------------------------------------------------------
    // stakeFor() — router path
    // -------------------------------------------------------------------------

    function test_stakeFor_recordsUnderStaker_notRouter() public {
        router.callStakeFor(uid1, user1);

        // Stake recorded under user1
        (uint256 amount, uint256 ts) = stakeV2.getStake(uid1, user1);
        assertEq(amount, STAKE_AMOUNT);
        assertGt(ts, 0);

        // Router has no stake entry
        (uint256 routerAmount,) = stakeV2.getStake(uid1, address(router));
        assertEq(routerAmount, 0);
    }

    function test_stakeFor_transfersUsdcToV2() public {
        uint256 routerBefore = usdc.balanceOf(address(router));

        router.callStakeFor(uid1, user1);

        assertEq(usdc.balanceOf(address(stakeV2)), STAKE_AMOUNT);
        assertEq(usdc.balanceOf(address(router)), routerBefore - STAKE_AMOUNT);
    }

    function test_stakeFor_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Staked(uid1, user1, STAKE_AMOUNT, block.timestamp);
        router.callStakeFor(uid1, user1);
    }

    function test_stakeFor_revert_nonRouter() public {
        vm.prank(attacker);
        vm.expectRevert("BeliefStakeV2: caller is not router");
        stakeV2.stakeFor(uid1, user1);
    }

    function test_stakeFor_revert_directEOACall() public {
        vm.prank(user1);
        vm.expectRevert("BeliefStakeV2: caller is not router");
        stakeV2.stakeFor(uid1, user1);
    }

    function test_stakeFor_revert_zeroStaker() public {
        vm.prank(address(router));
        vm.expectRevert("BeliefStakeV2: invalid staker");
        stakeV2.stakeFor(uid1, address(0));
    }

    function test_stakeFor_revert_alreadyStaked() public {
        router.callStakeFor(uid1, user1);

        vm.expectRevert("BeliefStakeV2: already staked");
        router.callStakeFor(uid1, user1);
    }

    // -------------------------------------------------------------------------
    // stake() — EOA path still works
    // -------------------------------------------------------------------------

    function test_stake_EOA_success() public {
        uint256 balanceBefore = usdc.balanceOf(user1);

        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit Staked(uid1, user1, STAKE_AMOUNT, block.timestamp);
        stakeV2.stake(uid1);

        (uint256 amount,) = stakeV2.getStake(uid1, user1);
        assertEq(amount, STAKE_AMOUNT);
        assertEq(usdc.balanceOf(user1), balanceBefore - STAKE_AMOUNT);
        assertEq(usdc.balanceOf(address(stakeV2)), STAKE_AMOUNT);
        assertEq(stakeV2.stakerCount(uid1), 1);
    }

    function test_stake_EOA_revert_alreadyStaked() public {
        vm.startPrank(user1);
        stakeV2.stake(uid1);
        vm.expectRevert("BeliefStakeV2: already staked");
        stakeV2.stake(uid1);
        vm.stopPrank();
    }

    function test_stake_EOA_revert_zeroUID() public {
        vm.prank(user1);
        vm.expectRevert("BeliefStakeV2: invalid UID");
        stakeV2.stake(bytes32(0));
    }

    function test_stake_multipleUsers() public {
        vm.prank(user1);
        stakeV2.stake(uid1);

        vm.prank(user2);
        stakeV2.stake(uid1);

        assertEq(stakeV2.stakerCount(uid1), 2);
        assertEq(stakeV2.totalStaked(uid1), STAKE_AMOUNT * 2);
    }

    // -------------------------------------------------------------------------
    // unstake() — returns USDC to the recorded staker, regardless of how staked
    // -------------------------------------------------------------------------

    function test_unstake_afterStake_EOA() public {
        vm.prank(user1);
        stakeV2.stake(uid1);

        uint256 balanceBefore = usdc.balanceOf(user1);

        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit Unstaked(uid1, user1, STAKE_AMOUNT);
        stakeV2.unstake(uid1);

        assertEq(usdc.balanceOf(user1), balanceBefore + STAKE_AMOUNT);
        (uint256 amount,) = stakeV2.getStake(uid1, user1);
        assertEq(amount, 0);
        assertEq(stakeV2.stakerCount(uid1), 0);
    }

    function test_unstake_afterStakeFor_returnsToStaker_notRouter() public {
        router.callStakeFor(uid1, user1);

        uint256 user1Before  = usdc.balanceOf(user1);
        uint256 routerBefore = usdc.balanceOf(address(router));

        vm.prank(user1);
        stakeV2.unstake(uid1);

        // USDC goes to user1, not the router
        assertEq(usdc.balanceOf(user1),          user1Before + STAKE_AMOUNT);
        assertEq(usdc.balanceOf(address(router)), routerBefore);
        assertEq(usdc.balanceOf(address(stakeV2)), 0);
    }

    function test_unstake_revert_noStake() public {
        vm.prank(user1);
        vm.expectRevert("BeliefStakeV2: no stake found");
        stakeV2.unstake(uid1);
    }

    function test_unstake_revert_doubleUnstake() public {
        vm.startPrank(user1);
        stakeV2.stake(uid1);
        stakeV2.unstake(uid1);

        vm.expectRevert("BeliefStakeV2: no stake found");
        stakeV2.unstake(uid1);
        vm.stopPrank();
    }

    function test_unstake_partialFromMultiple() public {
        vm.prank(user1);
        stakeV2.stake(uid1);
        vm.prank(user2);
        stakeV2.stake(uid1);

        vm.prank(user1);
        stakeV2.unstake(uid1);

        // user2's stake untouched
        (uint256 amount,) = stakeV2.getStake(uid1, user2);
        assertEq(amount, STAKE_AMOUNT);
        assertEq(stakeV2.stakerCount(uid1), 1);
    }

    // -------------------------------------------------------------------------
    // Admin — setRouter
    // -------------------------------------------------------------------------

    function test_setRouter_ownerOnly() public {
        address newRouter = makeAddr("newRouter");

        vm.prank(owner);
        stakeV2.setRouter(newRouter);

        assertEq(stakeV2.router(), newRouter);
    }

    function test_setRouter_revert_nonOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        stakeV2.setRouter(makeAddr("x"));
    }

    function test_setRouter_revert_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("BeliefStakeV2: invalid router");
        stakeV2.setRouter(address(0));
    }
}
