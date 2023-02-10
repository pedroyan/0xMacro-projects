// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import '../CollectorDao.sol';

contract BrokenExecutor {
	CollectorDao immutable dao;

	constructor(CollectorDao _dao) {
		dao = _dao;
	}

	function execute(
		address[] calldata targets,
		uint256[] calldata values,
		bytes[] calldata calldatas,
		bytes32 descriptionHash
	) external {
		dao.execute(targets, values, calldatas, descriptionHash);
	}

	function claimExecutionRewards() external {
		dao.claimExecutionRewards();
	}

	receive() external payable {
		revert('BrokenExecutor: no funds accepted');
	}
}
