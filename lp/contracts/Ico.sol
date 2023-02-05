//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import './SpaceCoin.sol';
import './Ownable.sol';
import './libraries/SafeERC20.sol';

contract ICO is Ownable {
	using SafeERC20 for SpaceCoin;

	///@notice The phases of the ICO
	enum IcoPhase {
		SEED,
		GENERAL,
		OPEN
	}

	/**
	 * @notice thrown when a function is called in the wrong phase
	 * @param actualPhase the actual phase of the ICO
	 * @param expectedPhase the expected phase of the ICO for the function to be called
	 */
	error NotAllowedOnPhase(IcoPhase actualPhase, IcoPhase expectedPhase);

	/// @notice thrown when a phase transition is not valid (i.e: Backwards transitions, skipping phases, etc.)
	error InvalidTransition();

	/**
	 * @notice thrown when an investor tries to contribute to the ICO but is not in the SEED phase passlist.
	 * @param investor the address of the investor that attempted to make the contribution.
	 */
	error InvestorNotInPasslist(address investor);

	/**
	 * @notice thrown when an investor tries to contribute to the ICO but the contribution would exceed the individual
	 * limit for the Ico phase.
	 * @param investor the address of the investor that attempted to make the contribution.
	 * @param newTotal the total contribution amount the investor would have after the attempted contribution.
	 * @param limit the individual limit for the ICO phase.
	 */
	error IndividualLimitReached(address investor, uint256 newTotal, uint256 limit);

	/**
	 * @notice thrown when an investor tries to contribute to the ICO but the contribution would exceed the total limit
	 * for the phase.
	 * @param newTotal the total contribution amount the contract would have after the attempted contribution.
	 * @param limit the total contribution limit for the current ICO phase.
	 */
	error PhaseLimitReached(uint256 newTotal, uint256 limit);

	/**
	 * @notice thrown when an investor tries to redeem tokens but has no contributions left to redeem.
	 * @param investor the address of the investor that attempted to redeem tokens.
	 */
	error NothingToRedeem(address investor);

	///@notice thrown when an investor tries to make a contribution but the ICO Contributions are paused.
	error ContributionsPaused();

	///@notice thrown when an investor tries to redeem tokens but the Token Redemptions are paused.
	error RedemptionsPaused();

	///@notice Individual contribution limit applied to each investor on the SEED phase.
	uint128 public constant SEED_INDIVIDUAL_LIMIT = 1_500 ether;

	///@notice Total contribution limit for the SEED phase.
	uint128 public constant SEED_CONTRIBUTION_LIMIT = 15_000 ether;

	///@notice Individual contribution limit applied to each investor on the GENERAL phase.
	uint128 public constant GENERAL_INDIVIDUAL_LIMIT = 1_000 ether;

	///@notice Total contribution limit for the GENERAL and OPEN phase.
	uint128 public constant MAX_CONTRIBUTION_LIMIT = 30_000 ether;

	///@notice The SpaceCoin contract for this ICO
	SpaceCoin public immutable spaceCoin;

	///@notice Investors that are allowed to participate in the SEED round. Allowlist implemented as a Map to allow for
	// a O(1) lookup time and save on gas not iterating an array for SEED round contributions.
	mapping(address => bool) public seedInvestorsMap;

	///@notice The wei contribution amount for each investor. Total contribution value can only be increased.
	mapping(address => uint256) public totalContributionsMap;

	///@notice The amount of wei that was redeemed for SpaceCoin for each investor. Total redeemed value can only be increased.
	mapping(address => uint256) private redeemedWeiContributionsMap;

	///@notice The total wei contributions for the ICO, across all phases.
	uint256 public totalContributions;

	///@notice The current phase of the ICO
	IcoPhase public currentPhase;

	///@notice Flag indicating if contributions are paused
	bool public pauseContributions;

	///@notice Flag indicating if redemptions are paused
	bool public pauseRedemptions;

	/**
	 * @notice Event emitted when the ICO phase is changed.
	 * @param oldPhase the previous phase of the ICO.
	 * @param newPhase the new phase of the ICO.
	 */
	event PhaseChanged(IcoPhase oldPhase, IcoPhase newPhase);

	/**
	 * @notice Event emitted when an investor contributes to the ICO
	 * @param investor the address of the investor that contributed to the ICO.
	 * @param amount the amount of wei contributed by the investor.
	 * @param phase the phase of the ICO in which the contribution was made.
	 */
	event ContributionReceived(address indexed investor, uint256 amount, IcoPhase phase);

	/**
	 * @notice Event emitted when an investor redeems tokens for their contributions.
	 * @param investor the address of the investor that redeemed tokens.
	 * @param destination the address of the receiver of the redeemed tokens.
	 * @param amount the amount of tokens redeemed by the investor.
	 */
	event TokensRedeemed(address indexed investor, address indexed destination, uint256 amount);

	/**
	 * @notice Event emitted when the contributions are paused or unpaused
	 * @param newValue the new value of the pauseContributions flag.
	 */
	event PauseContributionsChanged(bool newValue);

	/**
	 * @notice Event emitted when the redemptions are paused or unpaused
	 * @param newValue the new value of the pauseRedemptions flag.
	 */
	event PauseRedemptionsChanged(bool newValue);

	/**
	 * @notice Creates a new ICO contract, alongside the underlying token.
	 * @param _treasury The address of the treasury that will receive the SpaceCoin minted during initialization.
	 * @param _seedInvestors The addresses of the investors that are allowed to participate in the SEED round of the ICO.
	 */
	constructor(address _treasury, address[] memory _seedInvestors) Ownable(msg.sender) {
		// Spacecoin initialized as part of the ICO initialization. This removes a single-point-of-failure of the setup process by atomically
		// setting up the ICO and SpaceCoin contracts in one go.
		spaceCoin = new SpaceCoin(_treasury, address(this), msg.sender);

		// Deployer pays O(n) gas to initialize the seed investors map. Investors pay O(1) gas to contribute.
		for (uint i = 0; i < _seedInvestors.length; i++) {
			seedInvestorsMap[_seedInvestors[i]] = true;
		}
	}

	/**
	 * @notice Modifier to check if the current ICO phase is the expected phase.
	 * @param _expectedPhase The expected phase.
	 */
	modifier requirePhase(IcoPhase _expectedPhase) {
		if (currentPhase != _expectedPhase) {
			revert NotAllowedOnPhase(currentPhase, _expectedPhase);
		}
		_;
	}

	/**
	 * @notice Receives a contribution from an investor. The contribution is only accepted if the investor is allowed
	 * to participate in the current phase and if inidividual and phase contribution limits are not reached.
	 */
	function contribute() external payable {
		if (pauseContributions) {
			revert ContributionsPaused();
		}

		emit ContributionReceived(msg.sender, msg.value, currentPhase);

		if (currentPhase == IcoPhase.SEED) {
			// Check if the investor is allowed to participate in the SEED round.
			if (!seedInvestorsMap[msg.sender]) {
				revert InvestorNotInPasslist(msg.sender);
			}

			return _contributeWithLimit(SEED_CONTRIBUTION_LIMIT, SEED_INDIVIDUAL_LIMIT);
		}

		if (currentPhase == IcoPhase.GENERAL) {
			return _contributeWithLimit(MAX_CONTRIBUTION_LIMIT, GENERAL_INDIVIDUAL_LIMIT);
		}

		_contributeWithLimit(MAX_CONTRIBUTION_LIMIT);
	}

	/**
	 * @notice Advances the ICO phase. Only the owner can call this function. The new phase must be the next phase in the
	 * sequence. For example, if the current phase is SEED, the new phase can only be GENERAL.
	 * @param _newPhase The new phase to advance to.
	 */
	function advancePhase(IcoPhase _newPhase) external onlyOwner {
		if (uint256(_newPhase) != uint256(currentPhase) + 1) {
			revert InvalidTransition();
		}

		emit PhaseChanged(currentPhase, _newPhase);

		currentPhase = _newPhase;
	}

	/**
	 * @notice Redeems the SpaceCoin for the caller at a 1:5 redemption rate. The caller must have contributed to the ICO and have unredeemed
	 * tokens available for the call to succeed. Tokens redeemed in this call are sent to the caller's address.
	 */
	function redeemTokens() external requirePhase(IcoPhase.OPEN) {
		_redeemTokens(msg.sender);
	}

	/**
	 * @notice Redeems the SpaceCoin for the caller at a 1:5 redemption rate. The caller must have contributed to the ICO and have unredeemed
	 * tokens available for the call to succeed. Tokens redeemed in this call are sent to the provided address.
	 * @param _receiver The address to send the redeemed tokens to.
	 */
	function redeemTokensTo(address _receiver) external requirePhase(IcoPhase.OPEN) {
		_redeemTokens(_receiver);
	}

	/**
	 * @notice Pauses or unpauses contributions. Only the owner can call this function. Reverts if the flag is already set to the provided value
	 * to prevent unnecessary gas consumption via wallet reversion warnings and avoid emitting events.
	 * @param _pauseContributions True to pause contributions, false to unpause.
	 */
	function setPauseContributions(bool _pauseContributions) external onlyOwner {
		if (pauseContributions == _pauseContributions) {
			revert FlagUnchanged(_pauseContributions);
		}
		pauseContributions = _pauseContributions;
		emit PauseContributionsChanged(_pauseContributions);
	}

	/**
	 * @notice Pauses or unpauses redemptions. Only the owner can call this function. Reverts if the flag is already set to the provided value
	 * to prevent unnecessary gas consumption via wallet reversion warnings and avoid emitting events.
	 * @param _pauseRedemptions True to pause redemptions, false to unpause.
	 */
	function setPauseRedemptions(bool _pauseRedemptions) external onlyOwner {
		if (pauseRedemptions == _pauseRedemptions) {
			revert FlagUnchanged(_pauseRedemptions);
		}
		pauseRedemptions = _pauseRedemptions;
		emit PauseRedemptionsChanged(_pauseRedemptions);
	}

	function withdraw() external onlyOwner requirePhase(IcoPhase.OPEN) {
		// All contributed ETH, included force-fed ETH, should be sent to the treasury when this function is invoked.
		payable(spaceCoin.treasury()).transfer(address(this).balance);
	}

	/**
	 * @notice Redeems the SpaceCoin for the caller at a 1:5 redemption rate. The caller must have contributed to the ICO and have unredeemed
	 * tokens available for the call to succeed. Tokens redeemed in this call are sent to the provided address.
	 * @param _receiver The address to send the redeemed tokens to.
	 */
	function _redeemTokens(address _receiver) private {
		if (pauseRedemptions) {
			revert RedemptionsPaused();
		}

		// Check if the investor has contributed to the ICO.
		uint256 weiContributed = totalContributionsMap[msg.sender];
		if (weiContributed == 0) {
			revert NothingToRedeem(msg.sender);
		}

		// Check if the investor has not redeemed all their tokens yet.
		uint256 weiRedeemed = redeemedWeiContributionsMap[msg.sender];
		if (weiRedeemed == weiContributed) {
			revert NothingToRedeem(msg.sender);
		}

		// Calculate the amount of tokens to redeem.
		uint256 weiToRedeem = weiContributed - weiRedeemed;
		uint256 tokensToRedeem = weiToRedeem * 5; // 1:5 ratio

		// Update the redeemed amount for the investor.
		redeemedWeiContributionsMap[msg.sender] = weiContributed;

		// Transfer the tokens to the receiver.
		emit TokensRedeemed(msg.sender, _receiver, tokensToRedeem);
		spaceCoin.safeTransfer(_receiver, tokensToRedeem);
	}

	/**
	 * @notice Process a contribution from the current sender, taking into account the current phase limits.
	 * @param _phaseLimit The limit for the current phase.
	 */
	function _contributeWithLimit(uint256 _phaseLimit) private {
		_contributeWithLimit(_phaseLimit, type(uint256).max);
	}

	/**
	 * @notice Process a contribution from the current sender, taking into account the current phase limits and individual limits.
	 * @param _phaseLimit The limit for the current phase.
	 * @param _individualLimit The individual limit for each investor in the current phase.
	 */
	function _contributeWithLimit(uint256 _phaseLimit, uint256 _individualLimit) private {
		// Check if the investor has not exceeded the individual contribution limit.
		uint256 newInvestorTotal = totalContributionsMap[msg.sender] + msg.value;
		if (newInvestorTotal > _individualLimit) {
			revert IndividualLimitReached(msg.sender, newInvestorTotal, _individualLimit);
		}

		// Check if the total contribution limit has not been exceeded.
		uint256 newContributionTotal = totalContributions + msg.value;
		if (newContributionTotal > _phaseLimit) {
			revert PhaseLimitReached(newContributionTotal, _phaseLimit);
		}

		// Update the total contribution for the investor.
		totalContributionsMap[msg.sender] = newInvestorTotal;

		// Update the total contribution for the ICO.
		totalContributions = newContributionTotal;
	}
}
