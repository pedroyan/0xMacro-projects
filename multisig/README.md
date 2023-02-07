# Multisig Project

## Deliverables

My Gnosis Safe can be found here: https://app.safe.global/gor:0xBa6b4dF30622fbbE92Fe8Ba34d6B70d536C5215f

Contracts have been deployed to Sepolia at the following addresses:

| Contract      | Address Etherscan Link                                                         | Transaction Etherscan Link                                                                        |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Multisig      | https://goerli.etherscan.io/address/0xBa6b4dF30622fbbE92Fe8Ba34d6B70d536C5215f | https://goerli.etherscan.io/tx/0x3c2fbf504921a6393ec24dba20ed2c2c933e5cd4be04cc7298f7f2fb34231cde |
| Proxy         | https://goerli.etherscan.io/address/0xFa8AADCc6727c6b4f930C3F2298D312f9AC705FE | https://goerli.etherscan.io/tx/0x81b8c8d5b7bea73d1260be413906e02b4f96b538bf4b902e01dec499fbf815c4 |
| Logic         | https://goerli.etherscan.io/address/0x9Aae7B61653257e5DfF1535bA67aFFA7EB4BFe93 | https://goerli.etherscan.io/tx/0x83f0d0ce449df40d1235771701b29533fdf8fb5c0d0742d74269a2c590c41339 |
| LogicImproved | https://goerli.etherscan.io/address/0x77f43bf423226a6e66D23C176cE03AF80b7988ac | https://goerli.etherscan.io/tx/0x3e90c0fe2270cf90b2c9169699426f5b4d1398ec4d911e554ff95ea11faa6298 |

Transaction for transferring the ownership of the **Proxy** contract to the multisig:

| Contract | Transaction Etherscan Link                                                                        |
| -------- | ------------------------------------------------------------------------------------------------- |
| Proxy    | https://goerli.etherscan.io/tx/0xd23bf729070c81b504f1bde789a5a0449648f346bf368f5bd783516dd3a189c6 |

Transaction calling `upgrade(address)` to upgrade the **Proxy** from **Logic** -> **LogicImproved**

| Contract | Function called | Transaction Etherscan Link                                                                        |
| -------- | --------------- | ------------------------------------------------------------------------------------------------- |
| Proxy    | `upgrade`       | https://goerli.etherscan.io/tx/0xf4ee2152baffb1cd79d9e7850595b76f70030041f5815defbc10f242f3e7e607 |

# Design exercise

> Consider and write down the positive and negative tradeoffs of the following configurations for a multisig wallet. In particular, consider how each configuration handles the common failure modes of wallet security.

> - 1-of-N
> - M-of-N (where M: such that 1 < M < N)
> - N-of-N

## 1-of-N

### Advantages

- Quickest transaction execution.
- If one key is lost, there exists N-1 backups to manage the assets and interactions of the multisig.

### Disadvantages

- **Less safe than a traditional EOA**, since there exists multiple "single points of failure".
  - If any one of the keys are compromised, the entire multisig is compromised.

### M-of-N (where M: such that 1 < M < N)

### Advantages

- Safer than tradiotional EOAs, since `M` keys must be compromised instead of 1 to allow the movement of assets from the multisig.
- Up to `N - M` keys can be lost without the owners loosing access to the multisig.

### Disadvantages

- Slower transaction execution, since `M` distinct approvals are needed.
- Increased gas costs, since `M` separate transactions must be issued.

### N-of-N

### Advantages

- Safest multisig configuration possible, since all `N` keys must be compromised.

### Disadvantages

- **If one key is lost, owners loose access to the multisig.**
- Slowest transaction execution, since `N` distinct approvals are needed.
- Increased gas costs, since `N` separate transactions must be issued.
