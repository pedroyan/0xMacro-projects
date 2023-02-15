//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title EIP712Airdrop
 * @author Pedro Yan
 * @notice A contract for EIP-712 signatures logic of the MACRO airdrop.
 */
abstract contract EIP712Airdrop is Ownable {
	/// @notice the EIP712 domain separator for claiming MACRO
	bytes32 public immutable EIP712_DOMAIN;

	/// @notice EIP-712 typehash for claiming MACRO
	bytes32 public constant CLAIM_TYPEHASH = keccak256('Claim(address claimer,uint256 amount)');

	/**
	 * @notice true if a claimer is able to call `Airdrop.signatureClaim` without reverting, false otherwise. False by default
	 * @dev We could call this `isECDSAEnabled`, but then we would waste gas first setting it to true, only later to set it to
	 * false. With the current variable name we only use a single SSTORE going from false -> true
	 */
	bool public isECDSADisabled;

	/**
	 * @notice The address whose private key will create all the signatures which claimers can use to claim their airdropped
	 * tokens
	 */
	address public immutable signer;

	struct SignedClaim {
		address claimer;
		uint256 amount;
		uint8 v;
		bytes32 r;
		bytes32 s;
	}

	/**
	 * @notice Emitted when `isECDSADisabled` is disabled by the owner.
	 * @param owner The owner of the contract.
	 */
	event ECDSADisabled(address owner);

	/**
	 * @notice Thrown when a claimer attempts to claim MACRO tokens using a signature, but the `Airdrop.isECDSADisabled` flag
	 * is disabled.
	 */
	error SignatureClaimsDisabled();

	/**
	 * @notice Thrown when a claimer attempts to claim MACRO tokens using a signature, but the signature is invalid.
	 */
	error InvalidSignature();

	/**
	 * @notice Thrown when a claimer attempts to claim MACRO tokens using a signature, but the claimer is not the
	 * in the signature is not the msg.sender.
	 * @param expectedClaimant The address which is expected to be the msg.sender.
	 * @param actualClaimant The address which is actually the msg.sender.
	 */
	error InvalidClaimant(address expectedClaimant, address actualClaimant);

	/**
	 * @notice Constructs the EIP712Airdrop contract.
	 * @param _signer The address whose private key will create all the signatures which claimers can use to claim their airdropped tokens
	 */
	constructor(address _signer) {
		EIP712_DOMAIN = keccak256(
			abi.encode(
				keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
				keccak256(bytes('Airdrop')),
				keccak256(bytes('v1')),
				block.chainid,
				address(this)
			)
		);

		signer = _signer;
	}

	/**
	 * @notice Disables ECDSA signature verification for the `Airdrop.signatureClaim` function, causing it to revert.
	 * @dev Should be called when the owner learns offchain that quantum computers have advanced to the point of breaking ECDSA,
	 * and thus the `Airdrop.signatureClaim` function is insecure.
	 */
	function disableECDSAVerification() external onlyOwner {
		isECDSADisabled = true;
		emit ECDSADisabled(msg.sender);
	}

	/**
	 * @notice Validates a signed claim, and returns the claimer and amount to be claimed.
	 * @param _claim The signed claim struct
	 * @return address The address which will claim the MACRO tokens.
	 * @return uint256 The amount of MACRO to be claimed.
	 */
	function _validateSignedClaim(SignedClaim calldata _claim) internal view returns (address, uint256) {
		// Ensure ECDSA Signatures are enabled
		if (isECDSADisabled) revert SignatureClaimsDisabled();

		// Validate signature
		address _claimer = _claim.claimer;
		uint256 _amount = _claim.amount;
		bytes32 _claimHash = _toTypedDataHash(_claimer, _amount);
		address _recoveredAddress = ECDSA.recover(_claimHash, _claim.v, _claim.r, _claim.s);

		if (_recoveredAddress != signer) revert InvalidSignature();

		// Ensure that the claimant is the msg.sender
		if (_claimer != msg.sender) revert InvalidClaimant(_claimer, msg.sender);

		return (_claimer, _amount);
	}

	/**
	 * @dev Helper function for formatting the claimer data in an EIP-712 compatible way.
	 * @param _claimer The address which will claim the MACRO tokens.
	 * @param _amount The amount of MACRO to be claimed.
	 */
	function _toTypedDataHash(address _claimer, uint256 _amount) internal view returns (bytes32) {
		bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, _claimer, _amount));
		return ECDSA.toTypedDataHash(EIP712_DOMAIN, structHash);
	}
}
