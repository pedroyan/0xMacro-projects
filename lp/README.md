# LP Project

In this project you're going to extend your previous project by writing a specific type of liquidity pool contract based off of Uniswap V2's decentralized exchange protocol. In doing so you will:

- Learn how liquidity pools work
- Write a Uniswap v2 style liquidity pool contract
- Deploy to a testnet
- Update your Space ICO contract to move its funds to your pool contract
- Extend a frontend for liquidity providers to manage their ETH-SPC LP tokens

LMS Link can be found [here](https://learn.0xmacro.com/training/project-lp/p/1).

## Setup

See [README-Setup.md](./README-Setup.md)

## Technical Spec

### ICO Contract Updates

- Add a withdraw function to your ICO contract that allows you to **move the invested funds out of the ICO contract and into the treasury address.**
- In one of your tests, test the end-to-end process of raising funds via the ICO, withdrawing them to the treasury, and then depositing an even worth of ETH and SPC into your liquidity contract.
<!-- TODO: PEDRO, DO NOT FORGET THE ABOVE!! -->

### Liquidity Pool Contract

Implement a liquidity pool for ETH-SPC. You will need to:

- Write an ERC-20 contract for your pool's LP tokens
- Write a liquidity pool contract that:
  - Mints LP tokens for liquidity deposits (ETH + SPC tokens)
  - Burns LP tokens to return liquidity to holder
  - Accepts trades with a 1% fee

You can use [OpenZeppelin's implementation](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol) for the LP tokens.

### Router contract

Transferring tokens to an LP pool requires two transactions:

1. Trader grants allowance on the Router contract for Y tokens.
1. Trader executes a function on the Router which pulls the funds from the Trader and transfers them to the LP Pool.

Write a router contract to handles these transactions. Be sure it can:

- Add and remove liquidity, without wasting or donating user funds.
- Swap tokens, allowing traders to specify a minimum amount out for the output token.

Additional notes:

- Neither the liquidity pool nor the router does does not need to deal with the 2% SPC tax. [Source](https://discord.com/channels/870313767873962014/1068580094559408238/1070812008997462056)

## Code Coverage Report

<!-- Copy + paste your coverage report here before submitting your project -->
<!-- You can see how to generate a coverage report in the "Solidity Code Coverage" section located here: -->
<!-- https://learn.0xmacro.com/training/project-crowdfund/p/4 -->

## Design Exercise Answer

<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->

> 1. Many liquidity pools incentivize liquidity providers by offering additional rewards for staking their LP tokens - What are the tradeoffs of staking? Consider the tradeoffs for the LPs and for the protocols themselves.

> 2. Describe (using pseudocode) how you could add staking functionality to your LP.

## Testnet Deploy Information

| Contract  | Address Etherscan Link                                                          |
| --------- | ------------------------------------------------------------------------------- |
| SpaceCoin | https://sepolia.etherscan.io/address/0xb5449af96bC7793266255342e832A3D2F25a2126 |
| ICO       | https://sepolia.etherscan.io/address/0x00f621b0b81827A7e1e58951C4F8C94383A3C42A |
| Router    | https://sepolia.etherscan.io/address/0x77f43bf423226a6e66D23C176cE03AF80b7988ac |
| Pool      | https://sepolia.etherscan.io/address/0x9Aae7B61653257e5DfF1535bA67aFFA7EB4BFe93 |

# Hardhat commands

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```
