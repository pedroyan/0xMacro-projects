# General

Excellent job, very well done! :clap:

- Your test coverage is very thorough!
- Your code is extremely clean and easy to read, I appreciated the separation of concerns (e.g. `Ownable.sol`, `SafeERC20.sol`)!
- Excellent use of NatSpec and code comments, it made it exceedingly easy to follow your train of thought and the intended behavior!
- I loved looking through your `contracts/attacks` contracts!

TL;DR: Honestly, I couldn't find much to critique after a fairly thorough pass! :tada:

## All Contracts

**WARNING:** This is super pedantic and more of an FYI than anything (no points)!

As an example, in your state variable declarations in `SpaceRouter`, we have:

```solidity
/// @notice The liquidity pool contract.
SpaceLP public spaceLP;

/// @notice The SPC token contract.
SpaceCoin public spaceCoin;
```

Technically, `@notice` is redundant (albeit more explicit, which is never a bad thing!).

From [this part of the NatSpec spec](https://docs.soliditylang.org/en/v0.8.18/natspec-format.html#tags):

> As a special case, if no tags are used then the Solidity compiler will interpret a /// or /\*\* comment in the same way as if it were tagged with @notice.

As a TL;DR: there's absolutely nothing wrong with what you've done! Personally however, I tend to prefer "less noise" when it comes to reading code comments, but that's obviously highly opinionated and just my 2c! :smile:

If you're already aware of this aspect of the spec and made the decision to explicitly call out `@notice`, then by all means, disregard this comment!

## Ico.sol

- The `requirePhase()` modifier is beautiful! :ok_hand:

## SpaceCoin.sol

- This wasn't included in the spec and/or a concrete requirement, but it may be worth your consideration to discuss with the client whether the SPC transfer tax ought to be imposed on transfers to/from the treasury! On the one hand, keeping it as-is makes the business logic uniform across SPC transferrers; on the other hand, the 2% going _back_ to the treasury can be viewed as redundant!

## SpaceRouter.sol

- Your approach in `addLiquidity()` of requiring the ratio of ETH:SPC be correct/exact is a perfectly reasonable one, and it definitely reduces complexity (and the surface area for attacks)! Accordingly, I'm not calling it out as a "quality issue", but it _does_ put more onus on the caller to get the math right which could lead to frustration (failed transactions, wasted gas) -- alternatively, an improved "UX" might be for the `addLiquidity()` function to return excess ETH rather than reverting, but that's your choice to make of course!

  - **EDIT:** I see you've created a `getOptimalDepositEth()` view function to make this easier on the caller, well done! That largely negates my comment above :smile:

### [L-1] Transfer Tax

It's entirely possible that I'm missing something! In the absence of that however, I don't believe your `addLiquidity()` function accounts for the 2% SPC transfer tax after `spaceCoin.safeTransferFrom()` is called in `_depositFunds()` on L78.

To elaborate, your `_optimalEthIn()` calculation on L59 seems to calculate the expected amount of ETH based on the _provided_ `spc` input parameter, but it doesn't account for the fact that the resultant `transferFrom()` will end up transferring 2% _less_ SPC than claimed.

Again, it's entirely possible that I've missed something, but I didn't catch any logic in your `_depositFunds()` -> `spaceLP.deposit()` flow of execution that'd prevent this, leading to the ETH:SPC ratio slowly diverging over time!

### [Q-1] Consider Using Immutable State Variables

As your state variables, we have:

```solidity
SpaceLP public spaceLP;
SpaceCoin public spaceCoin;
```

Because these are assigned in the constructor and won't change throughout the lifecycle of the contract, we should be able to use the `immutable` keyword as a minor optimization!

## SpaceLP.sol

- It's clear you put a lot of thought and time/effort into this contract, I didn't catch anything! :clap:
