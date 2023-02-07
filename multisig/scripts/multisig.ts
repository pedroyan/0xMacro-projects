import { ethers } from 'hardhat'

const PROXY_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
const LOGIC_IMPROVED = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'

async function main() {
  const [_0, _1, _2, _3, _4, multisig] = await ethers.getSigners()

  const Logic = await ethers.getContractFactory('Logic')

  // Confirm the proxy is up and running
  const proxiedLogic = Logic.attach(PROXY_ADDRESS).connect(multisig)

  // 1 - Confirm correct proxy is being used
  const someVariable = await proxiedLogic.someVariable()
  console.log('Some variable is:', someVariable)

  // 2 - Upgrade the contract
  await proxiedLogic.upgrade(LOGIC_IMPROVED).then((tx) => tx.wait())
  const LogicImproved = await ethers.getContractFactory('LogicImproved')

  // 3 - Confirm the new contract is being used
  const proxiedLogicImproved = LogicImproved.attach(PROXY_ADDRESS).connect(multisig)
  const someVariableImproved = await proxiedLogicImproved.someVariable()
  const anotherVariable = await proxiedLogicImproved.anotherVariable()
  console.log('Fetched variables on upgraded contract:', { someVariableImproved, anotherVariable })

  await proxiedLogicImproved.setSomeVariable(12).then((tx) => tx.wait())
  await proxiedLogicImproved.setOtherVariable(10).then((tx) => tx.wait())
  const anotherVariable2 = await proxiedLogicImproved.anotherVariable()
  const someVariable2 = await proxiedLogicImproved.someVariable()
  console.log('Fetched updated vars on upgraded contract:', { anotherVariable2, someVariable2 })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
