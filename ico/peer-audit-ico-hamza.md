Overall, I really enjoyed auditing the code and found it to be quite well-organized and easy to follow. I especially appreciated the approach of implementing key requirements as function modifiers (e.g requirePhase modifier on SpaceCoin), and the fact that no one function was too big to parse. I didn't find any actual security vulnerability, but below are a few other suggestions.

## **[Q-1]** In SpaceCoin, consider merging repetitive code from transfer and transferFrom

Both transfer and tranferFrom functions have some form of the the following to implement the tax on transfers:

```
function transfer(...
...
    if(taxTransfers) {
        (uint256 _fee, uint256 _netAmount) = _calculateFee(_amount);
        _transfer(msg.sender, treasury, _fee);
        _transfer(msg.sender, _recipient, _netAmount);
    } else {
        _transfer(msg.sender, _recipient, _amount);
    }

function transferFrom(...
...
    if(taxTransfers) {
        (uint256 _fee, uint256 _netAmount) = _calculateFee(_amount);
        _transfer(_from, treasury, _fee);
        _transfer(_from, _to, _netAmount);
    } else {
        _transfer(_from, _to, _amount);
    }
```

There are a two approaches I can think of to reduce the repetitiveness:

- Implement the tax by overriding OpenZeppelin ERC20's \_transfer() function, which is used by both transfer() and transferFrom(). From the NatSpec comments on \_transter(), it seems like the developers imagined that function to be overriden to implement tax like functionalities.
- Change \_calculateFee() to something like \_transferTaxAndReturnPostTaxAmount() (aka do both the transfer and return the amounts)

## **[Q-2]** Dedupe totalContributionsMap and redeemedWeiContributionsMap to reduce gas cost

In the current implementation, contributions are tracked by incrementing totalContributionsMap[msg.sender] and redeems are tracked by incrementing redeemedWeiContributionsMap[msg.value]. One way to optimize gas costs would be to only have a single map, and increment it for contributions and decrement it for redeems. I believe the author kept two different maps to show total lifetime redeemable value (aka already redeembed + left to redeem) in the frontend implementation ("Displays how many tokens the user can redeem (once the open phase is reached" as per the spec). My interpretation of the spec would have been to show how much they have remaining to redeem, which doesn't require having two maps. But feel free to ignore if that interpretation is incorrect.

## **[Q-3]** Consider adding explicit test that tax on SpaceCoin transfers impacts ICO redeems

As per the spec, if 2% tax on SpaceCoin is enabled, it should apply to all transfers, which I assume includes redeems on ICO. For example if a user contributed 100 ETH to the ICO, and tax is enabled, redeeming it should result in gaining (100*5)*0.98 = 490 SPC. While the actual code handles this correctly, I would suggest adding an explicit test case for it. This would essentually be the same as the "should allow investors to redeem..." tests, except with a call to SpaceCoin.setTaxTransfers(true) in the beginning, and expected redeemed amount adjusted by 0.98x.
