import { ethers } from 'hardhat'
import { ICO__factory } from '../typechain-types'
import { verifyIcoSourceCode, constructorArgs } from './helpers/verification'

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)

  console.log('Account balance:', (await deployer.getBalance()).toString())

  const IcoFactory = (await ethers.getContractFactory('ICO')) as ICO__factory
  const ico = await IcoFactory.deploy(constructorArgs.tresuryAddress, constructorArgs.passlistedInvestors)

  console.log('Ico Address:', ico.address)
  console.log('Token Address:', await ico.spaceCoin())

  console.log('Verifying contract on Etherscan...')
  await verifyIcoSourceCode(ico.address, constructorArgs)
}

main().catch((error) => {
  console.error(error)
})
