//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import './EIP712Airdrop.sol';

/**
 * @title MerkleAirdrop
 * @author Pedro Yan
 * @notice A contract for the Merkle Tree validation logic of the MACRO airdrop.
 */
abstract contract MerkleAirdrop is EIP712Airdrop {
	/**
	 * @notice A merkle proof used to prove inclusion in a set of airdrop claimer addresses.
	 * Claimers can provide a merkle proof using this merkle root and claim their airdropped
	 * tokens.
	 */
	bytes32 public immutable merkleRoot;

	/**
	 * @notice Thrown when the computed root does not match the expected root.
	 * @param computedRoot The computed root.
	 * @param expectedRoot The expected root.
	 */
	error InvalidProof(bytes32 computedRoot, bytes32 expectedRoot);

	/**
	 * Constructs a new MerkleAirdrop contract.
	 * @param _root The merkle root of the merkle tree containing the claimer addresses.
	 */
	constructor(bytes32 _root) {
		merkleRoot = _root;
	}

	/**
	 * Validates a merkle proof for a claimer's address and amount.
	 * @param _claimer The address which will claim the MACRO tokens.
	 * @param _amount The amount of MACRO to be claimed.
	 * @param _proof The merkle proof provided by the claimant.
	 */
	function _validateMerkleProof(address _claimer, uint256 _amount, bytes32[] calldata _proof) internal view {
		bytes32 _leaf = toLeafFormat(_claimer, _amount);
		bytes32 _computedRoot = _computeRoot(_proof, _leaf);

		if (merkleRoot != _computedRoot) revert InvalidProof(_computedRoot, merkleRoot);
	}

	/**
	 * @notice Helper function for formatting the claimer data stored in a Merkle tree leaf.
	 * @param _claimer The address which will claim the MACRO tokens.
	 * @param _amount The amount of MACRO to be claimed.
	 * @return A 32-byte hash, which is one of the leaves of the Merkle tree represented by  `Airdrop.merkleRoot`
	 */
	function toLeafFormat(address _claimer, uint256 _amount) internal pure returns (bytes32) {
		return keccak256(bytes(abi.encodePacked(_claimer, _amount)));
	}

	/**
	 * @notice Computes the merkle root from a leaf and a merkle proof.
	 * @param _proof The merkle proof provided by the claimant.
	 * @param _leaf The leaf provided by the claimant.
	 */
	function _computeRoot(bytes32[] calldata _proof, bytes32 _leaf) internal pure returns (bytes32) {
		// Initialize the computed hash to the provided leaf
		bytes32 computedNode = _leaf;

		// Compute the hash of the tree nodes, while accounting for node ordering, all the way to the root.
		for (uint256 i = 0; i < _proof.length; i++) {
			bytes32 siblingNode = _proof[i];

			if (computedNode <= siblingNode) {
				computedNode = keccak256(abi.encodePacked(computedNode, siblingNode));
			} else {
				computedNode = keccak256(abi.encodePacked(siblingNode, computedNode));
			}
		}

		// Return the computed root
		return computedNode;
	}
}
