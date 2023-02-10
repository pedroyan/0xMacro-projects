// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '../INftMarketplace.sol';

contract FailNftMarketplace is INftMarketplace {
	/// @inheritdoc INftMarketplace
	function getPrice(address nftContract, uint256 nftId) public view override returns (uint256 price) {
		return 0.1 ether;
	}

	/// @inheritdoc INftMarketplace
	function buy(address nftContract, uint256 nftId) external payable override returns (bool success) {
		return false;
	}
}
