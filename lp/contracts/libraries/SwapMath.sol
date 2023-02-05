//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

error InsufficientInputAmount();
error InsufficientLiquidity();

library SwapMath {
	/**
	 * @notice Solves the constant product formula to obtain the amount out of a swap given the amount in and reserves.
	 * Calculations already applies a 1% fee to the amount in.
	 * @param amountIn amount in of the swap.
	 * @param reserveIn reserve of the input token.
	 * @param reserveOut reserve of the output token.
	 */
	function getMaximumAmountOut(
		uint256 amountIn,
		uint256 reserveIn,
		uint256 reserveOut
	) internal pure returns (uint256) {
		// Amount in must be greater than 0
		if (amountIn == 0) {
			revert InsufficientInputAmount();
		}

		// Reserves must be greater than 0 to enable a valid swap
		if (reserveIn == 0 || reserveOut == 0) {
			revert InsufficientLiquidity();
		}

		// Solve constant product formula for amount out: https://betterprogramming.pub/uniswap-v2-in-depth-98075c826254
		// Note: instead of computing and subtracting the 1% fee from the amount in, we multiply the amountIn in by 99 and
		// scale denominator components by 100. This will ensure no information is lost due to rounding until the very
		// last step.
		uint256 feeAdjustedAmountIn = amountIn * 99;
		uint256 numerator = feeAdjustedAmountIn * reserveOut;
		uint256 denominator = reserveIn * 100 + feeAdjustedAmountIn;

		return numerator / denominator;
	}
}
