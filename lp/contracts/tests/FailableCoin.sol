//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract FailableCoin is ERC20 {
	bool public shouldFail;

	constructor() ERC20('SpaceCoin', 'SPC') {
		_mint(msg.sender, 100_000 * 10 ** 18);
	}

	function setShouldFail(bool _shouldFail) external {
		shouldFail = _shouldFail;
	}

	function transfer(address to, uint256 amount) public virtual override returns (bool) {
		super.transfer(to, amount);
		return !shouldFail;
	}

	function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
		super.transferFrom(from, to, amount);
		return !shouldFail;
	}
}
