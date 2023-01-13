//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import "../Project.sol";

/**
 * @dev Contract that exposes contribution functions to a project
 */
contract Contributor {
    function contribute(Project project) public payable {
        project.contribute{value: msg.value}();
    }

    function claimBadges(Project project) public {
        project.claimBadges();
    }

    function refund(Project project) public {
        project.refund();
    }
}