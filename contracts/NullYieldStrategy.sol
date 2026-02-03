// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IYieldStrategy.sol";

/**
 * @title NullYieldStrategy
 * @notice A "do nothing" yield strategy that simply holds USDC.
 *         This is the initial implementation - the backdoor that leads nowhere.
 *         Later, BeliefStake can migrate to AaveYieldStrategy or others.
 *
 * @dev This contract:
 *      - Accepts USDC deposits from BeliefStake
 *      - Holds USDC idle (no yield generation)
 *      - Returns USDC on withdrawal requests
 *      - Generates zero yield (pendingYield always 0)
 *
 *      Why use this instead of holding USDC directly in BeliefStake?
 *      - Establishes the yield strategy interface from day one
 *      - BeliefStake code doesn't change when switching to real yield
 *      - Migration is a single owner transaction
 *      - Future-proofing without complexity
 */
contract NullYieldStrategy is IYieldStrategy, Ownable {
    using SafeERC20 for IERC20;

    /// @notice USDC token contract
    IERC20 public immutable override usdc;

    /// @notice BeliefStake contract (only address that can deposit/withdraw)
    address public immutable override vault;

    /// @notice Total principal deposited
    uint256 private _principal;

    /// @notice Emitted when USDC is deposited
    event Deposited(uint256 amount);

    /// @notice Emitted when USDC is withdrawn
    event Withdrawn(uint256 amount);

    error OnlyVault();
    error InsufficientBalance();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    /**
     * @param _usdc Address of USDC token
     * @param _vault Address of BeliefStake contract
     */
    constructor(address _usdc, address _vault) Ownable(msg.sender) {
        require(_usdc != address(0), "NullYieldStrategy: invalid USDC");
        require(_vault != address(0), "NullYieldStrategy: invalid vault");
        usdc = IERC20(_usdc);
        vault = _vault;
    }

    /// @inheritdoc IYieldStrategy
    function deposit(uint256 amount) external override onlyVault {
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        _principal += amount;
        emit Deposited(amount);
    }

    /// @inheritdoc IYieldStrategy
    function withdraw(uint256 amount) external override onlyVault {
        if (amount > _principal) revert InsufficientBalance();
        _principal -= amount;
        IERC20(usdc).safeTransfer(msg.sender, amount);
        emit Withdrawn(amount);
    }

    /// @inheritdoc IYieldStrategy
    function withdrawAll() external override onlyVault returns (uint256 amount) {
        amount = _principal;
        _principal = 0;
        IERC20(usdc).safeTransfer(msg.sender, amount);
        emit Withdrawn(amount);
    }

    /// @inheritdoc IYieldStrategy
    function totalValue() external view override returns (uint256) {
        // No yield, so total value equals principal
        return _principal;
    }

    /// @inheritdoc IYieldStrategy
    function principal() external view override returns (uint256) {
        return _principal;
    }

    /// @inheritdoc IYieldStrategy
    function pendingYield() external pure override returns (uint256) {
        // Null strategy generates no yield
        return 0;
    }

    /// @inheritdoc IYieldStrategy
    function harvestYield(address) external pure override returns (uint256) {
        // Nothing to harvest
        return 0;
    }

    /**
     * @notice Emergency rescue for tokens accidentally sent to this contract
     * @param token Token to rescue (cannot be USDC if principal > 0)
     * @param to Recipient address
     */
    function rescueTokens(address token, address to) external onlyOwner {
        if (token == address(usdc)) {
            // Only allow rescuing USDC beyond principal (shouldn't happen, but safety)
            uint256 excess = IERC20(usdc).balanceOf(address(this)) - _principal;
            if (excess > 0) {
                IERC20(usdc).safeTransfer(to, excess);
            }
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransfer(to, balance);
        }
    }
}
