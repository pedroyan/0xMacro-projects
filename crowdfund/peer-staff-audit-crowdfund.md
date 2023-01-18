**This is the staff audit for the code you performed a peer audit on. We give you this so you can compare your peer audit against a staff audit for the same project.**

https://github.com/0xMacro/student.sgzsh269/tree/2c0d6d0ee73411b846c1d3a90a20e02e0904ad63/crowdfund

Audited By: Benedict Lee

# General Comments

Great job!! Overall very good effort, no vulnerbility are found. But the code quality and tests can be further improve. Instead of having separate checks for `projectExpired`, `projectGoalReached`, and `projectCancelled`. Consider using a state machine approach using enum, in this case we can break it down to `Active`, `Success`, and `Failed`. With this your `contribute`, `withdraw`, `refund`, etc function can just act according depends on the state. This will help your code be more readable and easier to debug if any issues arise.

Keep up the good work and hope these feedback will help you further improve.

# Design Exercise

Good answer and great job adding some psuedo code. The solution of additional mapping for NFT tier does help keep track of each tier NFT. There's a issue with the code provided (understandable that this is just a psuedo code). The `contributorTier` should based on the contributors' accumulated contribution + msg.value.

Also, please provide at least 1 other implementation to weight in the pros and cons of each.
A few other approch to consider:
i) Offchain storage - ERC721 metadata is another popular approach to store additional off-chain data related information to each specific NFTs. You can read more about NFT metadata here https://docs.opensea.io/docs/2-adding-metadata.
ii) ERC-1155 - A token standard that combined both ERC-20 (fungible token) and ERC-721 (non-fungible token).

# Issues

## **[Technical Mistake]** Unable to create minimum funding goal of 0.01 ETH (1 point)

According to the spec:

"The contribute amount must be at least 0.01 ETH"

With the lowest contribution amount of 0.01 ETH, the creation should allow at least a funding goal of 0.01 ETH.

On line 32, in ProjectFactory.sol
Suggestion:

```Solidity
if (goalAmount < MIN_GOAL_AMOUNT) {
```

## **[Q-1]** Unnecessary storage and function in ProjectFactory

On line 21 in projectFactory.sol, the state variable `projectAddresses` are use the store the list of projects. Instead of storing that value onchain (which cost gas), the same effect can be achieve by having them in the `ProjectCreated` event which can be access via the creation of topics on event logs. This allows you to remove the function `getProjectCount`

## **[Q-2]** Unable to withdraw full amount of balance

For the `withdrawProjectFunds` in `Project.sol`. You are using the `totalProjectBalance` state variable to keep track of how much are left to be withdrawn by the creator.

However, there are multiple ways (for example: selfdestruct) to force an address to receive ether which would not go through the `contribute` function, We would want to make sure the entire funds are able to be withdraw by the creator.

Suggest to use `address(this).balance` to check how much funds are available to be withdraw.

## **[Q-3]** Add Natspec comments for your public contracts, storage variables, events, and functions

Solidity contracts can use a special form of comments to provide rich documentation for functions, return variables, and more. This special form is named the Ethereum Natural Language Specification Format (NatSpec).

Solidity contracts are recommended to be fully annotated using NatSpec for all public interfaces (everything in the ABI).

Using NatSpec will make your contracts more familiar for others to audit and make your contracts look more standard.

For more info on NatSpec, check out [this guide](https://docs.soliditylang.org/en/develop/natspec-format.html).

Consider annotating your contract code via the NatSpec comment standard.

# Nitpicks

## **[N-1]** Duplication of test cases

On line 307-344 in crowdfundr.test.ts, the 3 tests are exact duplicate.

## **[N-2]** Storing `exipryData` as oppose to `deployDate`

On the creation of the project.sol, you have a state variable `deployDate` which is being use on `checkAndProcessProjectExpiry` to determine the deadline. However, the better approach is to store the deadline by adding the 30 days (`PROJECT_TIME_PERIOD`) at the start. This way you wont need to keep adding the `deployDate` and the `PROJECT_TIME_PERIOD` on every porject expiry checks.

```Solidity
uint256 immutable deadline;

constructor(
    address _creator,
    string memory _name,
    string memory _symbol,
    uint256 _goalAmount
) ERC721(_name, _symbol) {
    creator = _creator;
    goalAmount = _goalAmount;
    deadline = block.timestamp + 30 days;
}
```

## **[N-3]** Use of range check when equality check is more readable

In several locations in your code (such as line 148 of Project.sol) you have <= comparison against a `uint256` of 0 (e.g. `amountToRefund <= 0`). This is confusing since `amountToRefund` is an unsigned int, which means it could never be less than 0. So `amountToRefund <= 0` is equivalent to `amountToRefund == 0`.

Consider using the simpler to reason about `==` operator for unsigned ints when comparing against `0`.

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | -     |
| Vulnerability              | -     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | 1     |

Total: 1
