//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import "../Ico.sol";

contract ForceFeeder {
    ICO public immutable ico;

    constructor(ICO _ico) {
        ico = _ico;
    }

    receive() external payable {}

    function forceFeedIco() external payable {
        selfdestruct(payable(address(ico)));
    }
}