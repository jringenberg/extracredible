// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BeliefStakeV2
 * @notice V2 adds stakeFor() so a trusted router can stake on behalf of a user.
 *         Original stake() still works for EOA users hitting the contract directly.
 *         V1 (BeliefStake) stays deployed and untouched on mainnet.
 */
contract BeliefStakeV2 is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant STAKE_AMOUNT = 2_000_000; // $2 USDC (6 decimals)

    IERC20 public immutable usdc;

    /// @notice Trusted router address allowed to call stakeFor()
    address public router;

    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
    }

    mapping(bytes32 => mapping(address => StakeInfo)) public stakes;
    mapping(bytes32 => uint256) public totalStaked;
    mapping(bytes32 => uint256) public stakerCount;

    event Staked(bytes32 indexed attestationUID, address indexed staker, uint256 amount, uint256 timestamp);
    event Unstaked(bytes32 indexed attestationUID, address indexed staker, uint256 amount);
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);

    modifier onlyRouter() {
        require(msg.sender == router, "BeliefStakeV2: caller is not router");
        _;
    }

    constructor(address _usdc, address _router) Ownable(msg.sender) {
        require(_usdc != address(0), "BeliefStakeV2: invalid USDC");
        require(_router != address(0), "BeliefStakeV2: invalid router");
        usdc = IERC20(_usdc);
        router = _router;
    }

    // -------------------------------------------------------------------------
    // EOA path (same as V1)
    // -------------------------------------------------------------------------

    function stake(bytes32 attestationUID) external nonReentrant {
        _stake(attestationUID, msg.sender);
        usdc.safeTransferFrom(msg.sender, address(this), STAKE_AMOUNT);
    }

    function unstake(bytes32 attestationUID) external nonReentrant {
        _unstake(attestationUID, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Router path — USDC already transferred to this contract by the router
    // -------------------------------------------------------------------------

    /**
     * @notice Called by the router after it has already transferred USDC here.
     * @param attestationUID The EAS UID returned from the attest() call.
     * @param staker         The actual user — recorded as the staker, not the router.
     */
    function stakeFor(bytes32 attestationUID, address staker) external nonReentrant onlyRouter {
        require(staker != address(0), "BeliefStakeV2: invalid staker");
        _stake(attestationUID, staker);
        // Router pulled USDC from the user; now V2 pulls it from the router
        // via the max-approval the router set in its constructor.
        usdc.safeTransferFrom(msg.sender, address(this), STAKE_AMOUNT);
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    function _stake(bytes32 attestationUID, address staker) internal {
        require(attestationUID != bytes32(0), "BeliefStakeV2: invalid UID");
        require(stakes[attestationUID][staker].amount == 0, "BeliefStakeV2: already staked");

        stakes[attestationUID][staker] = StakeInfo({
            amount: STAKE_AMOUNT,
            timestamp: block.timestamp
        });

        totalStaked[attestationUID] += STAKE_AMOUNT;
        stakerCount[attestationUID]++;

        emit Staked(attestationUID, staker, STAKE_AMOUNT, block.timestamp);
    }

    function _unstake(bytes32 attestationUID, address staker) internal {
        StakeInfo storage info = stakes[attestationUID][staker];
        require(info.amount > 0, "BeliefStakeV2: no stake found");

        uint256 amount = info.amount;
        delete stakes[attestationUID][staker];

        totalStaked[attestationUID] -= amount;
        stakerCount[attestationUID]--;

        usdc.safeTransfer(staker, amount);
        emit Unstaked(attestationUID, staker, amount);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "BeliefStakeV2: invalid router");
        emit RouterUpdated(router, _router);
        router = _router;
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getStake(bytes32 attestationUID, address staker)
        external view returns (uint256 amount, uint256 timestamp)
    {
        StakeInfo memory info = stakes[attestationUID][staker];
        return (info.amount, info.timestamp);
    }

    function getStakerCount(bytes32 attestationUID) external view returns (uint256) {
        return stakerCount[attestationUID];
    }
}
