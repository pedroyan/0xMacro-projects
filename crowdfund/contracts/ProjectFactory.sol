//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;
import "./Project.sol";

error InvalidFundingGoal();

/**
 * @title ProjectFactory
 * @author Pedro Yan Ornelas
 * @notice This contract is responsible for creating new projects and keeping track of them in the
 * crowdfundr dapp.
 */
contract ProjectFactory {
    /// @notice Projects created by this factory
    Project[] public projects;

    /// @notice Emitted when a new project is created
    event ProjectCreated(address newProject, address projectCreator, uint256 fundingGoal);

    /**
     * @notice Creates a new project and tracks it in the projects array
     * @param _fundingGoal The funding goal for the project. Cannot be lower than 0.01 ether.
     */
    function create(uint256 _fundingGoal) external {
        if(_fundingGoal < 0.01 ether) {
            revert InvalidFundingGoal();
        }

        Project project = new Project(msg.sender, _fundingGoal);
        projects.push(project);

        emit ProjectCreated(address(project), msg.sender, _fundingGoal);
    }

    function getProjects() external view returns (Project[] memory) {
        return projects;
    }
}
