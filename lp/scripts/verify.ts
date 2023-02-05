import { ethers } from 'hardhat'
import {
  defaultIcoConstructorArgs,
  SpaceCoinConstructorArgs,
  SpaceRouterConstructorArgs,
  verifyIcoSourceCode,
  verifySpaceceLp,
  verifySpacecoinSourceCode,
  verifySpaceRouter,
} from './helpers/verification'

const ICO_ADDRESS = '0x00f621b0b81827A7e1e58951C4F8C94383A3C42A'
const TOKEN_ADDRESS = '0xb5449af96bC7793266255342e832A3D2F25a2126'
const SPACE_LP_ADDRESS = '0x9Aae7B61653257e5DfF1535bA67aFFA7EB4BFe93'
const SPACE_ROUTER_ADDRESS = '0x77f43bf423226a6e66D23C176cE03AF80b7988ac'

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Verifying ICO contract on Etherscan...', defaultIcoConstructorArgs)
  try {
    await verifyIcoSourceCode(ICO_ADDRESS, defaultIcoConstructorArgs)
  } catch (err) {
    console.warn('Failed to verify ICO contract on Etherscan', err)
  }

  const spcVerificationArgs: SpaceCoinConstructorArgs = {
    icoAddress: ICO_ADDRESS,
    owner: deployer.address,
    tresuryAddress: defaultIcoConstructorArgs.tresuryAddress,
  }
  console.log('Verifiying SpaceCoin contract on Etherscan...', spcVerificationArgs)
  try {
    await verifySpacecoinSourceCode(TOKEN_ADDRESS, spcVerificationArgs)
  } catch (err) {
    console.warn('Failed to verify SpaceCoin contract on Etherscan', err)
  }

  console.log('Verifying SpaceLP contract on Etherscan...', { spaceCoinAddress: TOKEN_ADDRESS })
  try {
    await verifySpaceceLp(SPACE_LP_ADDRESS, TOKEN_ADDRESS)
  } catch (err) {
    console.warn('Failed to verify SpaceLP contract on Etherscan', err)
  }

  const routerVerificationArgs: SpaceRouterConstructorArgs = {
    spaceLpAddress: SPACE_LP_ADDRESS,
    spaceCoinAddress: TOKEN_ADDRESS,
  }
  console.log('Verifying SpaceRouter contract on Etherscan...', routerVerificationArgs)
  try {
    await verifySpaceRouter(SPACE_ROUTER_ADDRESS, routerVerificationArgs)
  } catch (err) {
    console.warn('Failed to verify SpaceRouter contract on Etherscan', err)
  }

  console.log('Done!')
}

main().catch((error) => {
  console.error(error)
})
