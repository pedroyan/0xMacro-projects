//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

library Math {
	/**
	 * @notice Returns the smallest of two numbers.
	 * @param x first argument
	 * @param y second argument
	 * @return z the smallest of the two arguments
	 */
	function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
		z = x < y ? x : y;
	}

	/**
	 * @notice Calculates the square root of a number using the babylonian method.
	 * @dev Great explanation of the babylonian method: https://www.youtube.com/watch?v=CnMBo5nG_zk
	 * @param y the number to be square rooted
	 */
	function sqrt(uint y) internal pure returns (uint z) {
		if (y > 3) {
			z = y;
			uint x = y / 2 + 1;
			while (x < z) {
				z = x;
				x = (y / x + x) / 2;
			}
		} else if (y != 0) {
			z = 1;
		}
	}
}
