//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

error InsuficientContribution();
error InsuficientBalance();
error NoBadgesToClaim();
error Unauthorized();
error EthTransferFailed();

/**
 * @title Project
 * @author Pedro Yan Ornelas
 * @notice This contract is responsible for managing a single project in the crowdfundr dapp.
 */
contract Project is ERC721 {

    /// @notice The status of the project.
    enum ProjectStatus { Active, Failed, Funded }

    error NotAllowedOnStatus(ProjectStatus expectedStatus, ProjectStatus actualStatus);

    /// @notice The minimum amount of ETH that a contributor must send to be eligible for a badge.
    uint256 public constant BADGE_CONTRIBUTION_THRESHOLD = 1 ether;

    /// @notice The creator of the project.
    address public immutable creator;

    /// @notice The funding goal for the project.
    uint256 public immutable fundingGoal;

    /// @notice The timestamp when the project was created.
    uint256 public immutable startedAtTimestamp;

    /// @notice Flag indicating if the funding goal was reached.
    bool private goalReached;

    /// @notice Flag indicating if the project was canceled.
    bool private projectCanceled;

    /// @notice Current contribution balance for a given contributor. Refunded contributions are subtracted from this value.
    mapping (address => uint256) private contributionBalance;

    /// @notice Total contributions made by a given contributor. Refunds do not affect this value.
    mapping (address => uint256) private totalContributions;

    /// @notice Amount of badges claimed by a given contributor.
    mapping (address => uint256) private badgesClaimed;

    /// @notice Total amount of badges claimed.
    uint256 private totalBadgesClaimed;

    /// @notice Emitted when a contributor contributes to the project.
    event ContributionReceived(address contributor, uint256 amount);

    /// @notice Emitted when the funding goal is reached.
    event GoalReached();

    /// @notice Emitted when the project is canceled.
    event ProjectCanceled();

    /// @notice Emitted when a creator withdraws funds from the project.
    event ProjectWithdrawn(uint256 amount);

    /// @notice Emitted when a refund is issued to a contributor.
    event RefundIssued(address contributor, uint256 amount);

    /**
     * @notice Creates a new project.
     * @param _creator The creator of the project.
     * @param _fundingGoal The funding goal for the project.
     */
    constructor(address _creator, uint256 _fundingGoal) ERC721("Project", "PROJ") {
        creator = _creator;
        fundingGoal = _fundingGoal;
        startedAtTimestamp = block.timestamp;
    }

    /**
     * @dev Throws if called by any account other than the creator.
     */
    modifier onlyCreator() {
        if(msg.sender != creator) {
            revert Unauthorized();
        }

        _;
    }

    /**
     * @notice Returns the current status of the project.
     */
    function getCurrentStatus() public view returns (ProjectStatus) {
        if (goalReached) {
            return ProjectStatus.Funded;
        }

        if (_isFailed()) {
            return ProjectStatus.Failed;
        }

        return ProjectStatus.Active;
    }

    /**
     * @dev Throws if the project is not in the expected status.
     * @param _expectedStatus The expected status of the project.
     */
    modifier requireStatus(ProjectStatus _expectedStatus) {
        ProjectStatus _currentStatus = getCurrentStatus();
        if(_currentStatus != _expectedStatus) {
            revert NotAllowedOnStatus(_expectedStatus, _currentStatus);
        }

        _;
    }

    /**
     * @notice Receives a contribution to the project.
     * @dev Reverts if the contribution is less than 0.01 ETH.
     * @dev Reverts if the project status is not Active.
     */
    function contribute() requireStatus(ProjectStatus.Active) external payable {
        if(msg.value < 0.01 ether) {
            revert InsuficientContribution();
        }

        contributionBalance[msg.sender] += msg.value;
        totalContributions[msg.sender] += msg.value;

        emit ContributionReceived(msg.sender, msg.value);

        if(address(this).balance >= fundingGoal) {
            goalReached = true;
            emit GoalReached();
        }
    }

    /**
     * @notice Cancels the project. Can only be called by the project creator.
     * @dev Reverts if the project status is not Active.
     */
    function cancel() external onlyCreator requireStatus(ProjectStatus.Active)  {
        projectCanceled = true;

        emit ProjectCanceled();
    }

    /**
     * @notice Withdraws funds from the project. Can only be called by the project creator.
     * @dev Reverts if the project status is not Funded.
     * @param _amount The amount of ETH to withdraw.
     */
    function withdraw(uint256 _amount) external onlyCreator requireStatus(ProjectStatus.Funded)  {
        // Use call for ETH Transfers: https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/
        (bool _success, ) = msg.sender.call{value: _amount}("");
        if(!_success) revert EthTransferFailed();

        emit ProjectWithdrawn(_amount);
    }

    /**
     * @notice Refunds a calling contributor.
     * @dev Reverts if the project status is not Failed.
     * @dev Reverts if the contributor has no balance to refund.
     */
    function refund() external requireStatus(ProjectStatus.Failed) {
        if(contributionBalance[msg.sender] == 0) {
            revert InsuficientBalance();
        }
        
        uint256 _amount = contributionBalance[msg.sender];
        contributionBalance[msg.sender] = 0;

        // Use call for ETH Transfers: https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/
        (bool _success, ) = msg.sender.call{value: _amount}("");
        if(!_success) revert EthTransferFailed();

        emit RefundIssued(msg.sender, _amount);
    }

    /**
     * @notice Mint pending badges to the caller.
     * @dev Reverts if the caller has no pending badges to claim.
     */
    function claimBadges() external {
        // CHECK - Check if contributor has any claimable badges.
        uint256 _claimableBadges = _getClaimableBadges(msg.sender);
        if(_claimableBadges == 0) {
            revert NoBadgesToClaim();
        }

        // EFFECTS - Increase claimed badges count. This is done before the minting to prevent over-minting
        // via reentrancy exploits.
        badgesClaimed[msg.sender] += _claimableBadges;
        uint256 _currentBadges = totalBadgesClaimed;
        totalBadgesClaimed += _claimableBadges;
        
        // INTERACTIONS - Safely mint the NFTs, which can possibly call into abritrary ERC721TokenReceiver contracts.
        for(uint256 i = _currentBadges; i < totalBadgesClaimed; i++) {
            _safeMint(msg.sender, i);
        }
    }

    /**
     * @notice Returns if the project has failed.
     */
    function _isFailed() private view returns (bool) {
        // Since our dapp does not loose integrity on any variation of 15 seconds in the block.timestamp, we can use it to
        // track the project status (15 seconds rule)
        // https://consensys.github.io/smart-contract-best-practices/development-recommendations/solidity-specific/timestamp-dependence/
        return projectCanceled || (block.timestamp > startedAtTimestamp + 30 days && !goalReached);
    }

    /**
     * @notice Returns the number of badges a contributor is entitled to claim.
     * @param contributor The contributor address.
     */
    function _getClaimableBadges(address contributor) private view returns (uint256) {
        uint256 _entitledBadges = totalContributions[contributor] / BADGE_CONTRIBUTION_THRESHOLD;
        return _entitledBadges - badgesClaimed[contributor];
    }
}
