/* eslint-disable no-undef */
import { ethers } from 'ethers'
import IcoJSON from '../../artifacts/contracts/Ico.sol/Ico.json'
import SpaceCoinJSON from '../../artifacts/contracts/SpaceCoin.sol/SpaceCoin.json'
import RouterJSON from '../../artifacts/contracts/SpaceRouter.sol/SpaceRouter.json'
import SpaceLpJSON from '../../artifacts/contracts/SpaceLP.sol/SpaceLP.json'

const ICO_MAXIMUM_SPC_TOKENS = ethers.utils.parseUnits('150000', 18)
const provider = new ethers.providers.Web3Provider(window.ethereum)
const signer = provider.getSigner()

const ICO_ADDRESS = '0x00f621b0b81827A7e1e58951C4F8C94383A3C42A'
const TOKEN_ADDRESS = '0xb5449af96bC7793266255342e832A3D2F25a2126'
const SPACE_ROUTER_ADDRESS = '0x77f43bf423226a6e66D23C176cE03AF80b7988ac'
const SPACE_LP_ADDRESS = '0x9Aae7B61653257e5DfF1535bA67aFFA7EB4BFe93'

const icoContract = new ethers.Contract(ICO_ADDRESS, IcoJSON.abi, provider)
const spaceCoinContract = new ethers.Contract(TOKEN_ADDRESS, SpaceCoinJSON.abi, provider)
const routerContract = new ethers.Contract(SPACE_ROUTER_ADDRESS, RouterJSON.abi, provider)
const spaceLpContract = new ethers.Contract(SPACE_LP_ADDRESS, SpaceLpJSON.abi, provider)

console.log('Ico contract address:', { icoContract, spaceCoinContract, routerContract, spaceLpContract })

async function connectToMetamask() {
  try {
    console.log('Signed in as', await signer.getAddress())
  } catch (err) {
    console.log('Not signed in')
    await provider.send('eth_requestAccounts', [])
  }
}

//
// ICO
//
async function refreshValues() {
  const [totalContribution, spcBalance, currentSignerContribution] = await Promise.all([
    icoContract.totalContributions(),
    spaceCoinContract.balanceOf(ICO_ADDRESS),
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

function extractErrorMessage(error, contract) {
  try {
    const parsedError = contract.interface.parseError(error.error.data.originalError.data)
    console.warn('Parsed error', { parsedError })
    return parsedError.name
  } catch (e) {
    return error?.reason ?? 'An unknown error has occurred'
  }
}

async function ensureSpcAllowance(spcIn) {
  // Check allowance of the router contract. If no allowance exists, give maximum allowance
  const allowance = await spaceCoinContract.allowance(signer.getAddress(), SPACE_ROUTER_ADDRESS)
  console.log('Router allowance', allowance.toString())

  if (allowance.lt(spcIn)) {
    console.log('Setting allowance to maximum')
    await spaceCoinContract
      .connect(signer)
      .approve(SPACE_ROUTER_ADDRESS, ethers.constants.MaxUint256)
      .then((tx) => tx.wait())
  }
}

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
    console.warn('Failed to contribute', { e })
    ico_error.innerHTML = extractErrorMessage(e, icoContract)
  }

  await refreshValues().finally(() => {
    ico_spc_buy_btn.disabled = false
    ico_spc_buy_btn.innerHTML = 'Buy'
  })
})

//
// LP
//
// eslint-disable-next-line prefer-const
let currentSpcToEthPrice = 5

provider.on('block', async (n) => {
  const ethForOneSpc = await routerContract.getOptimalDepositEth(ethers.utils.parseEther('1'))
  const numericEth = Number(ethers.utils.formatEther(ethForOneSpc))
  currentSpcToEthPrice = 1 / numericEth

  console.log('New SPC to ETH Price', currentSpcToEthPrice)

  // If this was a production-facing app, we would want to get thes SWAP quotes using getMaximumEthAmountOut and getMaximumSpcAmountOut,
  // and separate that from liquidity provision, which is tax-free. The amountOut in swaps requires solving the constant product formula
  // and takes into account the fees. However, since this is a prototype, frontend, I will be fetching exact swap quotes only at swap time.
})

lp_deposit.eth.addEventListener('input', (e) => {
  lp_deposit.spc.value = +e.target.value * currentSpcToEthPrice
})

lp_deposit.spc.addEventListener('input', (e) => {
  lp_deposit.eth.value = +e.target.value / currentSpcToEthPrice
})

