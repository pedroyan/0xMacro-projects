# Issues

## **[L-1]** If `msg.sender.call()` in  `refund()` re-enters, events will get shown in incorrect order

On line 180, Project.sol has the following code:

```solidity
    (bool _success, ) = msg.sender.call{value: _amount}("");
    if(!_success) revert EthTransferFailed();

    emit RefundIssued(msg.sender, _amount);
```

If `msg.sender.call()` re-enters in `refund()`, the `RefundIssued()` events will be shown in an incorrect order, which might lead to issues for third parties. Consider emitting `RefundIssued()` event before the call:

```solidity
function refund() external requireStatus(ProjectStatus.Failed) {
    ...

    emit RefundIssued(msg.sender, _amount);

    (bool _success, ) = msg.sender.call{value: _amount}('');
    if (!_success) revert EthTransferFailed();
}
```

## **[L-2]** If `msg.sender.call()` in `withdraw()` re-enters, events will get shown in incorrect order

On line 157, Project.sol has the following code:

```solidity
    (bool _success, ) = msg.sender.call{value: _amount}("");
    if(!_success) revert EthTransferFailed();

    emit ProjectWithdrawn(_amount);
```

If `msg.sender.call()` re-enters in `withdraw()`, the `ProjectWithdrawn()` events will be shown in an incorrect order, which might lead to issues for third parties. Consider emitting `ProjectWithdrawn()` event before the call:

```solidity
function withdraw(uint256 _amount) external onlyCreator requireStatus(ProjectStatus.Funded)  {
    emit ProjectWithdrawn(_amount);

    (bool _success, ) = msg.sender.call{value: _amount}("");
    if(!_success) revert EthTransferFailed();
}
```

## **[Q-1]** `withdraw()` lacks funds receiver parameter

On line 157, Project.sol `withdraw()` function has the following function declaration:

```solidity
function withdraw(uint256 _amount) external onlyCreator requireStatus(ProjectStatus.Funded)
```

Consider adding additional `address _receiver` parameter to declare where to withdraw the funds to. It is useful in a scenario where the creator may want to withdraw the funds to a cold wallet, as an example.

## **[Q-2]** `claimBadges()` lacks badges receiver parameter

On line 187, Project.sol `claimBadges()` function has the following function declaration:

```solidity
function claimBadges() external {
```

Consider adding additional `address _receiver` parameter to declare where to send the badges to. It is useful in a scenario where the creator may want to send badges to a cold wallet, as an example.

## **[Q-3]** Use pre-increment in `claimBadges()` mint for loop

On line 201, Project.sol `claimBadges` contains a `for` loop declared as:

```solidity
for(uint256 i = _currentBadges; i < totalBadgesClaimed; i++) {
    _safeMint(msg.sender, i);
}
```

Consider changing the `i++` increment to pre-increment (`++i`) which saves about 5 gas per iteration.

## **[Q-4]** `_getClaimableBadges()` contains redundant `contributor` parameter

On line 189, Project.sol contains the following code:

```solidity
uint256 _claimableBadges = _getClaimableBadges(msg.sender);
```

`_getClaimableBadges(address contributor)` is called with `msg.sender` parameter. However, `_getClaimableBadges` already has access to `msg.sender` and thus the parameter is redundant. It saves 10 gas per call as per measurements.

# General notes

1. Great job on tests! Really like the "Arrange", "Act", "Assert" arrangement. Also, nicely done setting up re-entrancy tests by using custom attacker contracts.

2. Like the usage of modifiers and internal functions like `_getClaimableBadges()`, improves readability significantly.