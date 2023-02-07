import { ethers } from 'hardhat'
import { verifyLogic, verifyLogicImproved, verifyProxy } from './helpers/verification'

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  // Wait for a 1 minute delay for etherscan to index the block
  console.log('Waiting 1 minute for etherscan to index the block...')
  await sleep(60_000)

  await verifyLogic(logic.address).catch((error) => {
    console.error('Failed to verify logic', error)
  })

  await verifyLogicImproved(logicImproved.address).catch((error) => {
    console.error('Failed to verify logic improved', error)
  })

  await verifyProxy(proxiedLogic.address, logic.address).catch((error) => {
    console.error('Failed to verify proxy', error)
  })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
