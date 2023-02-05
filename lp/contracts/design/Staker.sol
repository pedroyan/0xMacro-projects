//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../libraries/SafeERC20.sol';
import '../Ownable.sol';

// NOTE: This IS NOT part of the project and is simply here to be used as reference for the design
// of the staking contract. It is not audited, nor tested and should MOST DEFINITELY NOT be used in
// production in its current state.

contract StakerContract {
	using SafeERC20 for IERC20;

	error InvalidStake();
	error MinimumRewardNotMet();
	error RewardAlreadyClaimed();

	struct Staker {
		uint256 stakedliquidityBlocks;
		uint256 stakedLpTokens;
		bool claimedReward;
	}

	IERC20 public immutable lpToken;
	IERC20 public immutable rewardToken;
	uint256 public immutable stakingEndBlock;
	uint256 public immutable minimumReward;

	uint256 public lockedReward;
	uint256 public totalLiquidityBlocks;

	mapping(address => Staker) public stakers;

	modifier onlyWhenActive() {
		_;
	}

	modifier onlyWhenOver() {
		_;
	}

	constructor(IERC20 _lpToken, IERC20 _rewardToken, uint256 _minimumReward, uint256 _stakingDurationBlocks) {
		lpToken = _lpToken;
		rewardToken = _rewardToken;
		stakingEndBlock = block.number + _stakingDurationBlocks;
		minimumReward = _minimumReward;
	}

	// onlyWhenActive ensures staking period is still active
	function stake(uint256 _lpIn) external onlyWhenActive {
		// Ensures the contract has been funded with the minimum reward before accepting stakes
		if (rewardToken.balanceOf(address(this)) < minimumReward) {
			revert MinimumRewardNotMet();
		}

		// Calculate liquidity blocks for the staker
		uint256 _liquidityBlocks = _lpIn * (stakingEndBlock - block.number);
		if (_liquidityBlocks == 0) {
			revert InvalidStake();
		}

		// Increment liquidity blocks for the staker and the program
		Staker storage _staker = stakers[msg.sender];
		_staker.stakedLpTokens += _lpIn;
		_staker.stakedliquidityBlocks += _liquidityBlocks;
		totalLiquidityBlocks += _liquidityBlocks;

		// Transfer LP tokens to the contract and keep them locked until staking period is over
		lpToken.safeTransferFrom(msg.sender, address(this), _lpIn);
	}

	// onlyWhenOver ensures staking period is over
	function claimReward() external onlyWhenOver {
		// Lock the reward to be distributed as soon as the first staker claims it. This ensures
		// a fair distribution for everyone.
		if (lockedReward == 0) {
			lockedReward = rewardToken.balanceOf(address(this));
		}

		// Ensure the staker has not claimed the reward already
		Staker storage _staker = stakers[msg.sender];
		if (_staker.claimedReward) {
			revert RewardAlreadyClaimed();
		}

		// Calculate reward for the staker
		uint256 _reward = (_staker.stakedliquidityBlocks * lockedReward) / totalLiquidityBlocks;

		// Mark reward as claimed
		_staker.claimedReward = true;

		// Transfer reward to the staker
		rewardToken.safeTransfer(msg.sender, _reward);

		// Transfer back LP tokens to the staker
		lpToken.safeTransfer(msg.sender, _staker.stakedLpTokens);
	}
}
