import hre from 'hardhat'
import { ACCOUNT_6, MACRO_ACCOUNT, TREASURY } from './addresses'

export type IcoAddressContructorArgs = {
  tresuryAddress: string
  passlistedInvestors: string[]
}

export const defaultIcoConstructorArgs: IcoAddressContructorArgs = {
  tresuryAddress: TREASURY,
  passlistedInvestors: [ACCOUNT_6, MACRO_ACCOUNT],
}

export function verifyIcoSourceCode(icoAddress: string, constructorArguments: IcoAddressContructorArgs): Promise<any> {
  return hre.run('verify:verify', {
    address: icoAddress,
    constructorArguments: [constructorArguments.tresuryAddress, constructorArguments.passlistedInvestors],
  })
}

export type SpaceCoinConstructorArgs = {
  tresuryAddress: string
  icoAddress: string
  owner: string
}

export function verifySpacecoinSourceCode(
  coindAddress: string,
  constructorArgs: SpaceCoinConstructorArgs,
): Promise<any> {
  return hre.run('verify:verify', {
    address: coindAddress,
    constructorArguments: [constructorArgs.tresuryAddress, constructorArgs.icoAddress, constructorArgs.owner],
  })
}

export function verifySpaceceLp(lpAddress: string, spaceCoinAddress: string): Promise<any> {
  return hre.run('verify:verify', {
    address: lpAddress,
    constructorArguments: [spaceCoinAddress],
  })
}

export type SpaceRouterConstructorArgs = {
  spaceCoinAddress: string
  spaceLpAddress: string
}

export function verifySpaceRouter(routerAddress: string, constructorArgs: SpaceRouterConstructorArgs): Promise<any> {
  return hre.run('verify:verify', {
    address: routerAddress,
    constructorArguments: [constructorArgs.spaceLpAddress, constructorArgs.spaceCoinAddress],
  })
}
