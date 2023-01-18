import { ethers } from 'ethers'

import IcoJSON from '../../artifacts/contracts/Ico.sol/Ico.json'
import SpaceCoinJSON from '../../artifacts/contracts/SpaceCoin.sol/SpaceCoin.json'

const provider = new ethers.providers.Web3Provider(window.ethereum)
const signer = provider.getSigner()

const icoAddr = '0x3aF4a1Cc4117628CBb5dcA07df5F6BDBf7F72E04'
const icoContract = new ethers.Contract(icoAddr, IcoJSON.abi, provider)

const spaceCoinAddr = '0xA2E3a97430b3c917b401cC4A6e18e9e93FF004be'
const spaceCoinContract = new ethers.Contract(spaceCoinAddr, SpaceCoinJSON.abi, provider)

const ICO_MAXIMUM_SPC_TOKENS = ethers.utils.parseUnits('150000', 18)

console.log('Ico contract address:', { icoContract, spaceCoinContract })

async function connectToMetamask() {
  try {
    console.log('Signed in as', await signer.getAddress())
  } catch (err) {
    console.log('Not signed in')
    await provider.send('eth_requestAccounts', [])
  }
}

async function refreshValues() {
  const [totalContribution, spcBalance, currentSignerContribution] = await Promise.all([
    icoContract.totalContributions(),
    spaceCoinContract.balanceOf(icoAddr),
    icoContract.totalContributionsMap(signer.getAddress()),
  ])

  // Left to buy
  const boughtSpc = totalContribution.mul(5)

  // Left to claim
  const spcLeft = ICO_MAXIMUM_SPC_TOKENS.sub(boughtSpc)

  // Redeemable SPC
  const redeemableSpc = currentSignerContribution.mul(5)

  ico_spc_left.innerHTML = ethers.utils.formatUnits(spcLeft, 18)
  ico_spc_claim.innerHTML = ethers.utils.formatUnits(spcBalance, 18)
  ico_spc_earned.innerHTML = ethers.utils.formatUnits(redeemableSpc, 18)
}

async function init() {
  await connectToMetamask()
  await refreshValues()
}

init().catch((err) => console.error(err))

ico_spc_buy.addEventListener('submit', async (e) => {
  e.preventDefault()
  ico_error.innerHTML = ''
  ico_spc_buy_btn.disabled = true
  ico_spc_buy_btn.innerHTML = 'Buying...'

  const form = e.target
  const eth = ethers.utils.parseEther(form.eth.value)
  console.log('Buying', eth, 'eth')

  await connectToMetamask()

  try {
    await icoContract
      .connect(signer)
      .contribute({ value: eth })
      .then((tx) => tx.wait())
  } catch (e) {
    // TODO: update the ico_error HTML element if an error occurs
    console.error('error', { e })
    try {
      const error = icoContract.interface.parseError(e.error.data.originalError.data)
      console.warn('Parsed error', { error })
      ico_error.innerHTML = error.name
    } catch (error) {
      ico_error.innerHTML = e?.reason ?? 'An unknown error has occurred'
    }
  }

  await refreshValues().finally(() => {
    ico_spc_buy_btn.disabled = false
    ico_spc_buy_btn.innerHTML = 'Buy'
  })
})
