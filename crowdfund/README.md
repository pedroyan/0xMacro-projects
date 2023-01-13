# Crowdfund Project

LMS Project link: [here](https://learn.0xmacro.com/training/project-crowdfund/p/1)

## Setup

See [README-Setup.md](./README-Setup.md)

## Technical Spec

<!-- Here is the list the technical requirements of the project. We include them here by default for your first project, but for future projects we encourage you to develop a healthy habit of thinking + writing out the project specs and pasting them in your README. You may find you come up with additional specifications, in which case you should add them here.

The goal here is to help you think through the possible edge cases of all your contracts -->

- There should be a `ProjectFactory` contract with a `create` method that deploys instances of the `Project` contract using the factory create pattern.

  - Each `Project` instance should be able to receive contributions independent of the others.
  - Each project has a goal amount, in ETH, which cannot be changed after a project gets created.
  - The goal set by the creator cannot be lower than 0.01 ETH - [Source](https://discord.com/channels/870313767873962014/1062064790412996659/1062491858401497130)

- The requirements for contributions are as follows:

  - The contribution amount must be at least 0.01 ETH.
  - There is no upper limit on contribution size.
  - Anyone can contribute to the project, including the creator.
  - One address can contribute as many times as they like.
  - No one can withdraw their funds until the project either fails or gets cancelled.

- The requirements for contributor badges are as follows:

  - Each project should use its own NFT contract.
  - An address earns 1 badge for each 1 ETH in their **total contribution** for that project.
  - One address can earn multiple badges for a single project, but should only earn 1 badge per 1 ETH.
    - For example, if Alice contributes 0.4 ETH to Project A, she is owed 0 badges. If she then contributes 0.7 ETH to Project A, her total contribution to that project is now 1.1 ETH, so she is owed 1 badge. If she then contributes 1 ETH, her total contribution is now 2.1 ETH, and she has earned 2 badges total.
  - The minting of badges should not happen in the same contract call as the contribution. In other words, there should be a separate function for a user to claim the contributor badges they are owed.
    - When an address calls this claim function, they should receive the correct number of badges based on their total contribution so far, while accounting for any badges that were previously claimed.
    - Refunds and project failures do not affect the number of claimable badges for a given user - [Source](https://discord.com/channels/870313767873962014/1062064790412996659/1062583545681412108)
    - When the claim function is called by a contract, that contract must [indicate it is able to handle NFTs](https://stackoverflow.com/a/71191158) or else the transaction should revert.
  - Regardless of the end result of the crowdfunding effort, the project's badges are left alone. They should still be transferable.

- The terminal states of a project are as follows:

  - If the project is not fully funded within 30 days:

    - The project goal is considered to have failed.
    - No one can contribute anymore.
    - Contributors can get a refund of their contribution.
      - A refund should return the entirety of the contributed value. There will not be an option for partial refunds - [Source](https://discord.com/channels/870313767873962014/1062064790412996659/1062608486665560095)

  - Once a project becomes fully funded:

    - No one else can contribute (however, the last contribution can go over the goal).
    - The creator cannot cancel the project.
    - The creator can withdraw any amount of contributed funds.
      - i.e: Partial withdrawals or full withdrawals

  - Before the 30 days are over and if the project is not yet fully funded, the creator can cancel the project.
    - This should have the same effect as a project failing to reach its goal within the 30 days.

## Code Coverage Report

| File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines |
| ------------------ | ------- | -------- | ------- | ------- | --------------- |
| contracts/         | 100     | 100      | 100     | 100     |                 |
| Project.sol        | 100     | 100      | 100     | 100     |                 |
| ProjectFactory.sol | 100     | 100      | 100     | 100     |                 |
| All files          | 100     | 100      | 100     | 100     |                 |

## Design Exercise Answer

> Smart contracts have a hard limit of 24kb. Crowdfundr hands out an NFT to everyone who contributes. However, consider how Kickstarter has multiple contribution tiers. How would you design your contract to support this, without creating three separate NFT contracts?

### Overview

The approach would consist in creating an array of badges that would store tier data by id and would be accessible to user on-chain.

```solidity
// Id of the token = Index selector
// Tier of the badge = Value at the index
uint256[] public badgeTiers;

function getBadgeTier(uint256 tokenId) public view returns (uint256) {
    if(tokenId >= badgeTiers.length) {
        revert OutOfBounds();
    }

    return badgeTiers[tokenId];
}
```

### Badge claiming process

The `badgesTiers` array would be populated as soon as a contributor claim their badges, resulting in the following modifications to the `claimBadges` function:

```solidity
function claimBadges() external {
  // Computes all claimable badges for a given msg.sender, taking into account the total
  // contribution and claimed badges.
  uint256[] memory _badgeTiers = new uint256[](8);

  // ... REMAINING CHECKS LOGIC

  // Populate the tiers array, allowing a tier to be resolved by TokenId
  for (uint256 i = 0; i < _badgeTiers.length; i++) {
    badgeTiers.push(_badgeTiers[i]);
  }

  // ... REMAINING AFFECTS LOGIC

  // ... REMAINING INTERACTIONS LOGIC
  // Minting logic would be similar to what exists now

```

### Benefits of approach

- Simple to implement
- Minimal changes to existing logic

### Drawbacks of approach

- Not very extensible.
  - Can be mitigated via the use of a `struct` called `Badge` if more properties were assigned for each `tokenId`
  - Struct array `Badge[] public badge;` would be declared instead of `uint256[] public badgeTiers;`
