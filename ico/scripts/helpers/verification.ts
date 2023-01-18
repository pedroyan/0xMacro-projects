import hre from 'hardhat'

const TREASURY = '0xb795B9CD75f622C54b7c2bEF6f94dE11085dFaC7' // pedroyan.eth
export const ICO_ADDRESS = '0x3aF4a1Cc4117628CBb5dcA07df5F6BDBf7F72E04'
const CREATOR = '0x82E51427C8020d84B6A996394fdF5C607Ff70870'

export type IcoAddressContructorArgs = {
  tresuryAddress: string
  passlistedInvestors: string[]
}

export const constructorArgs: IcoAddressContructorArgs = {
  tresuryAddress: TREASURY,
  passlistedInvestors: [
    '0xacabB6F6EAF4bf2573B371Ab2286d115e8eA28A4', // Account6
    '0x25bC6B743592FeA6d971AB3b0006c2092dd9fe00', // 0xMacro Account
  ],
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

export const spaceCoinConstructorArgs: SpaceCoinConstructorArgs = {
  tresuryAddress: TREASURY,
  icoAddress: ICO_ADDRESS,
  owner: CREATOR,
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
