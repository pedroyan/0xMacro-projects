https://github.com/0xMacro/student.pedroyan/tree/8f0e794a4de1197a55f3b69635aa825a8b04c1ab/lp

Audited By: Leoni Mella (MrLeoni)

# General Comments

Hey Pedro! Your LP project made it look as if it was an easy and simple project to do! Nonetheless I found some minor issues with your code. Another thing that I really enjoyed was your tests and test coverage, great job on that as well!

# Design Exercise

Good work answering the Design Exercise, your answer was quite thoroughly and detailed both benefits and downsides as the pseudo code about the Staking implementation.

# Issues

## **[Technical Mistake 1]** Strict checks on ETH amount when adding liquidity on SpaceRouter will cause high rate of failures (1 point)

Your `addLiquidity` function has the following check on line 65:

```solidity
  if (msg.value != optimalEthIn) {
    revert SuboptimalEthIn(optimalEthIn, msg.value);
  }
```

In some of your tests you are using the `getOptimalDepositEth` to get the optimal ETH, but the returned value can be outdated when the user calls `addLiquidity` thus reverting with `SuboptimalEthIn`.

If used in a high-trade-volume setting, where the ratio of reserves is likely going to be different than when the user passed the args to `addLiquidity`, then calls to `addLiquidity` will constantly fail and the UX will be atrocious

Would be a better UX to allow for ETH provided to be greater than optimal. In this case you would transfer the reminder ETH back to the user.

```solidity
  if (msg.value < optimalEthIn) {
    revert SuboptimalEthIn(optimalEthIn, msg.value);
  }

  _depositFunds(spc);

  uint256 reminderETH = msg.value - optimalEthIn;

  if (reminderETH > 0) {
    (bool success,) msg.sender.call{value: reminderETH}("");
    if (!success) revert EthTransferFailed();
  }

```

## **[Technical Mistake 2]** Use of `transfer` method instead of `call` method on ICO `withdraw` function

If the treasury account were a contract (such as a multisig wallet) with any fallback logic, the `transfer` call would not pass enough gas and the funds would be locked in the ICO until the treasury owners remove their fallback function (if that is even something they would want to do).

Consider using `.call` which forwards 63/64ths of the remaining gas, so that it will not fail in cases like the one mentioned above

## **[Technical Mistake 3]** Router’s `addLiquidity` function does not account for feeOnTransfer tokens such as SPC (1 point)

In your `SpaceRouter` contract the `addLiquidity` function is not taking into account the 2% tax of the `SpaceCoin` contract

When the function calculates the `optimalEthIn` is with the parameter `spc` but not the actual value of it that was transferred to the pool thus the optimal eth calculation will be slightly off.

Consider checking for the tax and subtracting away 2% from the SPC the pool will receive when calculating the correct amount of SPC and ETH to add in `addLiquidity`.

## **[Q-1]** Optimizer runs could be increased for easy gas optimizations

This is less of a _code_ quality and more of a gas optimization, but you used the default 200 runs for the optimizer, leaving very easy gas efficiencies on the table. You should experiment with raising that to 10_000, or even 100_000 using the Hardhat hardhat-gas-report plugin and see if it positively affects your runtime and deployment costs.

## **[Q-2]** Checks return value of `.transferFrom` or `.transfer` for success

Since we’re using OZ’s ERC20 implementation for `.transferFrom` and `.transfer`, we know it throws on any failure [\_transfer](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.1/contracts/token/ERC20/ERC20.sol#L226), so there’s no need to check the return value

## **[Q-3]** Immutable values are using contract storage

If you have values which are set in your contract constructor and then never changed, as `spaceLP` and `spaceCoin` in your `SpaceRouter`, then you can declare them with the `immutable` keyword. This will save gas as the compiler will not reserve storage for them and instead inline the values where they are used.

## **[Q-4]** Checks return value of `.transferFrom` or `.transfer` for success

Since we’re using OZ’s ERC20 implementation for `.transferFrom` and `.transfer`, we know it throws on any failure [\_transfer](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.1/contracts/token/ERC20/ERC20.sol#L226), so there’s no need to check the return value

# Nitpicks

## **[N-1]** `getMaximumEthAmountOut` & `getMaximumSpcAmountOut` doesn't check 2% transfer fee on spaceCoin

Would be nice if these two functions took into account whether the SpaceCoin tax transfer was enabled or not.

If the tax is enabled the amount of eth/spc out will be different from what those functions are calculating. This is not an issue because the actual swap function will revert if this happens, but I believe it could be a better UX for your contracts.

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | 0     |
| Unfinished features        | 0     |
| Extra features             | 0     |
| Vulnerability              | 0     |
| Unanswered design exercise | 0     |
| Insufficient tests         | 0     |
| Technical mistake          | 3     |

Total: 3
Great Job!
