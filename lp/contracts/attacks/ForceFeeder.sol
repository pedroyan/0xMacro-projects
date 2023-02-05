//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import '../Ico.sol';

contract ForceFeeder {
	address public immutable ico;

	constructor(address _ico) {
		ico = _ico;
	}

	receive() external payable {}

	function forceFeed() external payable {
		selfdestruct(payable(address(ico)));
	}
}
