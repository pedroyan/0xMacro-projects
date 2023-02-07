import hre from 'hardhat'

export function verifyLogic(logicAddress: string): Promise<any> {
  console.log('Verifying logic contract...', { logicAddress })
  return hre.run('verify:verify', {
    address: logicAddress,
    constructorArguments: [],
  })
}

export function verifyLogicImproved(logicImprovedAddress: string): Promise<any> {
  console.log('Verifying logic improved contract...', { logicImprovedAddress })
  return hre.run('verify:verify', {
    address: logicImprovedAddress,
    constructorArguments: [],
  })
}

export function verifyProxy(proxyAddress: string, logicAddress: string): Promise<any> {
  console.log('Verifying proxy contract...', { proxyAddress, logicAddress })
  return hre.run('verify:verify', {
    address: proxyAddress,
    constructorArguments: [logicAddress],
  })
}
