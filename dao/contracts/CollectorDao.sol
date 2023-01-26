// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import './INftMarketplace.sol';
import './CollectorDaoEIP712.sol';

/**
 * @title CollectorDao
 * @author Pedro Yan
 * @notice Contract that governs the CollectorDAO.
 */
contract CollectorDao is CollectorDaoEIP712 {
	/**
	 * @notice A CollectorDao Member.
	 */
	struct DaoMember {
		/// @notice The proposal number at which this member joined the DAO.
		uint64 joinedAtProposalNumber;
		/// @notice The voting power of this member.
		uint64 votingPower;
	}

	/**
	 * @notice A proposal created by a member.
	 */
	struct Proposal {
		/// @notice The number of this proposal
		uint64 proposalNumber;
		/// @notice The timestamp of when the voting period will end for this proposal.
		uint64 voteEndTimestamp;
		/// @notice The number of votes in favor of this proposal. Measured in voting power.
		uint64 yesVotes;
		/// @notice The number of votes against this proposal. Measured in voting power.
		uint64 noVotes;
		/// @notice The minimum number of individual member votes required for a proposal to be finalized.
		uint64 quorum;
		/// @notice The total number of individual votes cast in this proposal. Each member gets 1 member vote.
		uint64 totalMemberVotes;
		/// @notice Flag indicating if the proposal has been executed.
		bool executed;
		/// @notice Address of the proposer of this proposal.
		address proposer;
	}

	/**
	 * @notice An vote signed by a member off-chain using EIP-712.
	 */
	struct Eip712Vote {
		/// @notice The proposal number for which this vote is being cast.
		uint256 proposalId;
		/// @notice The address of the member who is casting this vote.
		address voterAddress;
		/// @notice The vote being cast.
		bool support;
		/// @notice v component of the signature.
		uint8 v;
		/// @notice r component of the signature.
		bytes32 r;
		/// @notice s component of the signature.
		bytes32 s;
	}

	/**
	 * @notice Thrown when a member attempts to purchase a membership with an invalid purchase price.
	 */
	error InvalidMembershipPurchase();

	/**
	 * @notice Thrown when a member attempts to purchase a membership when they are already a member.
	 * @param caller The address of the caller.
	 */
	error AlreadyAMember(address caller);

	/**
	 * @notice Thrown when a non-member caller attempts to perform an action that is only allowed to members.
	 * @param caller The address of the caller.
	 */
	error NotAMember(address caller);

	/**
	 * @notice Thrown when proposal argument arrays do not have the same length.
	 */
	error MismatchedProposalArgs();

	/**
	 * @notice Thrown when an empty proposal is submitted to the DAO.
	 */
	error EmptyProposal();

	/**
	 * @notice Thrown when a proposal is submitted to the DAO with an identical ID of a previous proposal.
	 * @param proposalId The ID of the proposal that was submitted.
	 */
	error DuplicateProposal(uint256 proposalId);

	/**
	 * @notice Thrown when a caller is not authorized to perform a certain action.
	 */
	error Unauthorized();

	/**
	 * @notice Thrown when a member attempts to purchase an NFT that has a price higher than the proposal's maximum acceptable price.
	 */
	error NftPriceTooHigh();

	/**
	 * @notice Thrown when a member attempts to cast a vote after the voting period has ended.
	 * @param proposalId The ID of the proposal that the member attempted to vote on.
	 */
	error VotingPeriodEnded(uint256 proposalId);

	/**
	 * @notice Thrown when a member attempts to cast a vote for a proposal that they have already voted on.
	 * @param voter The address of the member who attempted to vote again.
	 * @param proposalId The ID of the proposal that the member attempted to vote on.
	 */
	error VoteAlreadyCast(address voter, uint256 proposalId);

	/**
	 * @notice Thrown when a member attempts to cast a vote for a proposal that they joined after its creation.
	 * @param voter The address of the member who attempted to vote.
	 * @param proposalId The ID of the proposal that the member attempted to vote on.
	 */
	error JoinedAfterProposal(address voter, uint256 proposalId);

	/**
	 * @notice Thrown when a member attempts to cast a vote for a proposal that does not exist.
	 * @param proposalId The ID of the proposal that the member attempted to vote on.
	 */
	error ProposalDoesNotExist(uint256 proposalId);

	/**
	 * @notice Thrown when a caller attempts to execute a proposal before the voting period has ended.
	 * @param proposalId The ID of the proposal that the caller attempted to execute.
	 */
	error VotingPeriodStillActive(uint256 proposalId);

	/**
	 * @notice Thrown when a caller attempts to execute a proposal that does not have a quorum of votes.
	 * @param proposalId The ID of the proposal that the caller attempted to execute.
	 * @param quorum The minimum number of votes required for a proposal to be executed.
	 * @param votingMembers The number of members who voted on the proposal.
	 */
	error QuorumNotReached(uint256 proposalId, uint256 quorum, uint256 votingMembers);

	/**
	 * @notice Thrown when a caller attempts to execute a proposal that does not have enough yes votes to pass.
	 * @param proposalId The ID of the proposal that the caller attempted to execute.
	 * @param yesVotes The number of yes votes on the proposal.
	 * @param noVotes The number of no votes on the proposal.
	 */
	error MajorityNotReached(uint256 proposalId, uint256 yesVotes, uint256 noVotes);

	/**
	 * @notice Thrown when a caller attempts to execute a proposal that has already been executed.
	 * @param proposalId The ID of the proposal that the caller attempted to execute.
	 */
	error ProposalAlreadyExecuted(uint256 proposalId);

	/**
	 * @notice Thrown when a proposal execution fails.
	 * @param proposalId The ID of the proposal that the caller attempted to execute.
	 * @param callIndex The index of the call in the proposal that failed.
	 */
	error ProposalExecutionFailed(uint256 proposalId, uint256 callIndex);

	/**
	 * @notice Thrown when a proposal execution reward transfer to the executor fails.
	 * @param proposalId The ID of the proposal that the caller attempted to execute.
	 * @param executor The address of the proposal executor.
	 */
	error ExecutionRewardTransferFailed(uint256 proposalId, address executor);

	/// @notice The DAO's membership price,
	uint256 constant MEMBERSHIP_PRICE = 1 ether;

	/// @notice The voting period for a proposal.
	uint64 constant VOTING_PERIOD = 7 days;

	/// @dev The execution reward provided for executors of approved proposals.
	uint256 constant EXECUTION_REWARD = 0.01 ether;

	/// @dev The minimum amount of ETH that must be held within the DAO for the execution rewards to be issued.
	uint256 constant EXECUTION_REWARD_THRESHOLD = 5 ether;

	// Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
	bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;

	/// @notice Quorum is 25% of the the currently existing members.
	uint8 constant VOTING_QUORUM_DIVISOR = 4;

	/// @notice The latest proposal number
	uint64 public latestProposalNumber;

	/// @notice The number of currently active members in the DAO.
	uint64 public memberCount;

	/// @notice Map of addresses to their corresponding membership.
	mapping(address => DaoMember) public members;

	/// @notice Mapping of proposal ID => Proposal
	mapping(uint256 => Proposal) public proposals;

	/// @notice Mapping of Member Address => Proposal Hash => Has voted. Used to track if a given member already voted for a proposal.
	mapping(address => mapping(uint256 => bool)) private votes;

	/**
	 * @notice Event emitted when a new membership is purchased.
	 * @param member address of the member that acquired a membership
	 */
	event MembershipPurchased(address indexed member);

	/**
	 * @notice Event emitted when a new proposal is created.
	 * @param proposer address of the member that created the proposal.
	 * @param proposalId ID of the proposal.
	 * @param proposalNumber Number of the proposal.
	 * @param targets addresses that will be called in the proposal.
	 * @param values ETH values that will be sent with the calls.
	 * @param calldatas calldata that will be sent with the calls.
	 * @param description description of the proposal.
	 * @param voteEndTimestamp timestamp when the voting period ends.
	 * @param quorum minimum number of votes required for the proposal to be executed.
	 */
	event ProposalCreated(
		address indexed proposer,
		uint256 proposalId,
		uint64 proposalNumber,
		address[] targets,
		uint256[] values,
		bytes[] calldatas,
		string description,
		uint256 voteEndTimestamp,
		uint256 quorum
	);

	/**
	 * @notice Event emitted when a member votes on a proposal.
	 * @param voter address of the member that voted.
	 * @param proposalId ID of the proposal.
	 * @param support whether the member voted for or against the proposal.
	 * @param votingPower the voting power of the member.
	 */
	event VoteCast(address indexed voter, uint256 indexed proposalId, bool support, uint256 votingPower);

	/**
	 * @notice Event emitted when a proposal is executed.
	 * @param proposalId ID of the proposal.
	 * @param executor address of the member that executed the proposal.
	 */
	event ProposalExecuted(uint256 indexed proposalId, address indexed executor);

	/**
	 * @notice Modifier that reverts if the caller is not the DAO itself.
	 */
	modifier onlyDAO() {
		if (msg.sender != address(this)) {
			revert Unauthorized();
		}
		_;
	}

	/**
	 * @notice Allows a caller to purchase a membership. Membership can only be purchased if the sender is not
	 * already a member and costs 1 ETH. The purchase will only be accepted if the value sent is exactly 1 ETH.
	 */
	function purchaseMembership() external payable {
		// Membership can only be acquired for exactly 1 ETH.
		if (msg.value != MEMBERSHIP_PRICE) {
			revert InvalidMembershipPurchase();
		}

		// Membership can only be acquired if the sender is not already a member.
		if (members[msg.sender].votingPower > 0) {
			revert AlreadyAMember(msg.sender);
		}

		// Create new member
		members[msg.sender] = DaoMember({joinedAtProposalNumber: latestProposalNumber, votingPower: 1});
		memberCount++;
	}

	/**
	 * @notice Receives a new proposal from DAO Members.
	 * @param targets addresses that will be called in the proposal.
	 * @param values ETH values that will be sent with the calls.
	 * @param calldatas calldata that will be sent with the calls.
	 * @param description description of the proposal.
	 */
	function propose(
		address[] calldata targets,
		uint256[] calldata values,
		bytes[] calldata calldatas,
		string calldata description
	) external returns (uint256) {
		// Only existing members can add new proposals
		_getExistingMember(msg.sender);

		// All arrays must have the same length
		if (targets.length != values.length || targets.length != calldatas.length) {
			revert MismatchedProposalArgs();
		}

		// Proposals must have at least one action
		if (targets.length == 0) {
			revert EmptyProposal();
		}

		// Hash proposal and see if it already exists
		uint256 proposalId = hashProposal(targets, values, calldatas, keccak256(bytes(description)));
		Proposal storage proposal = proposals[proposalId];

		// If it does, revert the transaction indicating a duplicate
		if (proposal.voteEndTimestamp > 0) {
			revert DuplicateProposal(proposalId);
		}

		// If not, create new proposal
		proposal.proposalNumber = ++latestProposalNumber;
		proposal.voteEndTimestamp = uint64(block.timestamp + VOTING_PERIOD);
		proposal.quorum = _getCurrentQuorum();
		proposal.proposer = msg.sender;

		// Emit an event for off-chain indexing of proposals
		emit ProposalCreated(
			msg.sender,
			proposalId,
			proposal.proposalNumber,
			targets,
			values,
			calldatas,
			description,
			proposal.voteEndTimestamp,
			proposal.quorum
		);

		return proposalId;
	}

	/**
	 * @notice Allows a member to vote on a proposal.
	 * @param proposalId ID of the proposal.
	 * @param support whether the member voted for or against the proposal.
	 */
	function castVote(uint256 proposalId, bool support) external {
		_castVote(proposalId, support, msg.sender);
	}

	/**
	 * @notice Allows the caller to vote on behalf of a member on a proposal via an EIP712 signed structure.
	 * @param vote EIP712 Signed vote.
	 */
	function castEip712Vote(Eip712Vote calldata vote) external {
		_castEip712Vote(vote);
	}

	/**
	 * @notice Allows the caller cast multiple votes on behalf of members via an array of EIP712 signed structures.
	 * @param eipVotes Array of EIP712 Signed votes.
	 */
	function castEip712Votes(Eip712Vote[] calldata eipVotes) external {
		for (uint256 i = 0; i < eipVotes.length; i++) {
			_castEip712Vote(eipVotes[i]);
		}
	}

	/**
	 * @notice Allows a caller to execute a proposal. Only proposals that have a "yes" majority, suficient quorum,
	 * and have passed the voting period can be executed. The proposal will be executed atomically, meaning that
	 * if any action fails, the entire proposal will be reverted. The proposer will receive a reward of 0.01 ETH
	 * for successfully executing a proposal if the DAO's balance is greater than 5 ETH after the execution of
	 * the proposal.
	 * @param targets addresses that will be called in the proposal.
	 * @param values ETH values that will be sent with the calls.
	 * @param calldatas calldata that will be sent with the calls.
	 * @param descriptionHash keccak256 hash of the proposal description.
	 */
	function execute(
		address[] calldata targets,
		uint256[] calldata values,
		bytes[] calldata calldatas,
		bytes32 descriptionHash
	) external returns (uint256) {
		uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
		Proposal storage proposal = _getExistingProposal(proposalId);

		// Voting period must be over
		if (proposal.voteEndTimestamp > block.timestamp) {
			revert VotingPeriodStillActive(proposalId);
		}

		// Quorum must be reached
		if (proposal.totalMemberVotes < proposal.quorum) {
			revert QuorumNotReached(proposalId, proposal.quorum, proposal.totalMemberVotes);
		}

		// There need to exist more yes votes than no votes
		if (proposal.yesVotes <= proposal.noVotes) {
			revert MajorityNotReached(proposalId, proposal.yesVotes, proposal.noVotes);
		}

		// Check if proposal was already executed
		if (proposal.executed) {
			revert ProposalAlreadyExecuted(proposalId);
		}

		// Mark proposal as executed
		proposal.executed = true;

		// Increase the voting power of the proposer
		members[proposal.proposer].votingPower++;

		emit ProposalExecuted(proposalId, msg.sender);

		// Execute proposal
		for (uint256 i = 0; i < targets.length; i++) {
			// slither-disable-next-line arbitrary-send-eth | we want to allow anything to be executed via proposals approved by the DAO Members
			(bool success, ) = targets[i].call{value: values[i]}(calldatas[i]);
			if (!success) {
				revert ProposalExecutionFailed(proposalId, i);
			}
		}

		// Check if balance is sufficient to issue execution reward. We intentionally check "this.balance" because we
		// want to evaluate 5 ETH against the current balance of the DAO contract, regardless of where the ETH comes.
		// Even force-fed ETH should be considered for the reward to create further execution incentives for executors.
		if (address(this).balance >= EXECUTION_REWARD_THRESHOLD) {
			// Transfer execution reward to the executor
			// slither-disable-next-line arbitrary-send-eth | we want to allow any executor to receive the execution reward
			(bool success, ) = msg.sender.call{value: EXECUTION_REWARD}('');
			if (!success) {
				revert ExecutionRewardTransferFailed(proposalId, msg.sender);
			}
		}

		return proposalId;
	}

	/**
	 * Computes the hash of a proposal.
	 * @param targets addresses that will be called in the proposal.
	 * @param values ETH values that will be sent with the calls.
	 * @param calldatas calldata that will be sent with the calls.
	 * @param descriptionHash keccak256 hash of the proposal description.
	 * @return Hash of the proposal, which is used as the ProposalId.
	 */
	function hashProposal(
		address[] calldata targets,
		uint256[] calldata values,
		bytes[] calldata calldatas,
		bytes32 descriptionHash
	) public pure returns (uint256) {
		return uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));
	}

	/**
	 * @notice Receives ETH sent to the DAO.
	 * @custom:macro Function was cleared with the instruction team
	 * (https://discord.com/channels/870313767873962014/1066044058109222942/1067956960919552001)
	 */
	receive() external payable {}

	/**
	 * @notice Casts a vote using an EIP712 signed vote.
	 * @param vote EIP712 signed vote.
	 */
	function _castEip712Vote(Eip712Vote calldata vote) private {
		_validateVoteSignature(vote.proposalId, vote.support, vote.voterAddress, vote.v, vote.r, vote.s);
		_castVote(vote.proposalId, vote.support, vote.voterAddress);
	}

	/**
	 * @notice Casts a vote for a given voter.
	 * @param proposalId Id of the proposal to vote on.
	 * @param support Whether to support the proposal or not.
	 * @param voterAddress Address of the voter.
	 */
	function _castVote(uint256 proposalId, bool support, address voterAddress) private {
		DaoMember storage member = _getExistingMember(voterAddress);
		Proposal storage proposal = _getExistingProposal(proposalId);

		// Member must have joined before the proposal was created to be able to vote on it
		if (member.joinedAtProposalNumber >= proposal.proposalNumber) {
			revert JoinedAfterProposal(voterAddress, proposalId);
		}

		// Voting period must still be active for votes to be cast
		if (proposal.voteEndTimestamp < block.timestamp) {
			revert VotingPeriodEnded(proposalId);
		}

		// Member can only vote once per proposal
		if (votes[voterAddress][proposalId]) {
			revert VoteAlreadyCast(voterAddress, proposalId);
		}

		// Record vote
		uint64 votingPower = member.votingPower;
		votes[voterAddress][proposalId] = true;
		proposal.totalMemberVotes++;
		if (support) {
			proposal.yesVotes += votingPower;
		} else {
			proposal.noVotes += votingPower;
		}

		emit VoteCast(voterAddress, proposalId, support, votingPower);
	}

	/// @notice Purchases an NFT for the DAO
	/// @param marketplace The address of the INftMarketplace
	/// @param nftContract The address of the NFT contract to purchase
	/// @param nftId The token ID on the nftContract to purchase
	/// @param maxPrice The price above which the NFT is deemed too expensive
	/// and this function call should fail
	function buyNFTFromMarketplace(
		INftMarketplace marketplace,
		address nftContract,
		uint256 nftId,
		uint256 maxPrice
	) external payable onlyDAO {
		if (marketplace.getPrice(nftContract, nftId) > maxPrice) {
			revert NftPriceTooHigh();
		}

		marketplace.buy{value: msg.value}(nftContract, nftId);
	}

	/**
	 * @notice Computes the current quorum.
	 * @return Current quorum, which is a round-up division of the member count by VOTING_QUORUM_DIVISOR.
	 */
	function _getCurrentQuorum() private view returns (uint64) {
		return memberCount == 0 ? 0 : (memberCount - 1) / VOTING_QUORUM_DIVISOR + 1;
	}

	/**
	 * @notice Get the member with the given address. Reverts if the member does not exist.
	 * @param memberAddress Address of the member.
	 * @return Member with the given address.
	 */
	function _getExistingMember(address memberAddress) private view returns (DaoMember storage) {
		DaoMember storage member = members[memberAddress];

		if (member.votingPower == 0) {
			revert NotAMember(memberAddress);
		}

		return member;
	}

	/**
	 * @notice Get the proposal with the given id. Reverts if the proposal does not exist.
	 * @param proposalId Id of the proposal to get.
	 * @return Proposal with the given id.
	 */
	function _getExistingProposal(uint256 proposalId) private view returns (Proposal storage) {
		Proposal storage proposal = proposals[proposalId];

		if (proposal.voteEndTimestamp == 0) {
			revert ProposalDoesNotExist(proposalId);
		}

		return proposal;
	}

	/**
	 * @notice Implementation of the ERC721TokenReceiver interface of the EIP-712 standard.
	 */
	function onERC721Received(address, address, uint256, bytes memory) public pure returns (bytes4) {
		return _ERC721_RECEIVED;
	}
}
