# ICO Project

## Setup

See [README-Setup.md](./README-Setup.md)

## Technical Spec

<!-- Here you should list the technical requirements of the project. These should include the points given in the project spec, but will go beyond what is given in the spec because that was written by a non-technical client who leaves it up to you to fill in the spec's details -->

### SpaceCoin ERC-20 Contract

Contract to host the SpaceCoin ERC-20 Logic.

**Token Properties**

- Name: `SpaceCoin`
- Symbol: `SPC`
- Decimals: `18`
- Max Supply: `500,000 SPC` ([CONFIRMED](https://discord.com/channels/870313767873962014/1063506003599032400/1063918723297185862))
  - `150,000 SPC` goes to the ICO Contract as soon as that is informed by the owner
  - `350,000 SPC` goes to the treasury account set in the constructor

**Tax**

- Token should have a toggleable tax of 2%
  - Owner is the only address that can turn the tax on/off
  - Tax is **turned off** by default
- The 2% tax should be deducted from the amount sent in the transfer (i.e. if `amount = 100`, then `2` will be sent to the treasury, and the recipient will receive `98` SPC)
- When the 2% tax is on the tax should apply to all transfers, regardless of sender or receiver
- Tax will be round-down ([confirmed](https://discord.com/channels/870313767873962014/1063506003599032400/1064250890040651846))

<!-- Will take in the address to the ICO contract via a ownable function call -->

### ICO Contract

Contract to manage the ICO for SpaceCoin

**Base Functionality**

- Contract must provide a way for any address to contribute ETH to the ICO
  - Over-contribution **is not allowed**, otherwise redemption ratios are skewed.
  - Assuming Alice contribution limit is 1500 ETH and she is at 1499 ETH total contribution. If Alice makes a 3 ETH contribution, the transaction should revert.
- Contract must provide a way for any address to redeem their contributed ETH into `SPC`
  - Redemption rate should be 1:5.
  - e.g. if Bob contributes 1 wei of ETH, he should get back 5 wei of SPC, and if Alice contributes 3 ETH, she should get back 15 SPC.
  - Redemption should only ocurr at the `OPEN` phase of the ICO ([CONFIRMED](https://discord.com/channels/870313767873962014/1063506003599032400/1064497706686484530))
- Contract must provide functionality to pause the following functions:
  - Contributing ETH
  - Redeeming SPC

**Phase Transitions**

- There must be a function, controllable by owner, that advances the ICO contract through the phases one-by-one (no skipping!)
  - The function should protect the owner from accidentally calling it twice (one way to implement this is through a [compare and swap algo](https://en.wikipedia.org/wiki/Compare-and-swap))
- Should we wait for a phase to achieve full contribution before transitioning? Ask later

> Note: In practice, the "move a phase forwards" part is usually based on time rather than manual shifting. We have it this way for the purpose of the class.

**ICO Phases**

3 Phases (`SEED`, `GENERAL`, `OPEN`)

- `SEED` Phase
  - Only addresses in the allowlist can contribute in this phase
    - Allowlist must be set once in the constructor
    - Should **not** allow existing allowlisted addresses to be removed
  - Individual contribution limit of 1_500 ETH
  - Total Contribution Limit for the `SEED` phase: 15_000 ETH
- `GENERAL` Phase
  - Any address can contribute in this phase
  - Individual contribution limit of 1_000 ETH
    - When checking the limits, you should look at the cumulative contributions across phases.
    - For example, if someone contributes 1_250 ETH in `SEED` Phase, they will not be able to contribute in the `GENERAL` Phase because they will have already reached the 1_000 ETH individual limit for the `GENERAL` phase.
  - Total Contribution Limit for the `GENERAL` phase: 30_000 ETH
    - Similarly, if the total contribution across all contributors after `SEED` phase is 10_000 ETH, then at most 20_000 ETH can be contributed in `GENERAL` phase because the total limit is 30_000 for the `GENERAL` phase.
- `OPEN` Phase
  - A total contributors `OPEN` phase limit of 30_000 ETH
  - `SPC` can now be redeemed by contributors ([CONFIRMED](https://discord.com/channels/870313767873962014/1063506003599032400/1064497706686484530))

## Code Coverage Report

| File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines |
| ------------- | ------- | -------- | ------- | ------- | --------------- |
| contracts/    | 100     | 97.92    | 100     | 98.75   |                 |
| Ico.sol       | 100     | 97.37    | 100     | 98.15   | 225             |
| Ownable.sol   | 100     | 100      | 100     | 100     |                 |
| SpaceCoin.sol | 100     | 100      | 100     | 100     |                 |
| All files     | 100     | 97.92    | 100     | 98.75   |                 |

## Design Exercise Answer

<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->

> The base requirements give contributors their SPC tokens immediately. How would you design your contract to vest the awarded tokens instead, i.e. award tokens to users over time, linearly?

### Solution Overview

The solution would consist in tracking the contribution and the date it was made in a mapping, and use that data to calculate the amount of tokens to be released to the contributor.

```solidity
struct Contribution {
    // Timestamp of the contribution. Valid for a very long time.
    uint48 timestamp;

    // The amount of wei contributed.
    uint256 amount;
}
x
mapping(address => Contribution[]) public contributionsMap;

```

Whenever a contributor requests to withdraw their tokens, the contract would calculate the amount of tokens to be released based on the amount of time that has passed since the contribution was made.

```solidity
/**
 * @notice Iterate over all contributions and sum up the vested amount for a given investor
 */
function getVestedAmount(address _investor) public view returns (uint256) {
  // ...
}

```

After the vested amount is calculated, the redemption logic stays the same as the current implementation: The vested amount is compared against the amount of wei the contributor already redeemed, and the difference would be released to the contributor in the form of tokens.

### Benefits of the approach

- Simple
- Does not require significantly changing the inner workings of the contract

### Drawbacks of the approach

- Redemption Gas costs increases linearly with the number of contributions an investor made to the ICO

## Testnet Deploy Information

| Contract  | Address Etherscan Link                                                               |
| --------- | ------------------------------------------------------------------------------------ |
| SpaceCoin | https://sepolia.etherscan.io/address/0xA2E3a97430b3c917b401cC4A6e18e9e93FF004be#code |
| ICO       | https://sepolia.etherscan.io/address/0x3aF4a1Cc4117628CBb5dcA07df5F6BDBf7F72E04#code |
