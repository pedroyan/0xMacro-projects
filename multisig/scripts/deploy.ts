import { ethers } from 'hardhat'

const configObject = {
  31337: {
    safeAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', // Account #5
  },
  5: {
    safeAddress: '0xBa6b4dF30622fbbE92Fe8Ba34d6B70d536C5215f', // Goerli Multisig
  },
}

type AddressConfig = (typeof configObject)[31337]
type MaybeConfig = AddressConfig | undefined

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)

  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`)

  const networkId = (await ethers.provider.getNetwork()).chainId
  console.log('Network ID:', (await ethers.provider.getNetwork()).chainId)
  const config: MaybeConfig = (configObject as Record<number, MaybeConfig>)[networkId]
  if (!config) {
    throw new Error(`No config for network ID ${networkId}`)
  }

  console.log(`Found config object for network ${networkId}:`, config)

  // 1 - Deploy Logic.sol
  const Logic = await ethers.getContractFactory('Logic')
  const logic = await Logic.deploy()
  await logic.deployed()
  console.log('Logic implementation deployed to:', logic.address)

  // 2 - Deploy logic improved
  const LogicImproved = await ethers.getContractFactory('LogicImproved')
  const logicImproved = await LogicImproved.deploy()
  await logicImproved.deployed()
  console.log('LogicImproved implementation deployed to:', logicImproved.address)

  // 3 - Deploy Proxy.sol pointing initially to logic
  const Proxy = await ethers.getContractFactory('Proxy')
  const proxy = await Proxy.deploy(logic.address)
  await proxy.deployed()
  console.log('Proxy deployed to:', proxy.address)

  // 4 - Initialize the proxy
  const proxiedLogic = Logic.attach(proxy.address).connect(deployer)
  await proxiedLogic.initialize(1).then((tx) => tx.wait())
  console.log('Proxy initialized!')

  // 5 - Transfer ownership of proxy to safe
  await proxiedLogic.transferOwnership(config.safeAddress).then((tx) => tx.wait())
  console.log(`Proxy ownership transferred to safe: ${config.safeAddress}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
