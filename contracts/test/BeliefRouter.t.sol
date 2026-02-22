// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BeliefRouter, AttestationRequest, AttestationRequestData} from "../BeliefRouter.sol";
import {BeliefStakeV2} from "../BeliefStakeV2.sol";
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

/// @dev Deterministic EAS mock: UID = keccak256(encoded data + nonce)
contract MockEAS {
    uint256 private _nonce;

    function attest(AttestationRequest calldata req) external payable returns (bytes32) {
        return keccak256(abi.encode(req.data.data, _nonce++));
    }
}

contract BeliefRouterTest is Test {
    MockUSDC      internal usdc;
    MockEAS       internal eas;
    BeliefStakeV2 internal stakeV2;
    BeliefRouter  internal router;

    address internal deployer;
    address internal user1;
    address internal user2;

    bytes32 constant SCHEMA_UID = keccak256("belief-schema");
    uint256 constant STAKE_AMOUNT = 2_000_000;

    event BeliefCreated(bytes32 indexed attestationUID, address indexed staker, string beliefText);
    event Staked(bytes32 indexed attestationUID, address indexed staker, uint256 amount, uint256 timestamp);

    function setUp() public {
        deployer = makeAddr("deployer");
        user1    = makeAddr("user1");
        user2    = makeAddr("user2");

        usdc = new MockUSDC();
        eas  = new MockEAS();

        // Circular dependency: BeliefStakeV2 needs router address, BeliefRouter needs V2 address.
        // Solution: predict BeliefRouter address (deployed at nonce+1 from deployer).
        vm.startPrank(deployer);
        uint64 nonce = vm.getNonce(deployer);
        address predictedRouter = vm.computeCreateAddress(deployer, nonce + 1);

        stakeV2 = new BeliefStakeV2(address(usdc), predictedRouter); // nonce
        router  = new BeliefRouter(                                    // nonce+1
            address(usdc),
            address(eas),
            address(stakeV2),
            SCHEMA_UID
        );
        require(address(router) == predictedRouter, "address prediction failed");
        vm.stopPrank();

        // Fund user1 and approve router
        usdc.mint(user1, 100_000_000);
        vm.prank(user1);
        usdc.approve(address(router), type(uint256).max);

        usdc.mint(user2, 100_000_000);
        vm.prank(user2);
        usdc.approve(address(router), type(uint256).max);
    }

    // -------------------------------------------------------------------------
    // createAndStake(beliefText, author) — happy path
    // -------------------------------------------------------------------------

    function test_createAndStake_atomicEASAndStake() public {
        string memory belief = "I believe the sky is blue";

        vm.prank(user1);
        bytes32 uid = router.createAndStake(belief, user1);

        // UID must be non-zero
        assertNotEq(uid, bytes32(0));

        // Stake recorded in V2 under msg.sender (user1)
        (uint256 amount, uint256 ts) = stakeV2.getStake(uid, user1);
        assertEq(amount, STAKE_AMOUNT);
        assertGt(ts, 0);

        // USDC ended up in V2
        assertEq(usdc.balanceOf(address(stakeV2)), STAKE_AMOUNT);
        // Router holds nothing
        assertEq(usdc.balanceOf(address(router)), 0);
    }

    function test_createAndStake_stakeRecordedUnderUser_notRouter() public {
        vm.prank(user1);
        bytes32 uid = router.createAndStake("solar panels on every roof", user1);

        // Stake under user1
        (uint256 userAmount,) = stakeV2.getStake(uid, user1);
        assertEq(userAmount, STAKE_AMOUNT);

        // No stake under router
        (uint256 routerAmount,) = stakeV2.getStake(uid, address(router));
        assertEq(routerAmount, 0);
    }

    function test_createAndStake_deductsUsdcFromUser() public {
        uint256 balanceBefore = usdc.balanceOf(user1);

        vm.prank(user1);
        router.createAndStake("decentralized identity is inevitable", user1);

        assertEq(usdc.balanceOf(user1), balanceBefore - STAKE_AMOUNT);
    }

    function test_createAndStake_authorCanDifferFromMsgSender() public {
        // A smart wallet (user1) can designate a different author address.
        address author = makeAddr("humanWallet");

        vm.prank(user1);
        bytes32 uid = router.createAndStake("author != msg.sender", author);

        // Stake is under msg.sender (user1), not the author
        (uint256 senderAmount,) = stakeV2.getStake(uid, user1);
        assertEq(senderAmount, STAKE_AMOUNT);

        (uint256 authorAmount,) = stakeV2.getStake(uid, author);
        assertEq(authorAmount, 0);
    }

    function test_createAndStake_emitsBeliefCreated() public {
        string memory belief = "proof of work is the only truth";

        // Compute expected UID: MockEAS hashes encoded belief + nonce 0
        bytes32 expectedUID = keccak256(abi.encode(abi.encode(belief), uint256(0)));

        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit BeliefCreated(expectedUID, user1, belief);
        router.createAndStake(belief, user1);
    }

    function test_createAndStake_emitsStaked() public {
        string memory belief = "open source wins";
        bytes32 expectedUID  = keccak256(abi.encode(abi.encode(belief), uint256(0)));

        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit Staked(expectedUID, user1, STAKE_AMOUNT, block.timestamp);
        router.createAndStake(belief, user1);
    }

    function test_createAndStake_multipleUsers_differentUIDs() public {
        vm.prank(user1);
        bytes32 uid1 = router.createAndStake("belief A", user1);

        vm.prank(user2);
        bytes32 uid2 = router.createAndStake("belief B", user2);

        assertNotEq(uid1, uid2);

        (uint256 a1,) = stakeV2.getStake(uid1, user1);
        (uint256 a2,) = stakeV2.getStake(uid2, user2);
        assertEq(a1, STAKE_AMOUNT);
        assertEq(a2, STAKE_AMOUNT);
    }

    function test_createAndStake_sameUser_differentBeliefs() public {
        vm.startPrank(user1);
        bytes32 uid1 = router.createAndStake("belief one", user1);
        bytes32 uid2 = router.createAndStake("belief two", user1);
        vm.stopPrank();

        (uint256 a1,) = stakeV2.getStake(uid1, user1);
        (uint256 a2,) = stakeV2.getStake(uid2, user1);
        assertEq(a1, STAKE_AMOUNT);
        assertEq(a2, STAKE_AMOUNT);
        assertEq(usdc.balanceOf(address(stakeV2)), STAKE_AMOUNT * 2);
    }

    // -------------------------------------------------------------------------
    // Revert cases
    // -------------------------------------------------------------------------

    function test_createAndStake_revert_emptyBelief() public {
        vm.prank(user1);
        vm.expectRevert("BeliefRouter: empty belief");
        router.createAndStake("", user1);
    }

    function test_createAndStake_revert_zeroAuthor() public {
        vm.prank(user1);
        vm.expectRevert("BeliefRouter: invalid author");
        router.createAndStake("valid belief", address(0));
    }

    function test_createAndStake_revert_insufficientUsdc() public {
        address broke = makeAddr("broke");
        usdc.mint(broke, STAKE_AMOUNT - 1);

        vm.startPrank(broke);
        usdc.approve(address(router), type(uint256).max);
        vm.expectRevert();
        router.createAndStake("I am broke", broke);
        vm.stopPrank();
    }

    function test_createAndStake_revert_noApproval() public {
        address noApproval = makeAddr("noApproval");
        usdc.mint(noApproval, 100_000_000);
        // No approve call

        vm.prank(noApproval);
        vm.expectRevert();
        router.createAndStake("I forgot to approve", noApproval);
    }

    // -------------------------------------------------------------------------
    // User can unstake via V2 directly after routing
    // -------------------------------------------------------------------------

    function test_userCanUnstakeAfterCreateAndStake() public {
        vm.prank(user1);
        bytes32 uid = router.createAndStake("I believe in the future", user1);

        uint256 balanceBefore = usdc.balanceOf(user1);

        vm.prank(user1);
        stakeV2.unstake(uid);

        assertEq(usdc.balanceOf(user1), balanceBefore + STAKE_AMOUNT);
        (uint256 amount,) = stakeV2.getStake(uid, user1);
        assertEq(amount, 0);
    }
}
