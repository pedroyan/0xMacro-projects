**This is the staff audit for the code you performed a peer audit on. We give you this so you can compare your peer audit against a staff audit for the same project.**


https://github.com/0xMacro/student.worldveil/tree/ab27bb80201eff6fa85da41244162256eecfecf7/lp

Audited By: Melville

# General Comments

1. Were you having trouble with your frontend Metamask calls, and that's why you added the `gasLimit` args? Usually you shouldn't have to do that.

2. Nice job adding `nonReentrant` to all your Pool functions; there are several subtle bugs that even with CEI are hard to protect against

3. This is an excellent liquidity pool submission. Code is correct, readable, and except for a small misunderstanding on ReentrancyGuards I could not find any issues with your contracts. This is was no easy task, but you nailed it. 

# Design Exercise

(a) Excellent and complete answer, I have nothing to add!

(b) Excellent as well. There are a couple of vulns, but this is just pseudocod-ish so no worries. In particular, the way you wrote `stake` by using the same `slpDiff` calculation method as in your SpaceLP means you'd need some sort of Router contract in order to interact with your staking contract (or else it could be frontrun).

# Issues

## **[Extra Features 1]** Unnecessary reentrancy guards on Router functions (1 point)

In SpaceRouter.sol you mark all of your non-view functions with `nonReentrant`. However, this is unnecessary because your Router has no storage state that could be used in a reentrancy attack.

A reentrancy attack requires:
- [x] calls to an external contract
- [ ] the victim contract to have some state to change that can then be taken advantage of by the act of reentrancy

Consider removing all `nonReentrant` modifiers on your Router functions to save on gas with no decrease in security.

## **[Technical Mistake 1]** Frontend's slippage should be calculated on the output amount, but is instead calculated on input (1 point)

+1 to what Pedro said, he explained it well and gave a possible solution

## **[Q-1]** Optimizer runs could be increased for easy gas optimizations

This is less of a *code* quality and more of a gas optimization, but you used the default 200 runs for the optimizer, leaving very easy gas efficiencies on the table. You should experiment with raising that to 10_000, or even 100_000 using the Hardhat hardhat-gas-report plugin and see if it positively affects your runtime and deploy costs.


## **[Q-2]** Use `.wait()` in your frontend in order to ensure functions that require multiple transactions (such as `addLiquidity`) will function correctly

in your index.js for your frontend you have:

```solidity
await spaceCoin.increaseAllowance(router.address, spc);
await router.addLiquidity(spc, { value: eth });
```

which means your `increaseAllowance` is not going to make it to the blockchain in time for your `addLiquidity`, and it will fail sometimes.

Consider using the `txReceipt.wait()` in order to make this work all the time


## **[Q-3]** Immutable values are using contract storage

If you have values which are set in your contract constructor and then never changed, as `pool`, `coin` and `spaceCoin` are in both `SpaceRouter` and `SpaceLP`, then you can declare them with the `immutable` keyword. This will save gas as the compiler will not reserve storage for them and instead inline the values where they are used.

# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | 1 |
| Vulnerability              | - |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | 1 |

Total: 2

