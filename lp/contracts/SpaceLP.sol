//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './SpaceCoin.sol';
import './libraries/Math.sol';
import './libraries/SwapMath.sol';
import './libraries/SafeERC20.sol';

contract SpaceLP is ERC20 {
	using SafeERC20 for SpaceCoin;

	/**
	 * @notice Thrown when the contract is locked and a reentrant call is attempted.
	 */
	error ReentrancyLockEngaged();

	/**
	 * @notice Thrown when not enough liquidity is provided to the pool to mint new LP tokens.
	 */
	error InsufficientLiquidityMinted();

	/**
	 * @notice Thrown when not enough liquidity is provided to the pool to burn LP tokens.
	 */
	error InsufficientLiquidityBurned();

	/**
	 * @notice Thrown when an ETH transfer to a destination fails.
	 */
	error EthTransferFailed();

	/// @notice Unlocked status for the contract.
	uint256 private constant UNLOCKED = 1;

	/// @notice Locked status for the contract.
	uint256 private constant LOCKED = 2;

	/// @notice The current lock status of the contract. Uses a uint256 instead of bool to save on SSTORE gas costs.
	uint256 private lockStatus;

	/// @notice The SpaceCoin token contract.
	SpaceCoin immutable spaceCoin;

	/// @notice The current recognized ETH reserves in the pool.
	uint256 private ethReserve;

	/// @notice The current recognized SPC reserves in the pool.
	uint256 private spcReserve;

	/**
	 * @notice Emitted when liquidity is added to the pool.
	 * @param lpTokenReceiver The address that received the LP tokens.
	 * @param ethAmount The amount of ETH added to the pool.
	 * @param spcAmount The amount of SPC added to the pool.
	 * @param lpTokensMinted The amount of LP tokens minted.
	 */
	event LiquidityAdded(address indexed lpTokenReceiver, uint256 ethAmount, uint256 spcAmount, uint256 lpTokensMinted);

	/**
	 * @notice Emitted when liquidity is removed from the pool.
	 * @param tokenPairReceiver The address that received the ETH and SPC tokens.
	 * @param ethAmount The amount of ETH removed from the pool.
	 * @param spcAmount The amount of SPC removed from the pool.
	 * @param lpTokensBurned The amount of LP tokens burned.
	 */
	event LiquidityWithdrawn(
		address indexed tokenPairReceiver,
		uint256 ethAmount,
		uint256 spcAmount,
		uint256 lpTokensBurned
	);

	/**
	 * @notice Emitted when a swap is executed.
	 * @param assetsReceiver The address that received the output assets.
	 * @param amountIn The amount of input assets in the swap.
	 * @param amountOut The amount of output assets in the swap.
	 * @param isEthToSpc True if the swap is ETH to SPC, false if the swap is SPC to ETH.
	 */
	event Swap(address indexed assetsReceiver, uint256 amountIn, uint256 amountOut, bool isEthToSpc);

	/**
	 * @notice Constructs the SpaceLP contract.
	 * @param _spaceCoin The SpaceCoin token contract.
	 */
	constructor(SpaceCoin _spaceCoin) ERC20('SpaceLP', 'SPC-LP') {
		spaceCoin = _spaceCoin;
	}

	/**
	 * @notice Locks the contract to prevent reentrancy.
	 */
	modifier nonReentrant() {
		if (lockStatus == LOCKED) revert ReentrancyLockEngaged();
		lockStatus = LOCKED;
		_;
		lockStatus = UNLOCKED;
	}

	/**
	 * @notice Adds ETH-SPC liquidity to the pool.
	 * @dev Before this function is invoked, the trader must have sent ETH + SPC to the contract, preferably using the
	 * Router contract to atomically transfer the funds.
	 * @param to The address that will receive the LP tokens.
	 * @return The amount of LP tokens minted.
	 */
	function deposit(address to) external payable nonReentrant returns (uint256) {
		// Derive the amountIn of each asset by comparing current recognized reserves with the actual balance on each asset.
		// Any force-fed ETH or unrecognized SPC transfers will be considered donated to the Liquidity Pool as amountIn of
		// the current deposit.
		uint256 currentEthBalance = address(this).balance;
		uint256 currentSpcBalance = spaceCoin.balanceOf(address(this));
		uint256 ethAmountIn = currentEthBalance - ethReserve;
		uint256 spcAmountIn = currentSpcBalance - spcReserve;

		// Mint new LP tokens to the recipient.
		uint256 mintedLpTokens = _mintNewLpTokens(ethAmountIn, spcAmountIn, to);

		// Update reserves.
		ethReserve = currentEthBalance;
		spcReserve = currentSpcBalance;

		// Emit LiquidityAdded event.
		emit LiquidityAdded(to, ethAmountIn, spcAmountIn, mintedLpTokens);

		// Return the amount of LP tokens minted.
		return mintedLpTokens;
	}

	/**
	 * @notice Mints new LP Tokens to the recipient according to the provided amountIn of each asset.
	 * @return The amount of LP tokens minted.
	 */
	function _mintNewLpTokens(uint256 ethAmountIn, uint256 spcAmountIn, address to) private returns (uint256) {
		uint totalSupply = totalSupply();

		// Recognized reserves are not 0 when LP tokens were already issued to Liquidity Providers since
		// those providers already added assets to the pool. In this case, we issue new LP tokens proportional
		// to the amount of liquidity added.
		if (totalSupply > 0) {
			// The lowest ratio of amountIn:reserve will determine the amount of LP tokens to mint, incentivising
			// liquidity providers to always match the ratios on the liquidity pools. If one amountIn is provided
			// at a ratio higher than the other, the LP tokens will be issued at the lower liquidty ratio provided
			// and consider the excess donated.
			uint256 lpTokenToMint = Math.min(
				(ethAmountIn * totalSupply) / ethReserve,
				(spcAmountIn * totalSupply) / spcReserve
			);
			if (lpTokenToMint == 0) revert InsufficientLiquidityMinted();
			_mint(to, lpTokenToMint);
			return lpTokenToMint;
		}

		// If there are no LP tokens in circulation, we cannot issue new shares proportional to the added liquidity
		// because there is no basis for comparison (reserves will be 0 and ratio division will revert).

		// In this case, we take the geometric mean of the amounts deposited to determine the amount of LP tokens to issue.
		// this ensures that the value of a liquidity pool share at any time is essentially independent of the ratio at
		// which liquidity was initially deposited.

		// Discussed with Melville other alternatives for this calculation and decided to stick with the geometric mean due to
		// the ratio independence it provides and the fact it goes to 0 if any of the provided initial reserves are 0, which
		// reduces the cyclomatic complexity of the code. To see the full conversation, check the link below:
		// https://discord.com/channels/870313767873962014/1050534356806012978/1069695275934953514
		uint256 geometricMean = Math.sqrt(ethAmountIn * spcAmountIn);
		if (geometricMean == 0) {
			revert InsufficientLiquidityMinted();
		}

		// Before issuing the LP tokens, the Uniswap V2 contract burns 1000 units of shares to prevent attackers from inflating the
		// value the LP Share Unit (1e-18) and making it infeasible for small liquidity providers to provide any liquidity
		// to the pool. By burning a minimum liquidity, we increase the financial requirements to carry out the attack. In
		// this case, for an attacker to inflate the value of a single share to $100, they would need to take a $100,000
		// loss due to the locked shares. For a full explanation of the attack, check section 3.4 of the Uniswap V2 paper:
		// https://uniswap.org/whitepaper.pdf

		// Although the price of a single share unit can be inflated in this LP, Unlike Uniswap, the LP can be
		// redeployed by the community at any time if someone inflates the price of a single share unit
		// because there is no cannonical factory contract enforcing that only a single pair exists at a time.
		// See this conversation with Melville for more details on the discussion:
		// https://discord.com/channels/870313767873962014/1050534356806012978/1069711771998376047
		_mint(to, geometricMean);

		return geometricMean;
	}

	/**
	 * @notice Transfers ETH to the destination address. If the transfer fails, it reverts with a custom error.
	 */
	function _safeTransferEth(address to, uint256 value) private {
		// slither-disable-next-line arbitrary-send-eth | we want to allow transfers to destinations on swaps and withdrawals
		(bool success, bytes memory result) = to.call{value: value}('');
		if (!success) {
			if (result.length == 0) revert EthTransferFailed();

			// Bubble up the error up the callstack
			assembly {
				revert(add(32, result), mload(result))
			}
		}
	}

	/**
	 * @notice Returns ETH-SPC liquidity to liquidity provider.
	 * @param to The address that will receive the outbound token pair.
	 * @return (uint256, uint256) The amount of ETH and SPC withdrawn from the LP.
	 */
	function withdraw(address to) external nonReentrant returns (uint256, uint256) {
		uint256 sharesToWithdraw = balanceOf(address(this));
		uint256 totalShares = totalSupply();

		// Get the proportional amount of assets to withdraw from the reserves based on the amount
		// of shares provided for withdrawal. Donated assets will be included in the pro-rata
		// distribution
		uint256 ethBalance = address(this).balance;
		uint256 spcBalance = spaceCoin.balanceOf(address(this));

		uint256 ethToWithdraw = (ethBalance * sharesToWithdraw) / totalShares;
		uint256 spcToWithdraw = (spcBalance * sharesToWithdraw) / totalShares;

		if (ethToWithdraw == 0 || spcToWithdraw == 0) revert InsufficientLiquidityBurned();

		// Burns the LP Tokens.
		_burn(address(this), sharesToWithdraw);

		// Send assets to the withdraw address. Because this is a Swap operation, pull-over-push IS NOT used. We intentionally
		// want to send the assets to the destination in the same transaction as the swap.
		_safeTransferEth(to, ethToWithdraw);
		spaceCoin.safeTransfer(to, spcToWithdraw);

		// Update balances.
		ethReserve = address(this).balance;
		spcReserve = spaceCoin.balanceOf(address(this));

		// Emit LiquidityWithdrawn event.
		emit LiquidityWithdrawn(to, ethToWithdraw, spcToWithdraw, sharesToWithdraw);

		// Return withdrawn assets.
		return (ethToWithdraw, spcToWithdraw);
	}

	/**
	 * @notice Swaps ETH for SPC, or SPC for ETH.
	 * @param to The address that will receive the outbound SPC or ETH.
	 * @param isETHtoSPC Boolean indicating the direction of the trade.
	 * @return uint256 The amountOut of the swap.
	 */
	function swap(address to, bool isETHtoSPC) external payable nonReentrant returns (uint256) {
		// Swap assets according to the direction of the trade
		uint256 amountIn;
		uint256 amountOut;
		if (isETHtoSPC) {
			(amountIn, amountOut) = _swapEthToSpc(to);
		} else {
			(amountIn, amountOut) = _swapSpcToEth(to);
		}

		// Update reserves
		ethReserve = address(this).balance;
		spcReserve = spaceCoin.balanceOf(address(this));

		// Emit swap event
		emit Swap(to, amountIn, amountOut, isETHtoSPC);

		// Return amountOut
		return amountOut;
	}

	/**
	 * @notice Swaps ETH for SPC.
	 * @param to The address that will receive the outbound SPC.
	 * @return ethAmountIn The amount of ETH in.
	 * @return spcOut The amount of SPC out.
	 */
	function _swapEthToSpc(address to) private returns (uint256 ethAmountIn, uint256 spcOut) {
		uint256 currentEthBalance = address(this).balance;
		uint256 currentSpcBalance = spaceCoin.balanceOf(address(this));

		// Derive the amount of ETH in by subtracting the current ETH balance from the ETH reserve.
		ethAmountIn = currentEthBalance - ethReserve;

		// Solve the constant product formula for expected amount of SPC out. Here the current SPC balance
		// is used to incorporate unrecognized assets into the swap, which can happen if someone donate
		// assets without riggering a liquidity event that syncs the reserves.
		// Approach cleared with Instructions Team: https://discord.com/channels/870313767873962014/1068580094559408238/1070421739160473635
		spcOut = SwapMath.getMaximumAmountOut(ethAmountIn, ethReserve, currentSpcBalance);
		if (spcOut == 0) revert InsufficientLiquidity();

		// Safely send SPC to the recipient.
		spaceCoin.safeTransfer(to, spcOut);
	}

	/**
	 * @notice Swaps SPC for ETH.
	 * @param to The address that will receive the outbound ETH.
	 * @return spcAmountIn The amount of SPC in.
	 * @return ethOut The amount of ETH out.
	 */
	function _swapSpcToEth(address to) private returns (uint256 spcAmountIn, uint256 ethOut) {
		uint256 currentEthBalance = address(this).balance;
		uint256 currentSpcBalance = spaceCoin.balanceOf(address(this));

		// Derive the amount of ETH in by subtracting the current ETH balance from the ETH reserve.
		spcAmountIn = currentSpcBalance - spcReserve;

		// Solve the constant product formula for expected amount of ETH out. Just like in the SPC swap,
		// the current ETH balance is used to incorporate unrecognized assets into the swap.
		ethOut = SwapMath.getMaximumAmountOut(spcAmountIn, spcReserve, currentEthBalance);
		if (ethOut == 0) revert InsufficientLiquidity();

		// Safely send ETH to the recipient.
		_safeTransferEth(to, ethOut);
	}

	/**
	 * @notice Returns the ETH-SPC reserves.
	 * @return (uint256, uint256) The ETH and SPC reserves.
	 */
	function getReserves() public view returns (uint256, uint256) {
		return (ethReserve, spcReserve);
	}
}
