https://github.com/0xMacro/student.pedroyan/tree/703ef8a5aacb4029af0d70eb75f9bcd2b8d3c1c0/ico

Audited By: CheeChyuan

# General Comments

CheeChyuan:
Great job! The codebase is well commented and really easy for me to follow and read! Your test is very comprehensive too. Keep up the very very good work. I don't see any vulnerabilities, just a few nitpicks on the code. Also an extra comment on your design exercise

# Design Exercise

You have roughly described a right approach but it would also be nice should you provide a simple pseudocode that explains your idea especially on the algorithm that is related to token vesting over time

You did create an array to store contribution date of each contribution and have the ability to allow contributions that were contributed earlier to be redeemed earlier as well. However I do see a potential issue here.

1. Say, the general phase has been ongoing for a much longer period than expected
2. The moment project has advanced to open stage `block.timestamp - timestamp` will be a huge number as the `timestamp` is a much smaller number.
3. Contributors will be able to immediately withdraw most, if not all of the SPC which was supposed to be vested.

Also, should the contributor spreaded out his/her contributions many times in smaller amount, we may even result in the for loop running out of gas and create a situation where the contributor will not be able to withdraw his/her SPC :(

My recommendation will be to have a common start date, which is the time the project has advanced to Open stage. By also having a common start date for all contributions, we are able to avoid looping through all contributions.

# Issues

## **[Q-1]** Transfer overrides could be combined

Rather than individually overriding the OZ `transfer` and `transferFrom` functions to collect tax, you could just override `_transfer` which they both call.

## **[Q-2]** Redundant Event Declaration

In Spacecoin.sol line 23, `Initialized` is seemingly not being used

```
    /// @notice Event emitted when the contract is properly initialized
    event Initialized();
```

## Nits

## **[N-1]** Using a 'less' random number

In Spacecoin.sol line 11. can we use 2 instead and reduce the divisor in line 105 to be 100 .
200 seems to have an arbitrary decimal place

```
uint256 public constant TRANSFER_FEE_BPS = 200;
```

## **[N-2]** Using a more intuitive naming

In Spacecoin.sol line 17. naming not very intuitive, consider using `hasTransferTax` perhaps

```
bool public taxTransfers;
```

And in Ico.sol line 83. consider `investorContributionsMap` instead

```
    mapping(address => uint256) public totalContributionsMap;

```

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | 0     |
| Unfinished features        | 0     |
| Extra features             | 0     |
| Vulnerability              | 0     |
| Unanswered design exercise | 0     |
| Insufficient tests         | 0     |
| Technical mistake          | 0     |

Total: 0
