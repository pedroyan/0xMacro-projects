//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './MerkleAirdrop.sol';

/**
 * @title Airdrop
 * @author Pedro Yan
 * @author Melvillian
 * @notice A contract for airdropping MACRO token which allows claimers to claim their tokens
 * using either signatures, or a Merkle proof. Once quantum computers have broken ECDSA, an
 * owner can turn off the ability to verify using ECDSA signatures leaving only Merkle proof
 * verification (which uses cryptographic hash functions resistant to quantum computers).
 */
contract Airdrop is MerkleAirdrop {
	/// @notice Address of the MACRO ERC20 token
	IERC20 public immutable macroToken;

	/// @notice A mapping to keep track of which addresses
	/// have already claimed their airdrop
	mapping(address => bool) public alreadyClaimed;

	event AirdropClaimed(address claimant, uint256 amount, address to);

	error AlreadyClaimed(address claimant);

	/// @notice Sets the necessary initial claimer verification data
	constructor(bytes32 _root, address _signer, IERC20 _macroToken) MerkleAirdrop(_root) EIP712Airdrop(_signer) {
		macroToken = _macroToken;
	}

	/**
	 * @notice Allows a msg.sender to claim their MACRO token by providing a signature signed by the `iArdrop.signer` address.
	 * @dev An address can only claim its MACRO once.
	 * @dev See `Airdrop.toTypedDataHash` for how to format the pre-signed data
	 * @param _claim The signed claim dayta.
	 * @param _to The address the claimed MACRO should be sent to
	 */
	function signatureClaim(SignedClaim calldata _claim, address _to) external {
		// Validate the signed claim
		(address _claimer, uint256 _amount) = _validateSignedClaim(_claim);

		// Ensure that the claimant has not already claimed their MACRO Tokens
		if (alreadyClaimed[_claimer]) revert AlreadyClaimed(_claimer);

		// Mark the claimant as having claimed their MACRO Tokens
		alreadyClaimed[_claimer] = true;

		// Emit an event
		emit AirdropClaimed(_claimer, _amount, _to);

		// Transfer the MACRO tokens to the claimant. Since we are using OZ's Immutable ERC20 implementation,
		// we know it throws on any failure _transfer, so there’s no need to check the return value.
		// slither-disable-next-line unchecked-transfer
		macroToken.transfer(_to, _amount);
	}

	/**
	 * @notice Allows a msg.sender to claim their MACRO token by providing a merkle proof proving their address
	 * is indeed committed to by the Merkle root stored in `Airdrop.merkleRoot`.
	 * @dev An address can only claim its MACRO once.
	 * @dev See `Airdrop.toLeafFormat` for how to format the Merkle leaf data.
	 * @param _amount The amount of MACRO to be claimed.
	 * @param _proof Merkle proof used to prove inclusion in the merkle tree.
	 * @param _to The address the claimed MACRO should be sent to.
	 */
	function merkleClaim(uint256 _amount, bytes32[] calldata _proof, address _to) external {
		// Ensure that the claimant has not already claimed their MACRO Tokens
		if (alreadyClaimed[msg.sender]) revert AlreadyClaimed(msg.sender);

		// Compute the merkle proof and ensure it matches the merkle root
		_validateMerkleProof(msg.sender, _amount, _proof);

		// Mark the claimant as having claimed their MACRO Tokens
		alreadyClaimed[msg.sender] = true;

		// Emit an event
		emit AirdropClaimed(msg.sender, _amount, _to);

		// Transfer the MACRO tokens to the claimant. Since we are using OZ's Immutable ERC20 implementation,
		// we know it throws on any failure _transfer, so there’s no need to check the return value.
		// slither-disable-next-line unchecked-transfer
		macroToken.transfer(_to, _amount);
	}
}
