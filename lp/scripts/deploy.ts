import { ethers } from 'hardhat'
import {
  verifyIcoSourceCode,
  defaultIcoConstructorArgs,
  verifySpacecoinSourceCode,
  SpaceCoinConstructorArgs,
  verifySpaceceLp,
  verifySpaceRouter,
  SpaceRouterConstructorArgs,
} from './helpers/verification'

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)

  console.log('Account balance:', (await deployer.getBalance()).toString())

  console.log('Deploying ICO contract...', { defaultIcoConstructorArgs })
  const IcoFactory = await ethers.getContractFactory('ICO')
  const ico = await IcoFactory.deploy(
    defaultIcoConstructorArgs.tresuryAddress,
    defaultIcoConstructorArgs.passlistedInvestors,
  )

  const spaceCoinAddress = await ico.spaceCoin()
  console.log('Ico Address:', ico.address)
  console.log('Token Address:', spaceCoinAddress)

  console.log('Deploying Liquidity Pool...', { spaceCoinAddress })
  const SpaceLP = await ethers.getContractFactory('SpaceLP')
  const spaceLp = await SpaceLP.deploy(spaceCoinAddress)
  console.log('SpaceLP Address:', spaceLp.address)

  console.log('Deploying SpaceRouter...', { spaceLpAddress: spaceLp.address, spaceCoinAddress })
  const SpaceRouter = await ethers.getContractFactory('SpaceRouter')
  const spaceRouter = await SpaceRouter.deploy(spaceLp.address, spaceCoinAddress)
  console.log('SpaceRouter Address:', spaceRouter.address)

  console.log('Verifying ICO contract on Etherscan...', defaultIcoConstructorArgs)
  try {
    await verifyIcoSourceCode(ico.address, defaultIcoConstructorArgs)
  } catch (err) {
    console.warn('Failed to verify ICO contract on Etherscan', err)
  }

  const spcVerificationArgs: SpaceCoinConstructorArgs = {
    icoAddress: ico.address,
    owner: deployer.address,
    tresuryAddress: defaultIcoConstructorArgs.tresuryAddress,
  }
  console.log('Verifiying SpaceCoin contract on Etherscan...', spcVerificationArgs)
  try {
    await verifySpacecoinSourceCode(spaceCoinAddress, spcVerificationArgs)
  } catch (err) {
    console.warn('Failed to verify SpaceCoin contract on Etherscan', err)
  }

  console.log('Verifying SpaceLP contract on Etherscan...', { spaceCoinAddress })
  try {
    await verifySpaceceLp(spaceLp.address, spaceCoinAddress)
  } catch (err) {
    console.warn('Failed to verify SpaceLP contract on Etherscan', err)
  }

  const routerVerificationArgs: SpaceRouterConstructorArgs = {
    spaceLpAddress: spaceLp.address,
    spaceCoinAddress,
  }
  console.log('Verifying SpaceRouter contract on Etherscan...', routerVerificationArgs)
  try {
    await verifySpaceRouter(spaceRouter.address, routerVerificationArgs)
  } catch (err) {
    console.warn('Failed to verify SpaceRouter contract on Etherscan', err)
  }

  console.log('Done!')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
