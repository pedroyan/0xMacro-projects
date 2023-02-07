import { verifyLogic, verifyLogicImproved, verifyProxy } from './helpers/verification'

async function main() {
  const logicAddress = '0x9Aae7B61653257e5DfF1535bA67aFFA7EB4BFe93'
  await verifyLogic(logicAddress).catch((error) => {
    console.error('Failed to verify logic', error)
  })

  await verifyLogicImproved('0x77f43bf423226a6e66D23C176cE03AF80b7988ac').catch((error) => {
    console.error('Failed to verify logic improved', error)
  })

  await verifyProxy('0xFa8AADCc6727c6b4f930C3F2298D312f9AC705FE', logicAddress).catch((error) => {
    console.error('Failed to verify proxy', error)
  })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
