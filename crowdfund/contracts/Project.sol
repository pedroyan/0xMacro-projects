//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

error InsuficientContribution();
error InsuficientBalance();
error NoBadgesToClaim();
error Unauthorized();
error EthTransferFailed();

contract Project is ERC721 {
    enum ProjectStatus { Active, Failed, Funded }

    error NotAllowedOnStatus(ProjectStatus expectedStatus, ProjectStatus actualStatus);

    uint256 public constant BADGE_CONTRIBUTION_THRESHOLD = 1 ether;

    address public immutable creator;
    uint256 public immutable fundingGoal;
    uint256 public immutable startedAtTimestamp;

    bool public goalReached;
    bool public projectCanceled;

    mapping (address => uint256) private contributionBalance;
    mapping (address => uint256) private totalContributions;
    mapping (address => uint256) private badgesClaimed;
    uint256 private totalBadgesClaimed;

    event ContributionReceived(address contributor, uint256 amount);
    event GoalReached();
    event ProjectCanceled();
    event ProjectWithdrawn(uint256 amount);
    event RefundIssued(address contributor, uint256 amount);

    constructor(address _creator, uint256 _fundingGoal) ERC721("Project", "PROJ") {
        creator = _creator;
        fundingGoal = _fundingGoal;
        startedAtTimestamp = block.timestamp;
    }

    modifier onlyCreator() {
        if(msg.sender != creator) {
            revert Unauthorized();
        }

        _;
    }

    function getCurrentStatus() public view returns (ProjectStatus) {
        if (goalReached) {
            return ProjectStatus.Funded;
        }

        if (_isFailed()) {
            return ProjectStatus.Failed;
        }

        return ProjectStatus.Active;
    }

    modifier requireStatus(ProjectStatus _expectedStatus) {
        ProjectStatus _currentStatus = getCurrentStatus();
        if(_currentStatus != _expectedStatus) {
            revert NotAllowedOnStatus(_expectedStatus, _currentStatus);
        }

        _;
    }

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

    function cancel() external onlyCreator requireStatus(ProjectStatus.Active)  {
        projectCanceled = true;

        emit ProjectCanceled();
    }

    function withdraw(uint256 _amount) external onlyCreator requireStatus(ProjectStatus.Funded)  {
        // Use call for ETH Transfers: https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/
        (bool _success, ) = msg.sender.call{value: _amount}("");
        if(!_success) revert EthTransferFailed();

        emit ProjectWithdrawn(_amount);
    }

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

    function _isFailed() private view returns (bool) {
        // Since our dapp does not loose integrity on any variation of 15 seconds in the block.timestamp, we can use it to
        // track the project status (15 seconds rule)
        // https://consensys.github.io/smart-contract-best-practices/development-recommendations/solidity-specific/timestamp-dependence/
        return projectCanceled || (block.timestamp > startedAtTimestamp + 30 days && !goalReached);
    }

    function _getClaimableBadges(address contributor) private view returns (uint256) {
        uint256 _entitledBadges = totalContributions[contributor] / BADGE_CONTRIBUTION_THRESHOLD;
        return _entitledBadges - badgesClaimed[contributor];
    }
}
