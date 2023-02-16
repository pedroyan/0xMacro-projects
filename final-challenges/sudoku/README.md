# Sudoku

Your colleague has written a pull request and is waiting for you to review it. **Your task is to find all of the vulnerabilities, gas optimizations, and code quality issues in your colleague's PR.**

## High Severity Issues

### [H-1] Proposers can override the `ChallengeReward` for a given challenge and grief solvers.

In the `createReward` function of the `SudokuExchange` contract at lines 34-41, the contract allows for proposers to override rewards already set by other proposers to a given challenge, effetively allowing malicious entities to grief proposers and solvers alike.

```solidity
function createReward(ChallengeReward memory challengeReward) public {
  // first transfer in the user's token approved in a previous transaction
  challengeReward.token.transferFrom(msg.sender, address(this), challengeReward.reward);

  // now store the reward so future callers of SudokuExchange.claimReward can solve the challenge
  // and claim the reward
  rewardChallenges[address(challengeReward.challenge)] = challengeReward; // <<--This unchecked storage write allows for reward override.
}
```

This happens because the function does not check if a reward already exists for a given challenge address before settting the provided reward.

A challenge can be griefed with the following steps:

1. Honest proposer puts up a `ChallengeReward` of `1000 USDC` for challenge `0xa`.
2. Honest proposer locks `1000` USDC in the exchange.
3. Malicious proposers overrides the `ChallengeReward` for `0xa` and sets it to `420 BOGUS`, where `BOGUS` is a fake ERC-20 created by the attacker.

Because of this attack:

- Solvers no longer have an incentive to complete the Sudoku challenge, since they will be awarded a worthless token.
- The proposer's USDC is now permanently locked in the contract.

Consider checking if a challenge already has a reward assigned to it and revert before setting a new reward.

### [H-2] Exchange transfer tokens to itself instead of transferring it to the solver.

In the `claimReward` function of the `SudokuExchange` contract at lines 44-60, when the contract deems a solution valid, it transfers the tokens to itself instead of transferring them to the solver, effectively locking the tokens forever in the exchange:

```solidity
function claimReward(SudokuChallenge challenge, uint8[81] calldata solution) public {
  // ...
  // they solved the Sudoku challenge! pay them and then mark the challenge as solved
  ChallengeReward memory challengeReward = rewardChallenges[address(challenge)];
  challengeReward.token.transfer(address(this), challengeReward.reward); // <<-- Should transfer tokens to solver, not to itself.
  challengeReward.solved = true;
}
```

Consider transferring the reward to the solver (`msg.sender`) once the solution is complete.

### [H-3] Reward can be claimed multiple times

In the `claimReward` function of the `SudokuExchange` contract at lines 44-60, the contract does not check if a challenge was already solved before sending solution rewards nor properly persists the `solved = true` state, since it is writing that value to the EVM memory:

```solidity
function claimReward(SudokuChallenge challenge, uint8[81] calldata solution) public {
  // does this challenge even have a reward for it?
  require(
    address(rewardChallenges[address(challenge)].token) != address(0x0),
    'Sudoku challenge does not exist at this address'
  );

  // MISSING CHECK: Is the challenge already solved?

  // now try to solve it
  bool isCorrect = challenge.validate(solution);

  require(isCorrect, 'the solution is not correct');

  // they solved the Sudoku challenge! pay them and then mark the challenge as solved
  ChallengeReward memory challengeReward = rewardChallenges[address(challenge)];
  challengeReward.token.transfer(address(this), challengeReward.reward);
  challengeReward.solved = true; // BAD WRITE: Writes to memory, not persistent storage.
}
```

This means that even if `[H-1]` and `[H-2]` are fixed, solvers would still be able to drain the the entire exchange balance of the ERC-20 specified in the reward by re-submitting the solution multiple times.

To fix the issue, consider implementing the adjustments outlined below:

```solidity
function claimReward(SudokuChallenge challenge, uint8[81] calldata solution) public {
  // FIX 1: Obtain a storage reference to the ChallengeReward, to save on gas by not loading the entire storage content
  // in the memory and persist writes
  ChallengeReward storage challengeReward = rewardChallenges[address(challenge)];
  ERC20 token = challengeReward.token;

  // does this challenge even have a reward for it?
  require(address(token) != address(0x0), 'Sudoku challenge does not exist at this address');

  // FIX 2: Check if the challenge has already been solved before trying to solve it
  require(!challengeReward.solved, 'Sudoku challenge has already been solved');

  // now try to solve it
  bool isCorrect = challenge.validate(solution);
  require(isCorrect, 'the solution is not correct');

  // FIX 3: Mark the challenge as solved before transferring the reward to the solver to prevent reentrant calls
  // from claiming the reward multiple times.
  challengeReward.solved = true;

  // they solved the Sudoku challenge! pay them and then mark the challenge as solved
  token.transfer(address(this), challengeReward.reward);
}
```

