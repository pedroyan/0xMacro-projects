//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import './SpaceLP.sol';
import './SpaceCoin.sol';
import './libraries/SafeERC20.sol';

contract SpaceRouter {
	using SafeERC20 for SpaceCoin;
	using SafeERC20 for SpaceLP;

	/// @notice The liquidity pool contract.
	SpaceLP public spaceLP;

	/// @notice The SPC token contract.
	SpaceCoin public spaceCoin;

	/**
	 * @notice Thrown when the amount of ETH provided is suboptimal for the swap.
	 * @param expectedEth The amount of ETH that would be optimal for the swap.
	 * @param actualEth The amount of ETH that was provided.
	 */
	error SuboptimalEthIn(uint256 expectedEth, uint256 actualEth);

	/**
	 * @notice Thrown when the amount of SPC or ETH received is less than the minimum amount expected by the trader.
	 * @param minimumAmountOut The minimum amount of SPC or ETH expected by the trader.
	 * @param actualAmountOut The actual amount of SPC or ETH received by the trader.
	 */
	error MinimumAmountOutNotMet(uint256 minimumAmountOut, uint256 actualAmountOut);

	/**
	 * @notice Creates a new router contract.
	 * @param _spaceLP The address of the liquidity pool contract.
	 * @param _spaceCoin The address of the SPC token contract.
	 */
	constructor(SpaceLP _spaceLP, SpaceCoin _spaceCoin) {
		spaceLP = _spaceLP;
		spaceCoin = _spaceCoin;
	}

	/**
	 * @notice Provides ETH-SPC liquidity to LP contract. The desired amount of ETH to be deposited is indicated by
	 * msg.value. Throws if the amount of ETH provided will not yield an optimal swap.
	 * @param spc The desired amount of SPC to be deposited
	 */
	function addLiquidity(uint256 spc) external payable {
		// Fetch reserves from the liquidity poolxw
		(uint256 ethReserves, uint256 spcReserves) = spaceLP.getReserves();

		// If liquidity pool is empty, liquidity can be set at an arbitrary rate decided the provider
		if (ethReserves == 0 && spcReserves == 0) {
			_depositFunds(spc);
			return;
		}

		// If the pool was already initialized, ensure ratio of ETH:SPC being provided matches the ratios provided by the
		// liquidity pool for optimal liquidity
		uint256 optimalEthIn = _optimalEthIn(spc, ethReserves, spcReserves);

		// If the amount of ETH provided is less than the optimal amount, the transaction is reverted,
		// since the liquidity provision would waste SPC. If the amount of ETH provided is greater than
		// the optimal amount, the transaction is also reverted, since the liquidity provision would waste
		// ETH.
		if (msg.value != optimalEthIn) {
			revert SuboptimalEthIn(optimalEthIn, msg.value);
		}

		// If the amount of ETH provided is optimal, the liquidity provision is executed.
		_depositFunds(spc);
	}

	/**
	 * Atomically deposits ETH and SPC into the LP contract. All the eth sent in the current call
	 * gets forwarded to the LP contract.
	 * @param spc The amount of SPC to be deposited into the LP
	 */
	function _depositFunds(uint spc) private {
		spaceCoin.safeTransferFrom(msg.sender, address(spaceLP), spc);
		spaceLP.deposit{value: msg.value}(msg.sender);
	}

	/**
	 * Removes ETH-SPC liquidity from LP contract.
	 * @param lpToken The amount of LP tokens being returned.
	 */
	function removeLiquidity(uint256 lpToken) external {
		spaceLP.safeTransferFrom(msg.sender, address(spaceLP), lpToken);
		spaceLP.withdraw(msg.sender);
	}

	/**
	 * @notice Swaps ETH for SPC in LP contract
	 * @dev The function calculates the actual amount out by comparing the balance before swap with the balance after swap.
	 * This allows for a cleaner separation of responsibilities between the LP contract (solve the constant product formula),
	 * the token contract (tax enabled/disabled) and the router contract (ensure traders can get the best swaps).
	 * @param spcOutMin The minimum acceptable amount of SPC to be received
	 */
	function swapETHForSPC(uint256 spcOutMin) external payable {
		// Fetch the balance of SPC of the sender prior to the swap.
		uint256 spcBalanceBefore = spaceCoin.balanceOf(msg.sender);

		// Perform the ETH -> SPC swap.
		spaceLP.swap{value: msg.value}(msg.sender, true);

		// Although the subtraction below cannot overflow due how the other modules work, we will keep the checks
		// here since it is not a good software practice to create logic based on assumptions of the internals of
		// other modules.
		uint256 netAmountOut = spaceCoin.balanceOf(msg.sender) - spcBalanceBefore;
		if (netAmountOut < spcOutMin) {
			revert MinimumAmountOutNotMet(spcOutMin, netAmountOut);
		}
	}

	/**
	 * @notice Swaps SPC for ETH in LP contract.
	 * @param spcIn The amount of inbound SPC to be swapped.
	 * @param ethOutMin The minimum acceptable amount of ETH to be received.
	 */
	function swapSPCForETH(uint256 spcIn, uint256 ethOutMin) external {
		// Perform the SPC -> ETH swap.
		spaceCoin.safeTransferFrom(msg.sender, address(spaceLP), spcIn);
		uint256 ethAmountOut = spaceLP.swap(msg.sender, false);

		// See if the amount of ETH out is greater than the minimum amount of ETH expected by the trader.
		// If it is not, the transaction is reverted. Note that here we don't need to compare the "before"
		// with the "after" balance because the possibility of an ETH transfer tax does not exist and the
		// exact amount of ETH received by the trader is known in advance by the LP.
		if (ethAmountOut < ethOutMin) {
			revert MinimumAmountOutNotMet(ethOutMin, ethAmountOut);
		}
	}

	/**
	 * Calculates the optimal amount of input ETH for a given amount of input SPC and liquidity pool reserves.
	 * @param spcIn amount of SPC to be deposited.
	 * @param ethReserves amount of ETH recognized in the liquidity pool.
	 * @param spcReserves amount of SPC recognized in the liquidity pool.
	 */
	function _optimalEthIn(uint256 spcIn, uint256 ethReserves, uint256 spcReserves) public pure returns (uint256) {
		return (spcIn * ethReserves) / spcReserves;
	}

	/**
	 * Recommends the optimal amount of input ETH to deposit alongisde a given amount of input SPC.
	 * @param spcIn amount of SPC to be deposited.
	 * @return recommend amount of wei to deposit.
	 */
	function getOptimalDepositEth(uint256 spcIn) external view returns (uint256) {
		(uint256 ethReserves, uint256 spcReserves) = spaceLP.getReserves();

		// If reserves are empty, suggest a 1:5 ratio of ETH:SPC
		if (ethReserves == 0 && spcReserves == 0) {
			uint256 suggestedSpc = spcIn / 5;
			return suggestedSpc != 0 ? suggestedSpc : 1;
		}

		return _optimalEthIn(spcIn, ethReserves, spcReserves);
	}

	/**
	 * @notice Calculates the maximum amount of ETH that can be received for a given amount of SPC.
	 * Calculation does not take into account the SPC Tax flag since that value can change at any time.
	 * It's up to the user to decide if they are willing to tolerate unfavorable outcomes due to taxes on
	 * their minimumAmountOut parameters.
	 * @param spcIn amount of SPC to be swapped for ETH.
	 */
	function getMaximumEthAmountOut(uint256 spcIn) external view returns (uint256) {
		(uint256 ethReserves, uint256 spcReserves) = spaceLP.getReserves();
		return SwapMath.getMaximumAmountOut(spcIn, spcReserves, ethReserves);
	}

	/**
	 * @notice Calculates the maximum amount of SPC that can be received for a given amount of ETH.
	 * Calculation does not take into account the SPC Tax flag since that value can change at any time.
	 * It's up to the user to decide if they are willing to tolerate unfavorable outcomes due to taxes on
	 * their minimumAmountOut parameters.
	 * @param ethIn amount of ETH to be swapped for SPC.
	 */
	function getMaximumSpcAmountOut(uint256 ethIn) external view returns (uint256) {
		(uint256 ethReserves, uint256 spcReserves) = spaceLP.getReserves();
		return SwapMath.getMaximumAmountOut(ethIn, ethReserves, spcReserves);
	}
}
