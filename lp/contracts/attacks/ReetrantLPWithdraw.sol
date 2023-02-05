//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import '../SpaceLP.sol';

contract ReetrantLPWithdraw {
	SpaceLP public lp;
	bool private _entered;

	constructor(SpaceLP _lp) {
		lp = _lp;
	}

	// Reenter once
	receive() external payable {
		if (!_entered) {
			_entered = true;
			lp.withdraw(address(this));
		}
	}
}