lp_deposit.addEventListener('submit', async (e) => {
  e.preventDefault()
  pool_error.innerHTML = ''
  const form = e.target
  const eth = ethers.utils.parseEther(form.eth.value)
  const spc = ethers.utils.parseEther(form.spc.value)
  console.log('Depositing', eth, 'eth and', spc, 'spc')

  await connectToMetamask()

  pool_deposit_btn.disabled = true
  pool_deposit_btn.innerHTML = 'Depositing...'

  try {
    await ensureSpcAllowance(spc)

    await routerContract
      .connect(signer)
      .addLiquidity(spc, { value: eth })
      .then((tx) => tx.wait())

    console.log('Deposited', eth, 'eth and', spc, 'spc')
  } catch (error) {
    console.warn('Failed to deposit', { error })
    pool_error.innerHTML = extractErrorMessage(error, routerContract)
  } finally {
    pool_deposit_btn.disabled = false
    pool_deposit_btn.innerHTML = 'Deposit'
  }
})

lp_withdraw.addEventListener('submit', async (e) => {
  e.preventDefault()
  console.log('Withdrawing 100% of LP')

  await connectToMetamask()

  pool_withdraw_btn.disabled = true
  pool_withdraw_btn.innerHTML = 'Withdrawing...'

  try {
    // Get all LP shares of the signer
    const lpBalance = await spaceLpContract.balanceOf(signer.getAddress())

    // Check allowance of the router contract for LP Tokens. If no allowance exists, give maximum allowance
    const allowance = await spaceLpContract.allowance(signer.getAddress(), SPACE_ROUTER_ADDRESS)
    console.log('Router LP Token allowance', allowance.toString())

    if (allowance.lt(lpBalance)) {
      console.log('Setting LP Token allowance to maximum')
      await spaceLpContract
        .connect(signer)
        .approve(SPACE_ROUTER_ADDRESS, ethers.constants.MaxUint256)
        .then((tx) => tx.wait())
    }

    // Withdraw all LP shares
    await routerContract
      .connect(signer)
      .removeLiquidity(lpBalance)
      .then((tx) => tx.wait())
  } catch (error) {
    console.warn('Failed to withdraw', { error })
    pool_error.innerHTML = extractErrorMessage(error, routerContract)
  } finally {
    pool_withdraw_btn.disabled = false
    pool_withdraw_btn.innerHTML = 'Withdraw All'
  }
})

//
// Swap
//
let swapIn = { type: 'eth', value: 0 }
let swapOut = { type: 'spc', value: 0 }
switcher.addEventListener('click', () => {
  ;[swapIn, swapOut] = [swapOut, swapIn]
  swap_in_label.innerText = swapIn.type.toUpperCase()
  swap.amount_in.value = swapIn.value
  updateSwapOutLabel()
})

swap.amount_in.addEventListener('input', updateSwapOutLabel)

function updateSwapOutLabel() {
  swapOut.value =
    swapIn.type === 'eth' ? +swap.amount_in.value * currentSpcToEthPrice : +swap.amount_in.value / currentSpcToEthPrice

  swap_out_label.innerText = `${swapOut.value} ${swapOut.type.toUpperCase()}`
}

swap.addEventListener('submit', async (e) => {
  e.preventDefault()
  trade_error.innerHTML = ''
  const form = e.target
  const amountIn = ethers.utils.parseEther(form.amount_in.value)

  const maxSlippage = form.max_slippage.value
  console.log('Swapping', ethers.utils.formatEther(amountIn), swapIn.type, 'for', swapOut.type)

  await connectToMetamask()

  trade_btn.disabled = false
  trade_btn.innerHTML = 'Swapping...'

  try {
    const actualAmountOut =
      swapIn.type === 'eth'
        ? await routerContract.getMaximumSpcAmountOut(amountIn)
        : await routerContract.getMaximumEthAmountOut(amountIn)

    const minimumAmountOut = actualAmountOut.mul(100 - maxSlippage).div(100)
    console.log('Slippage settings:', { maxSlippage: maxSlippage / 100, minimumAmountOut: minimumAmountOut.toString() })

    const formattedAmountOut = ethers.utils.formatEther(actualAmountOut)

    alert(`Final amount out will be ${formattedAmountOut} ${swapOut.type.toUpperCase()}`)

    const connectedContract = routerContract.connect(signer)
    if (swapIn.type === 'eth') {
      await connectedContract.swapETHForSPC(minimumAmountOut, { value: amountIn })
    } else {
      await ensureSpcAllowance(amountIn)
      await connectedContract.swapSPCForETH(amountIn, minimumAmountOut)
    }
  } catch (error) {
    console.warn('Failed to swap', { error })
    trade_error.innerHTML = extractErrorMessage(error, routerContract)
  } finally {
    trade_btn.disabled = false
    trade_btn.innerHTML = 'Trade'
  }
})
