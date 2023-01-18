https://github.com/0xMacro/student.pedroyan/tree/4ec6a907dad9cf1ec97eb031eb30a4c8c9abc6aa/crowdfund

Audited By: Leoni Mella (MrLeoni)

# General Comments

Hey Pedro. You did an awesome job! I only found one small issue, and I also left some  suggestions for code quality improvements. Keep up with the good work!

# Design Exercise

Unfortunately I couldn't follow your solution very well, although the idea of relating a set of `badgesId` with a respective tier is correct.
We could achieve this using a set of `enum` and `mapping` as follow:

```solidity
enum NFTLevel { BRONZE, SILVER, GOLD }
mapping (uint256 -> NFTLevel) badgeTiers; // Badge ID => Level of NFT
```

When minting the NFT, we would add additional logic to update the badgeTiers mapping accordingly:

```solidity
uint256 badgeId = 0;
function mintNFT(NFTLevel nftLevel) {
    badgeId++;
    badgeTiers[badgeId] = nftLEVEL;
    _safeMint(msg.sender, badgeId);
}
```

Although this solution is not very gas effective it's a simple implementation for the feature

# Issues

## **[L-1]** Usage of `address(this).balance` directly could lead to unwanted effects/consequences (1 point)

The balance of a contract can be modified by external factors. For example, if some malicious contract with ETH balance executes a `selfdestruct` with a Crowdfund Project's contract address, the `address(this).balance` will increase and create a discrepancy with the state of `totalContributions[address]` - specifically, the sum of all contributions would be less than the current project's balance. In general, you should be extra cautious when some of the relevant values can only be modified by function calls to your contract while others can be modified by external actions that don't call your contract's functions.

This is not a big problem in this project because the creator can withdraw all the project's balance at will if the project is successful. But there are a few unexpected scenarios that can arise. 
- A malicious actor could force-send enough ETH to the contract that we the goal is reached, and then make a small contribution leading to `goalReached = true`, such that the project goal is reached but not NFTs are ever claimable
- Similarly, if the ETH transfer that puts the project past the goal is a force-send, then it will still be possible for the next user to make a contribution even though the goal is already reached, which should not be possible.

Consider creating a `projectContributions` variable that will increment in value for each contribution made and use it instead of `address(this).balance` to determine the project success:

```solidity
    uint256 public projectContributions;
```

## **[Q-2]** The function `withdraw()` don't check if the desirable `amount` to withdraw is available

Your function `withdraw()` directly uses the parameter `_amount` as the `call()` argument.

This is fine, but would be a better to check if the contract has the desirable amount on his balance before executing the `call()` function. This will prevent the `call()` function to get executed if the desirable `_amount` is greater than contract's balance, saving up in gas since less code got executed.

## **[Q-3]** No use of indexed parameters in events

Indexing parameters in events are a great way to keep track of specific outputs from events, allowing the creation of topics to sort and track data from them. For example:

```solidity
event ContributionReceived(
    address indexed contributor,
    uint256 indexed amount
);
```

Using `address indexed contributor` and `address indexed amount` in the event above, will allow dApps to track the specific ContributionReceived events of an address with ease.

## **[Q-4]** Use of uint256 where a more compact uint32 or uint64 would suffice

You used uint256 for `startedAtTimestamp` and `BADGE_CONTRIBUTION_THRESHOLD` whose values will never change because they are constant. Those numbers do not need 256 bits to represent them, and instead you could have used uint32 and uint64 respectively. This would allow them to be packed into a single storage slot, and cause your SLOAD's to be cheaper.

See [this article's section on "Variable Packing"](https://medium.com/coinmonks/gas-optimization-in-solidity-part-i-variables-9d5775e43dde) for more detailed info.

Consider optimizing your uint sizes for optimal storage and gas efficiency.

# Nitpicks

## **[N-1]** All projects have the same `name` and `symbol`

This is just a design decision and you are achieving Project uniqueness by the Project's address and tokenIds (regarding badges) so it's not a problem, but would be better to have the creator of the Project choose the `name` and `symbol` for it.

## **[N-2]** Custom error declarations are inconsistent

You declared five errors outside your contract:

```solidity
error InsuficientContribution();
error InsuficientBalance();
error NoBadgesToClaim();
error Unauthorized();
error EthTransferFailed();
```

And one error inside your contract:

```solidity
contract Project is ERC721 {

    /// @notice The status of the project.
    enum ProjectStatus { Active, Failed, Funded }

    error NotAllowedOnStatus(ProjectStatus expectedStatus, ProjectStatus actualStatus);

    // contract code...
```

It is better to leave them all in one place to improve consistency and code readability

## **[N-3]** `startedAtTimestamp` could be converted into `expiryDate`

Your state variable `startedAtTimestamp` can be rewritten as the following:

```solidity
uint256 immutable expiryDate = block.timestamp + 30 days;
```

This way we could avoid the math operation in `_isFailed()` function making the code more readable and saving some gas:

```solidity
function _isFailed() private view returns (bool) {
  return projectCanceled || (block.timestamp > expiryDate && !goalReached); // instead of startedAtTimestamp + 30 days
}

```

## **[N-4]** Some functions declarations have mixed view, modifiers ordering

In your contract, some functions have mixed ordering regarding the view type and modifiers. For example, `refund()`:

```solidity
function refund() external requireStatus(ProjectStatus.Failed)
```

This function is declared with the view type first `external` than the `modifier` `requireStatus()`.

At the same time your `contribute()` function is the other way around:

```solidity
function contribute() requireStatus(ProjectStatus.Active) external payable
```

Consider writing as the standard 1. view type, 2. payable (if applicable), 3. virtual & override (if applicable), 4. Lastly, any modifiers. This will make your code more easy to read!

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | 0     |
| Unfinished features        | 0     |
| Extra features             | 0     |
| Vulnerability              | 1     |
| Unanswered design exercise | 0     |
| Insufficient tests         | 0     |
| Technical mistake          | 0     |

Total: 1

Excellent Job!
