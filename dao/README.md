# DAO Project

## Setup

See [README-Setup.md](./README-Setup.md)

## Technical Spec

You are writing a contract for Collector DAO, a DAO that aims to collect NFTs. This DAO wishes to have a contract that:

- Allows anyone to buy a membership for 1 ETH.
  - Any attempt to purchase a membership for more than 1 ETH should revert. ([source](https://discord.com/channels/870313767873962014/1066044058109222942/1066894455082323978))
  - Memberships cannot be revoked or transferred or retracted. ([source](https://discord.com/channels/870313767873962014/1066044058109222942/1067322653813256263))
- Allows a member to create governance proposals, which include a series of proposed arbitrary functions to execute.
- Allows members to vote on proposals:
  - Members can vote over 7 day period, beginning immediately after the proposal is generated.
    - Any votes after the 7 day period should be rejected.
  - A vote is either "Yes" or "No" (no “Abstain” votes).
  - A member's vote on a proposal cannot be changed after it is cast.
    > Any time duration should be measured in seconds, not the number of blocks that has passed.
- A proposal is considered passed when all of the following are true:
  - The voting period has concluded.
  - There are more Yes votes than No votes.
  - A 25% quorum requirement is met.
    - Quorum will be a percentage of **member**, **not** a percentage of **voting power**. ([source](https://discord.com/channels/870313767873962014/1066044058109222942/1066921824782393385))
- Allows **any** address to execute successfully passed proposals.
  - An address does not need to be a member to execute a passed proposal. ([source](https://discord.com/channels/870313767873962014/1066044058109222942/1067196843655700550))
- Reverts currently executing proposals if any of the proposed arbitrary function calls fail. (Entire transaction should revert.)

- Incentivizes positive interactions with the DAO's proposals, by:
  - Incentivizing rapid execution of successfully passed proposals by offering a 0.01 ETH execution reward, provided by the DAO contract, to the address that executes the proposal.
  - In cases where the DAO contract has **less than a 5 ETH balance, execution rewards should be skipped.**
  - Execution rewards will be skipped if after the execution of the proposal the balance is less than 5 ETH. (We can go either way here, so I picked this path. [source](https://discord.com/channels/870313767873962014/1066044058109222942/1067579790208536757))

### Implementation Requirements

- A standardized NFT-buying function called `buyNFTFromMarketplace` should exist on the DAO contract so that DAO members can include it as one of the proposed arbitrary function calls on routine NFT purchase proposals.
- Even though this DAO has one main purpose (collecting NFTs), the proposal system should support proposing the execution of **any** arbitrarily defined functions on any contract.
- A function that allows an individual member to vote on a specific proposal should exist on the DAO contract.
- A function that allows any address to submit a DAO member's vote using **off-chain generated EIP-712 signatures** should exist on the DAO contract.
  <!-- look at the castVoteBySig function for a good reference -->
  - Another function should exist that enables **bulk submission and processing of many EIP-712 signature votes**, from several DAO members, across multiple proposals, to be processed in a single function call.
  - The bulk submission of votes either fail together or pass together. Partial application of votes should be avoided. ([source](https://discord.com/channels/870313767873962014/1066044058109222942/1067322447558344704))
  <!-- I should probably reference the proposals by ID instead of passing calldatas -->

**Proposal System Caveats**

- It should be possible to submit proposals with identical sets of proposed function calls.
- The proposal's data should not be stored in the contract's storage. **Instead, only a hash of the data should be stored on-chain.**
- Once created, a proposal cannot be cancelled by members. ([source](https://discord.com/channels/870313767873962014/1066044058109222942/1067196843655700550))
- Members can create proposals while other proposals from the same member are pending.

**Voting System Caveats**

- DAO members must have joined before a proposal is created in order to be allowed to vote on that proposal. - Note: This applies even when the two transactions - member joining and proposal creation - fall in the same block. In that case, the ordering of transactions in the block is what matters.
- A DAO member's voting power should be increased each time they perform one of the following actions:
  - +1 voting power (from zero) when an address purchases their DAO membership
  - +1 voting power to the creator of a successfully executed proposal
- Members can vote for their own proposal. ([source](https://discord.com/channels/870313767873962014/1066044058109222942/1066894677145559041))

**Testing Requirements**

- In addition to the usual expectation that you will test all the main use cases in the spec, you must also write a test case for buying an NFT via a proposal.

## Code Coverage Report

<!-- Copy + paste your coverage report here before submitting your project -->
<!-- You can see how to generate a coverage report in the "Solidity Code Coverage" section located here: -->
<!-- https://learn.0xmacro.com/training/project-crowdfund/p/4 -->

## Design Exercise Answer

<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->

> Per project specs there is no vote delegation; it's not possible for Alice to delegate her voting power to Bob, so that when Bob votes he does so with the voting power of both himself and Alice in a single transaction. This means for someone's vote to count, that person must sign and broadcast their own transaction every time. How would you design your contract to allow for non-transitive vote delegation?

> What are some problems with implementing transitive vote delegation on-chain? (Transitive means: If A delegates to B, and B delegates to C, then C gains voting power from both A and B, while B has no voting power).
