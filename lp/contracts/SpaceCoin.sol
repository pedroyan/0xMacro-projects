//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './Ownable.sol';

error FlagUnchanged(bool value);

contract SpaceCoin is ERC20, Ownable {
	///@notice The transfer fee in basis points
	uint256 public constant TRANSFER_FEE_BPS = 200;

	///@notice The address of the SpaceCoin treasury
	address public immutable treasury;

	///@notice Flag indicating if a 2% tax on transfers is in effect
	bool public taxTransfers;

	///@notice Event emitted when transfer taxes are enabled/disabled
	event TaxToggled(bool taxTransfers);

	/// @notice Event emitted when the contract is properly initialized
	event Initialized();

	/**
	 * @notice Creates a SpaceCoin contract
	 * @param _treasury The address of the SpaceCoin treasury, used to collect transfer fees and get part of the minted initial supply.
	 * @param _icoContract The address of the ICO contract, used get part of the minted initial supply.
	 * @param _owner The address of the contract owner, used to set the initial transfer tax status.
	 */
	constructor(address _treasury, address _icoContract, address _owner) Ownable(_owner) ERC20('SpaceCoin', 'SPC') {
		treasury = _treasury;
		// Once the contract is properly initialized, mint the fixed supply to treasury and ICO contract
		_mint(treasury, 350_000 * 10 ** decimals());
		_mint(_icoContract, 150_000 * 10 ** decimals());
	}

	/**
	 * @notice Sets the transfer tax status. Reverts if the flag is already set to the provided value
	 * to prevent unnecessary gas consumption via wallet reversion warnings and avoid emitting events.
	 * @param _taxTransfers Flag indicating if a 2% tax on transfers is in effect
	 */
	function setTaxTransfers(bool _taxTransfers) external onlyOwner {
		if (_taxTransfers == taxTransfers) {
			revert FlagUnchanged(_taxTransfers);
		}
		taxTransfers = _taxTransfers;
		emit TaxToggled(_taxTransfers);
	}

	/**
	 * @dev Moves `amount` of tokens from `from` to `to`.
	 *
	 * This internal function is equivalent to {transfer}, and can be used to
	 * e.g. implement automatic token fees, slashing mechanisms, etc.
	 *
	 * Emits a {Transfer} event.
	 *
	 * Requirements:
	 *
	 * - `from` cannot be the zero address.
	 * - `to` cannot be the zero address.
	 * - `from` must have a balance of at least `amount`.
	 */
	function _transfer(address _sender, address _recipient, uint256 _amount) internal virtual override {
		if (taxTransfers) {
			(uint256 _fee, uint256 _netAmount) = _calculateFee(_amount);
			super._transfer(_sender, treasury, _fee);
			super._transfer(_sender, _recipient, _netAmount);
		} else {
			super._transfer(_sender, _recipient, _amount);
		}
		// return true;
	}

	/**
	 * @dev Calculates the transfer fee and net amount
	 * @param _amount The amount to be transferred
	 * @return _fee The transfer fee sent to the treasury
	 * @return _netAmount The net amount to be transferred to the destination
	 */
	function _calculateFee(uint256 _amount) private pure returns (uint256, uint256) {
		uint256 _fee = (_amount * TRANSFER_FEE_BPS) / 10_000;
		uint256 _netAmount = _amount - _fee;
		return (_fee, _netAmount);
	}
}
