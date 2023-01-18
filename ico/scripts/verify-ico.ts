import { verifyIcoSourceCode, constructorArgs, ICO_ADDRESS } from './helpers/verification'

async function main() {
  await verifyIcoSourceCode(ICO_ADDRESS, constructorArgs)
}

main().catch((error) => {
  console.error(error)
})
