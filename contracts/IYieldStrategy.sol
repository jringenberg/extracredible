// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IYieldStrategy
 * @notice Interface for yield-generating strategies. BeliefStake deposits idle USDC
 *         into a yield strategy; principal always returns to users, yield goes to treasury.
 *
 * @dev Implementations:
 *      - NullYieldStrategy: Holds USDC with no yield (initial "backdoor" implementation)
 *      - AaveYieldStrategy: Deposits to Aave V3, earns supply APY
 *      - Future: Compound, Morpho, etc.
 *
 *      Migration between strategies happens via BeliefStake.migrateYieldStrategy()
 *      which withdraws all from old strategy and deposits to new in one transaction.
 */
interface IYieldStrategy {
    /// @notice Deposit USDC into the yield source
    /// @param amount Amount of USDC to deposit (6 decimals)
    /// @dev Called by BeliefStake when users stake. Strategy must have USDC approval.
    function deposit(uint256 amount) external;

    /// @notice Withdraw USDC from the yield source
    /// @param amount Amount of USDC to withdraw (6 decimals)
    /// @dev Called by BeliefStake when users unstake. Returns principal only.
    function withdraw(uint256 amount) external;

    /// @notice Withdraw all USDC from the yield source
    /// @return amount Total USDC withdrawn
    /// @dev Used during strategy migration. Includes principal + any unrealized yield.
    function withdrawAll() external returns (uint256 amount);

    /// @notice Get total USDC value held by this strategy (principal + yield)
    /// @return Total USDC value (6 decimals)
    function totalValue() external view returns (uint256);

    /// @notice Get the principal amount deposited (excluding yield)
    /// @return Principal USDC amount (6 decimals)
    function principal() external view returns (uint256);

    /// @notice Get unrealized yield (totalValue - principal)
    /// @return Yield amount in USDC (6 decimals)
    function pendingYield() external view returns (uint256);

    /// @notice Harvest yield to treasury without touching principal
    /// @param treasury Address to receive harvested yield
    /// @return harvested Amount of yield sent to treasury
    function harvestYield(address treasury) external returns (uint256 harvested);

    /// @notice Address of the USDC token this strategy uses
    function usdc() external view returns (address);

    /// @notice Address authorized to call deposit/withdraw (should be BeliefStake)
    function vault() external view returns (address);
}