## Medium Severity Issues

### [M-1] Validate function should be implemented on the exchange, not the challenge

In the `claimReward` function of the `SudokuExchange` contract at lines 44-60, the contract validates if a solution is correct by calling the `validate` function of the challenge address.

```solidity
function claimReward(SudokuChallenge challenge, uint8[81] calldata solution) public {
  // ...

  // now try to solve it
  bool isCorrect = challenge.validate(solution);

  // ...
}
```

This is problematic because has ruleset that can be programatically verified by a single algorithm given an original board and a solution board, which means that implementing verification at the exchange level allows for a single audited verification code to validate all challenges and increase confidence in the system.

Furthermore, by delegating the verification logic to the proposer-supplied challenge contracts, we increase gas costs for deploying a challenge and open proposers to the possibility of submitting flawed verification code that may get exploited by attackers to falsely claim the rewards.

Consider implementing a single cannonical verification code and use that to validate the proposed solution against the challenge board.

## Low Severity Issues

### [L-1] Proposers may get their fund locked forever if noone solves the challenge

When proposers create a challenge via the `createReward` function, they don't have an option to withdraw the challenge after a given amount of time has passed. This means that proposers might have their rewards locked forever on the exchange if no solver is able to complete their challenge.

Consider adding an expiration to the reward to allow proposers to claim back the deposited reward tokens and prevent them from having their funds locked indefinitely.

## Gas Optimizations

### [G-1] Optimizer should be enabled

Consider enabling the Gas Optimizer for easy gas efficiency gains on your contracts and fine-tune how many runs you should set by measuring gas consumption using `REPORT_GAS=true npx hardhat test`

### [G-2] Use `calldata` for struct arguments on the `createReward` function

In the `createReward` function of the `SudokuExchange` contract, the following function signature is defined:

```solidity
function createReward(ChallengeReward memory challengeReward) public
```

Consider using `calldata` to reduce gas costs associated with reading variables from the struct.

### [G-3] Use a `storage` reference to the `challengeReward` obtained in `claimReward`

In the `claimReward` function of the `SudokuExchange` contract at lines 44-60, the logic loads the full challenge struct into `memory`, incurring unecessary gas costs and contributing to the problem outlined in `[H-3]`.

```solidity
    ChallengeReward memory challengeReward = rewardChallenges[address(challenge)];
    challengeReward.token.transfer(address(this), challengeReward.reward);
    challengeReward.solved = true;
```

Consider holding a `storage` reference to avoid allocating memory unnecessarily and persist changes to storage.

### [G-4] Mark `createReward` and `claimReward` as external

Since the `createReward` and `claimReward` functions are only invoked via external calls, both can be marked as `external` and save on gas by preventing the final bytecode from copying arguments into memory and instead allowing the function to read straight from the calldata.

### [G-5] Redundant storage of the `challenge` address

The `SudokuExchange` defines the following types and variables:

```
  /** All the data necessary for solving a Sudoku challenge and claiming the reward */
  struct ChallengeReward {
    SudokuChallenge challenge;
    uint256 reward;
    ERC20 token;
    bool solved;
  }

  // stores the Sudoku challenges and the data necessary to claim the reward
  // for a successful solution
  // key: SudokuChallenge
  // value: ChallengeReward
  mapping(address => ChallengeReward) rewardChallenges;

```

Since all interactions between the `challenge` address is already stored as the key for the `rewardChallenges`, it can be removed from the `ChallengeReward` struct and save on gas costs associated with writing that value to storage

## Code Quality Issues

### [Q-1] Lack of events being emitted

Despite changing the state of the contract, the `createReward` and `claimReward` functions do not emit events.

Consider emitting events from those functions to allow off-chain actors to easily reconcile themselves with the current contract state.

### [Q-2] Inconsitent NatSpec Comments

Although mosts functions and variables are documented, none is following the [NatSpec format](https://docs.soliditylang.org/en/v0.8.17/natspec-format.html) and the `createReward` is missing documentation altogether.

Consider adding NatSpec comments to all functions and variables in the contract.

### [Q-3] Useless empty constructor

Consider removing the useless empty constructor defined in the `SudokuExchange` to improve legibility of the code.
