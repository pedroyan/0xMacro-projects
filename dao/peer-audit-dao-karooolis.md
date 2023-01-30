# Issues

## **[Q-1]** Execute reverts if reward transfer failed

On line 427, CollectorDao.sol, we the following code:

```solidity
    (bool success, ) = msg.sender.call{value: EXECUTION_REWARD}('');
    if (!success) {
        revert ExecutionRewardTransferFailed(proposalId, msg.sender);
    }
```

Since the main goal of the function is to execute proposed functions, consider not reverting the entire execution for the sole reason that the executor can't get rewarded.

## **[Q-2]** Not checking for success in `buyNFTFromMarketplace`

On line 526, CollectorDao.sol, we have the following code:

```solidity
    marketplace.buy{value: msg.value}(nftContract, nftId);
```

Consider checking for success result and reverting if it's false: 

```solidity
    bool success = marketplace.buy{value: msg.value}(nftContract, nftId);
    if (!success) {
        revert CannotBuy();
    }
```
    
This is because the marketplace returns a boolean value which, even if the call does not revert in itself, the falsy return value could still indicate a problem.

## **[Q-3]** Not bubbling up revert message

On line 430, CollectorDao.sol, we have the following code:

```solidity
    (bool success, ) = msg.sender.call{value: EXECUTION_REWARD}('');
    if (!success) {
        revert ExecutionRewardTransferFailed(proposalId, msg.sender);
    }
```

Consider bubbling up revert message to inform the caller of why execution failed. Borrowing from OpenZeppelin implementation, it would look like this:

```solidity
    function execute() {
        ...
        (bool success, bytes memory returndata) = msg.sender.call{value: EXECUTION_REWARD}('');
        _verifyCallResult(success, returndata);
        ...
    }

    function _verifyCallResult(bool success, bytes memory returndata)
        private
        pure
        returns (bytes memory)
    {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert ExecutionFailed("Failed without revert reason");
            }
        }
    }
```

# General notes

1. The contract code is a joy to read. The logic is well structured, and comments are very informative.

2. Good job on tight variable packing!

3. Nice usage of inheritance with `CollectorDaoEIP712.sol`.