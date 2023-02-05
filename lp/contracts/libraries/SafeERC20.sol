//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

error TokenTransferFailed(address token, address from, address to, uint256 value);

library SafeERC20 {
	/**
	 * @dev Safely transfers tokens from one address to another.
	 * @param token The token to transfer.
	 * @param from The address to transfer from.
	 * @param to The address to transfer to.
	 * @param value The amount to transfer.
	 */
	function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
		bool success = token.transferFrom(from, to, value);
		if (!success) {
			revert TokenTransferFailed(address(token), from, to, value);
		}
	}

	/**
	 * @dev Safely transfers tokens to a specified address.
	 * @param token The token to transfer.
	 * @param to The address to transfer to.
	 * @param value The amount to transfer.
	 */
	function safeTransfer(IERC20 token, address to, uint256 value) internal {
		bool success = token.transfer(to, value);
		if (!success) {
			revert TokenTransferFailed(address(token), address(this), to, value);
		}
	}
}
