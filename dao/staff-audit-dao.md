https://github.com/0xMacro/student.pedroyan/tree/6833570d7818be366c597fe813f590c2f2ad27f0/dao

Audited By: Melville

# General Comments

1. Well structured tests

2. Nice job with the `uint64` variable packing

3. Pedro, you should be extremely proud of this contract. It is very readable, well tested, and except for 2 low-severity issues I found with the `buyNFTFromMarketplace` and a push vs. pull pattern issue, your code is solid. Show this off to your employer after Macro, and I will be astounded if this alone is not sufficient to get you a smart contract development role.

Seriously, well done.

# Design Exercise

(a) Excellent writeup of your approach, and nice job catching the bug where a user is able to vote multiple times by switching who they're delegating to.

Check out the Staff Solution here. It mitigates the DoS attack that could happen if a single user had so many delegates that there is not enough gas in a block for them to calculate their voting power before hiting an OOG (out of gas) error. This looping through an array effectively puts a cap on the number of delegates an address can have.

Instead of calculating the vote power when the delegatee goes to vote, you can amortize it by having each delegatee keep track of its total voting power, and this is incremented/decremented when a delegator joins/leaves the delegator pool.

(b) Eeeh sure, but there is a deeper technical problem. Maybe you didn't see it because your solution to (a) suffers from the same problem that a transitive voting implementation would have; you can run out of gas trying to calculate the voting power. You would need some system for recursing through all the chains of delegators, keeping track of cycles so you don't loop until reaching the gas limit.

Check out the Staff Solution for more info.

# Issues

## **[L-1]** `buyNFTFromMarketplace` does not handle unsuccessful `buy` calls (1 point)

`marketplace.buy()` returns a `bool success` indicating whether the purchase was successful. Your `buyNFTFromMarketplace` is not taking the return of this function into account. This will cause an unsuccessful NFT purchase to be registered as executed proposal.

Consider checking if the external call was success

```solidity
bool success = marketplace.buy{value: currentPrice}(
    nftContract,
    nftId
);
if (!success) revert MarketplaceBuyFailed());
```

## **[Technical Mistake 1]** `buyNFTFromMarketplace` uses `msg.value` when it should use `marketplace.getPrice` (1 point)

In the `DAO` contract, the function `buyNFTFromMarketplace` queries the NFT marketplace for the current price for that NFT, and checks that it is less than the `maxPrice` the DAO is willing to pay for it.

However, when buying the NFT, the `msg.value` is used to pay for it, instead of its current price, which can be different. If the current price is lower than `msg.value`, then you will overpay. More worrisome is when the current price is higher than `msg.value`, which will cause the purchase to fail.

Consider buying the NFT at its current price, and remove the `payable` marker from `buyNFTFromMarketplace`.

## **[Technical Mistake 2]** Uses “push” pattern, but should use "pull" pattern, for awarding the proposal executor (1 point)

The "push" pattern refers to making the transfer of ETH/tokens to an address happen in the same transaction as the function that enabled those tokens to be transfered. For example, in your DAO submission you transferred the execution reward ETH to executor inside of the `execute` function.

On the other hand, the "pull" pattern works by having the function that enabled the tokens to be transferred (e.g. `execute`) simply update a `mapping` storage variable that keeps track of the number of tokens that the address is due. Then there is a _separate pull function_ they need to call to withdraw their tokens.

Whenever possible you should default to using the "pull" pattern because it tends to make your function calls more robust. Now, if there is an exploitable issue with your reward transfer logic, for instance that lets an arbitrary address revert the function call and grief attack your protocol, that will not affect the function that executes the proposal.

See this article for another explanation of why to prefer "pull" over "push": https://consensys.github.io/smart-contract-best-practices/development-recommendations/general/external-calls/#favor-pull-over-push-for-external-calls

## **[Q-1]** no need for `voterAddress` in `_castEip712Vote`

In `_validateVoteSignature` you make the following check:

```solidity
address signer = ecrecover(voteHash, v, r, s);
if (signer != voterAddress) revert InvalidSignature();
```

however, this `voterAddress` arg is superfluous, because the `signer` value will always be determined by the signature itself (i.e what is returned by `ecrecover`). Imagine Alice signs a message where `voterAddress == Bob`, then your `_validateVoteSignature` will fail, so the only way to have the `_validateVoteSignature` pass is for the signer to also be `voterAddress`. Thus, the `voterAddress` value is redundant.

So you can save some gas by removing all logic involving `voterAddress`, and simply use the output of `ecrecover` as the member address that is voting.

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | -     |
| Vulnerability              | 1     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | 2     |

Total: 3
