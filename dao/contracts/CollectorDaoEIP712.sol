// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

error InvalidSignature();

/**
 * @title CollectorDaoEIP712
 * @author Pedro Yan
 * @notice Contract that implements EIP-712 signature validations for the Collector DAO.
 */
abstract contract CollectorDaoEIP712 {
	/// @notice EIP-712 typehash for the EIP712Domain struct
	bytes32 public constant EIP712_DOMAIN_TYPEHASH =
		keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');

	/// @notice EIP-712 typehash for the CastVote struct
	bytes32 public constant CAST_VOTE_TYPEHASH =
		keccak256('CastVote(uint256 proposalId,bool support,address voterAddress)');

	/// @notice EIP-712 hashed domain name for this contract
	bytes32 private immutable NAME_HASH;

	/// @notice EIP-712 hashed domain version for this contract
	bytes32 private immutable VERSION_HASH;

	/// @notice EIP-712 cached domain separator for this contract
	bytes32 private immutable CACHED_SEPARATOR;

	/// @notice Cached chain ID for this contract
	uint256 private immutable CACHED_CHAIN_ID;

	/**
	 * @notice Construct a new CollectorDaoEIP712 contract
	 */
	constructor() {
		NAME_HASH = keccak256(bytes('Collector DAO'));
		VERSION_HASH = keccak256(bytes('1'));
		CACHED_SEPARATOR = _createDomainSeparator(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH);
		CACHED_CHAIN_ID = block.chainid;
	}

	/**
	 * @notice Validates an EIP-712 signed vote.
	 * @param proposalId Proposal ID being voted on.
	 * @param support Whether to support or reject the proposal.
	 * @param voterAddress Address of the voter.
	 * @param v v component of the signature.
	 * @param r r component of the signature.
	 * @param s s component of the signature.
	 */
	function _validateVoteSignature(
		uint256 proposalId,
		bool support,
		address voterAddress,
		uint8 v,
		bytes32 r,
		bytes32 s
	) internal view {
		bytes32 voteHashStruct = _getVoteHashStruct(proposalId, support, voterAddress);
		bytes32 voteHash = keccak256(abi.encodePacked('\x19\x01', _getEIP712DomainSeparator(), voteHashStruct));
		address signer = ecrecover(voteHash, v, r, s);
		if (signer != voterAddress) revert InvalidSignature();

		// Because we already track if someone already voted or not on a proposal, there is no need to keep track of signature nonces,
		// since a replay attack will be reverted with a "VoteAlreadyCast" error. The spec also does not specify strict ordering of
		// execution for delegated EIP-712 votes.
	}

	/**
	 * @notice Returns the EIP-712 domain separator for this contract. Rebuilds the separator if the chain ID has changed.
	 * @return EIP-712 domain separator for this contract.
	 */
	function _getEIP712DomainSeparator() private view returns (bytes32) {
		// If block.chainId remains the same as the cached separator, we can save gas by not re-computing the separator.
		// Remember that the ChainID can change in case there is a hard-fork on the network, and this check ensures the
		// EIP-712 Signature validation continues to work as expected in forked chains.
		if (CACHED_CHAIN_ID == block.chainid) {
			return CACHED_SEPARATOR;
		} else {
			return _createDomainSeparator(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH);
		}
	}

	/**
	 * @notice Returns the EIP-712 hash struct for a vote.
	 * @param proposalId Id of the proposal being voted on.
	 * @param support Whether to support or reject the proposal.
	 * @param voterAddress Address of the voter.
	 */
	function _getVoteHashStruct(uint256 proposalId, bool support, address voterAddress) private pure returns (bytes32) {
		return keccak256(abi.encode(CAST_VOTE_TYPEHASH, proposalId, support, voterAddress));
	}

	/**
	 * @notice Returns the EIP-712 domain separator for this contract.
	 * @param typeHash EIP-712 Domain TypeHash.
	 * @param nameHash EIP-712 Domain name hash.
	 * @param versionHash EIP-712 Domain version hash.
	 */
	function _createDomainSeparator(
		bytes32 typeHash,
		bytes32 nameHash,
		bytes32 versionHash
	) private view returns (bytes32) {
		return keccak256(abi.encode(typeHash, nameHash, versionHash, block.chainid, address(this)));
	}
}
