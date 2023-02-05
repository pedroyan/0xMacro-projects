//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

error Unauthorized();

abstract contract Ownable {
	/**
	 * @notice The address of the contract owner
	 */
	address public immutable owner;

	/**
	 * @notice Creates an Ownable contract
	 * @param _owner The address of the contract owner
	 */
	constructor(address _owner) {
		owner = _owner;
	}

	/**
	 * @notice Modifier that reverts if the caller is not the contract owner
	 */
	modifier onlyOwner() {
		if (msg.sender != owner) {
			revert Unauthorized();
		}
		_;
	}
}
