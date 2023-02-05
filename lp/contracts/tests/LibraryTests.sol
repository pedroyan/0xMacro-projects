//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../libraries/SafeERC20.sol';
import '../libraries/Math.sol';
import '../libraries/SwapMath.sol';

contract LibraryTestContract {
	using SafeERC20 for IERC20;

	function safeTransferFrom(IERC20 _token, address _from, address _to, uint256 _amount) external {
		_token.safeTransferFrom(_from, _to, _amount);
	}

	function safeTransfer(IERC20 _token, address _to, uint256 _amount) external {
		_token.safeTransfer(_to, _amount);
	}

	function sqrt(uint256 _x) external pure returns (uint256) {
		return Math.sqrt(_x);
	}

	function getMaximumAmountOut(
		uint256 _amountIn,
		uint256 _reserveIn,
		uint256 _reserveOut
	) external pure returns (uint256) {
		return SwapMath.getMaximumAmountOut(_amountIn, _reserveIn, _reserveOut);
	}
}
