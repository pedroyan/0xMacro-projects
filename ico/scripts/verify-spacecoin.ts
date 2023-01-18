import { spaceCoinConstructorArgs, verifySpacecoinSourceCode } from './helpers/verification'

const COIN_ADDRESS = '0xA2E3a97430b3c917b401cC4A6e18e9e93FF004be'

async function main() {
  await verifySpacecoinSourceCode(COIN_ADDRESS, spaceCoinConstructorArgs)
}

main().catch((error) => {
  console.error(error)
})
