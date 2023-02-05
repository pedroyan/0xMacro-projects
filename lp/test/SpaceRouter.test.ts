import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { SpaceCoin, ICO } from '../typechain-types'
import { expect } from 'chai'
import { BigNumber, BigNumberish } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { IcoPhase, ICO_MAX_CONTRIBUTION_LIMIT, INITIAL_TREASURY_BALANCE } from './helpers'

describe('SpaceRouter', () => {
  async function setupFixture() {
    const [deployer, treasury, alice, bob, carol, ...others] = await ethers.getSigners()

    const ICO = await ethers.getContractFactory('ICO')
    const ico: ICO = await ICO.deploy(treasury.address, [])
    await ico.deployed()

    const spaceCoin = (await ethers.getContractAt('SpaceCoin', await ico.spaceCoin())) as SpaceCoin

    await spaceCoin.connect(treasury).transfer(alice.address, INITIAL_TREASURY_BALANCE.div(2))

    const SpaceLP = await ethers.getContractFactory('SpaceLP')
    const spaceLp = await SpaceLP.deploy(spaceCoin.address)

    const SpaceRouter = await ethers.getContractFactory('SpaceRouter')
    const spaceRouter = await SpaceRouter.deploy(spaceLp.address, spaceCoin.address)

    const addLiquidity = async (spaceCoinIn: BigNumberish, ethIn: BigNumberish, provider?: SignerWithAddress) => {
      const liqProvider = provider ?? treasury
      await spaceCoin.connect(liqProvider).approve(spaceRouter.address, spaceCoinIn)
      return spaceRouter.connect(liqProvider).addLiquidity(spaceCoinIn, { value: ethIn })
    }

    const burnLiquidity = async (lpAmount: BigNumberish, provider?: SignerWithAddress) => {
      const liqProvider = provider ?? treasury
      await spaceLp.connect(liqProvider).approve(spaceRouter.address, lpAmount)
      return spaceRouter.connect(liqProvider).removeLiquidity(lpAmount)
    }

    return {
      ico,
      spaceCoin,
      spaceLp,
      deployer,
      treasury,
      alice,
      bob,
      carol,
      others,
      liquidityProvider1: treasury,
      liquidityProvider2: alice,
      addLiquidity,
      burnLiquidity,
      spaceRouter,
    }
  }

  async function setupFixtureWithLiquidity() {
    const { liquidityProvider1, addLiquidity, ...rest } = await loadFixture(setupFixture)

    // ETH 1:5 SPC ratio
    await addLiquidity(ethers.utils.parseEther('100000'), ethers.utils.parseEther('20000'), liquidityProvider1)

    return { liquidityProvider1, addLiquidity, ...rest }
  }

  describe('addLiquidity', () => {
    it('should allow trader to initialize liquidity with abritrary ratio', async () => {
      // Arrange
      const { liquidityProvider1, addLiquidity, spaceLp } = await loadFixture(setupFixture)

      // Act
      await addLiquidity(ethers.utils.parseEther('10'), ethers.utils.parseEther('10'), liquidityProvider1)

      // Assert
      expect(await spaceLp.totalSupply()).to.equal(await spaceLp.balanceOf(liquidityProvider1.address))
    })

    it('should revert if provider SPC balance is lower than spcIn', async () => {
      // Arrange
      const { bob, addLiquidity, spaceLp } = await loadFixture(setupFixture)

      // Act
      const promise = addLiquidity(ethers.utils.parseEther('10'), ethers.utils.parseEther('10'), bob)

      // Assert
      await expect(promise).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('should revert if allowance for the router is not sufficient to transfer spcIn to the liquidity pool', async () => {
      // Arrange
      const { liquidityProvider1, addLiquidity, spaceLp, spaceCoin, spaceRouter } = await loadFixture(setupFixture)

      // Act
      await spaceCoin.connect(liquidityProvider1).approve(spaceRouter.address, ethers.utils.parseEther('1'))
      const promise = spaceRouter
        .connect(liquidityProvider1)
        .addLiquidity(ethers.utils.parseEther('2'), { value: ethers.utils.parseEther('10') })

      // Assert
      await expect(promise).to.be.revertedWith('ERC20: insufficient allowance')
    })

    it('should allow trader to add liqudity if transferred ETH is the optimalEth', async () => {
      //  Arrange
      const { liquidityProvider2, addLiquidity, spaceRouter, spaceLp } = await loadFixture(setupFixtureWithLiquidity)
      const spcIn = ethers.utils.parseEther('1')
      const ethIn = await spaceRouter.getOptimalDepositEth(spcIn)

      //  Act
      const tx = await addLiquidity(spcIn, ethIn, liquidityProvider2)

      //  Assert
      const lpBalance = await spaceLp.balanceOf(liquidityProvider2.address)
      await expect(tx).to.emit(spaceLp, 'LiquidityAdded').withArgs(liquidityProvider2.address, ethIn, spcIn, lpBalance)
    })

    it('should revert if transferred ETH is larger than optimalEth', async () => {
      // ------ Arrange ------
      const { liquidityProvider1, addLiquidity, spaceLp, spaceCoin, spaceRouter } = await loadFixture(
        setupFixtureWithLiquidity,
      ) // Initial liquidity ratio = ETH 1:5 SPC
      const spcIn = ethers.utils.parseEther('1')
      const ethIn = spcIn

      // -------- Act --------
      // Attempt to add liquidity at a 1:1 ratio (more ETH than the necessary)
      const promise = addLiquidity(spcIn, ethIn, liquidityProvider1)

      // ------ Assert ------
      const optimalEth = await spaceRouter.getOptimalDepositEth(spcIn)
      await expect(promise).to.be.revertedWithCustomError(spaceRouter, 'SuboptimalEthIn').withArgs(optimalEth, ethIn)
      expect(optimalEth).to.be.lessThan(ethIn)
    })

    it('should revert if transferred ETH is larger than optimalEth', async () => {
      // ------ Arrange ------
      // Initial liquidity ratio = ETH 1:5 SPC
      const { liquidityProvider1, addLiquidity, spaceRouter } = await loadFixture(setupFixtureWithLiquidity)
      const spcIn = ethers.utils.parseEther('10')
      const ethIn = ethers.utils.parseEther('1')

      // -------- Act --------
      // Attempt to add liqudity at a 1:10 ratio (less ETH than the necessary)
      const promise = addLiquidity(spcIn, ethIn, liquidityProvider1)

      // ------ Assert ------
      const optimalEth = await spaceRouter.getOptimalDepositEth(spcIn)
      await expect(promise).to.be.revertedWithCustomError(spaceRouter, 'SuboptimalEthIn').withArgs(optimalEth, ethIn)
      expect(optimalEth).to.be.greaterThan(ethIn)
    })

    it('should revert if initial liquidity is provided with 0 ETH', async () => {
      // Arrange
      const { liquidityProvider1, addLiquidity, spaceLp } = await loadFixture(setupFixture)

      // Act
      const promise = addLiquidity(ethers.utils.parseEther('10'), 0, liquidityProvider1)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(spaceLp, 'InsufficientLiquidityMinted')
    })

    it('should revert if initial liquidity is provided with 0 SPC', async () => {
      // Arrange
      const { liquidityProvider1, addLiquidity, spaceLp } = await loadFixture(setupFixture)

      // Act
      const promise = addLiquidity(0, ethers.utils.parseEther('10'), liquidityProvider1)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(spaceLp, 'InsufficientLiquidityMinted')
    })
  })

  describe('removeLiquidity', () => {
    it('should allow provider to fully withdraw their liquidity', async () => {
      // Arrange
      const { burnLiquidity, liquidityProvider1, spaceLp, spaceCoin } = await loadFixture(setupFixtureWithLiquidity)
      const reserves = await spaceLp.getReserves()

      // Act
      const providerEthBalanceBefore = await liquidityProvider1.getBalance()
      const spcBalanceBefore = await spaceCoin.balanceOf(liquidityProvider1.address)
      const lpTokens = await spaceLp.balanceOf(liquidityProvider1.address)
      await burnLiquidity(lpTokens, liquidityProvider1).then((tx) => tx.wait())

      // Assert
      const providerEthBalanceAfter = await liquidityProvider1.getBalance()
      const spcBalanceAfter = await spaceCoin.balanceOf(liquidityProvider1.address)

      const balanceDelta = providerEthBalanceAfter.sub(providerEthBalanceBefore)
      expect(balanceDelta).to.be.closeTo(reserves[0], ethers.utils.parseEther('0.001'))

      const spcDelta = spcBalanceAfter.sub(spcBalanceBefore)
      expect(spcDelta).to.be.equal(reserves[1])
    })

    it('should allow provider to partially withdraw their liquidity', async () => {
      // Arrange
      const { burnLiquidity, liquidityProvider1, spaceLp, spaceCoin } = await loadFixture(setupFixtureWithLiquidity)
      const reserves = await spaceLp.getReserves()

      // Act
      const providerEthBalanceBefore = await liquidityProvider1.getBalance()
      const spcBalanceBefore = await spaceCoin.balanceOf(liquidityProvider1.address)
      const lpTokens = await spaceLp.balanceOf(liquidityProvider1.address)
      await burnLiquidity(lpTokens.div(2), liquidityProvider1)

      // Assert
      const providerEthBalanceAfter = await liquidityProvider1.getBalance()
      const spcBalanceAfter = await spaceCoin.balanceOf(liquidityProvider1.address)

      const balanceDelta = providerEthBalanceAfter.sub(providerEthBalanceBefore)
      expect(balanceDelta).to.be.closeTo(reserves[0].div(2), ethers.utils.parseEther('0.001'))

      const spcDelta = spcBalanceAfter.sub(spcBalanceBefore)
      expect(spcDelta).to.be.closeTo(reserves[1].div(2), 2) // share amount is not exactly divisible by 2
    })

    it('should revert if provider attempts to withdraw more liquidity than they have', async () => {
      // Arrange
      const { burnLiquidity, liquidityProvider1, spaceLp } = await loadFixture(setupFixtureWithLiquidity)

      // Act
      const lpTokens = await spaceLp.balanceOf(liquidityProvider1.address)
      const promise = burnLiquidity(lpTokens.add(1), liquidityProvider1)

      // Assert
      await expect(promise).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('should revert if provider does not give enough allowance to the router', async () => {
      // Arrange
      const { burnLiquidity, liquidityProvider1, spaceLp, spaceRouter } = await loadFixture(setupFixtureWithLiquidity)

      // Act
      const lpTokens = await spaceLp.balanceOf(liquidityProvider1.address)
      await spaceLp.connect(liquidityProvider1).approve(spaceRouter.address, lpTokens.sub(1))
      const promise = spaceRouter.connect(liquidityProvider1).removeLiquidity(lpTokens)

      // Assert
      await expect(promise).to.be.revertedWith('ERC20: insufficient allowance')
    })
  })

  describe('getOptimalDepositEth', () => {
    it('should recommend 1:5 ratio if no liquidity exists', async () => {
      // Arrange
      const { spaceRouter } = await loadFixture(setupFixture)

      // Act
      const optimalEth = await spaceRouter.getOptimalDepositEth(ethers.utils.parseEther('5'))

      // Assert
      expect(optimalEth).to.equal(ethers.utils.parseEther('1'))
    })

    it('should calculate the correct optimal ETH provision for maximum liquidity', async () => {
      // Arrange
      const { spaceRouter, addLiquidity, liquidityProvider1 } = await loadFixture(setupFixture)

      // Act
      // ETH 1:2 SPC ratio
      await addLiquidity(ethers.utils.parseEther('20'), ethers.utils.parseEther('10'))
      const optimalEth = await spaceRouter.getOptimalDepositEth(ethers.utils.parseEther('10'))

      // Assert
      expect(optimalEth).to.equal(ethers.utils.parseEther('5'))
    })

    it('should suggest at least 1 wei to prevent liquidity provision reversions', async () => {
      // Arrange
      const { spaceRouter } = await loadFixture(setupFixture)

      // Act
      const optimalEth = await spaceRouter.getOptimalDepositEth(1)

      // Assert
      expect(optimalEth).to.equal(1)
    })
  })

  describe('swapETHForSPC', () => {
    it('should swap ETH for SPC (spcOutMin = maxSpcOut)', async () => {
      // Arrange
      const { spaceRouter, spaceCoin, bob } = await loadFixture(setupFixtureWithLiquidity)
      const ethIn = ethers.utils.parseEther('1')
      const maximumSpcOut = await spaceRouter.getMaximumSpcAmountOut(ethIn)

      // Act
      const spcBalanceBefore = await spaceCoin.balanceOf(bob.address)
      await spaceRouter.connect(bob).swapETHForSPC(maximumSpcOut, { value: ethIn })

      // Assert
      const spcBalanceAfter = await spaceCoin.balanceOf(bob.address)
      const spcDelta = spcBalanceAfter.sub(spcBalanceBefore)
      expect(spcDelta).to.equal(maximumSpcOut)
    })

    it('should swap ETH for SPC (spcOutMin < actualSpcOut)', async () => {
      // Arrange
      const { spaceRouter, spaceCoin, bob } = await loadFixture(setupFixtureWithLiquidity)
      const ethIn = ethers.utils.parseEther('1')
      const maximumSpcOut = await spaceRouter.getMaximumSpcAmountOut(ethIn)
      const spcOutMin = maximumSpcOut.div(2)

      // Act
      const spcBalanceBefore = await spaceCoin.balanceOf(bob.address)
      await spaceRouter.connect(bob).swapETHForSPC(spcOutMin, { value: ethIn })

      // Assert
      const spcBalanceAfter = await spaceCoin.balanceOf(bob.address)
      const spcDelta = spcBalanceAfter.sub(spcBalanceBefore)
      expect(spcDelta).to.equal(maximumSpcOut)
    })

    it('should revert swap if spcOutMin > actual SPC out', async () => {
      // Arrange
      const { spaceRouter, bob } = await loadFixture(setupFixtureWithLiquidity)
      const ethIn = ethers.utils.parseEther('1')
      const actualSpcOut = await spaceRouter.getMaximumSpcAmountOut(ethIn)
      const spcOutMin = actualSpcOut.add(1)

      // Act
      const promise = spaceRouter.connect(bob).swapETHForSPC(spcOutMin, { value: ethIn })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(spaceRouter, 'MinimumAmountOutNotMet')
        .withArgs(spcOutMin, actualSpcOut)
    })

    it('should revert if another trade adds too much unfavourable slippage to the trader', async () => {
      // Arrange
      const { spaceRouter, bob } = await loadFixture(setupFixtureWithLiquidity)
      const ethIn = ethers.utils.parseEther('1')
      const minmumSpcOut = await spaceRouter.getMaximumSpcAmountOut(ethIn)

      // Act
      await spaceRouter.connect(bob).swapETHForSPC(minmumSpcOut, { value: ethIn }) // First trade executes successfully!
      const promise = spaceRouter.connect(bob).swapETHForSPC(minmumSpcOut, { value: ethIn }) // Second trade fails due to slippage from the first trade

      // Assert
      const actualAmount = await spaceRouter.getMaximumSpcAmountOut(ethIn)
      await expect(promise)
        .to.be.revertedWithCustomError(spaceRouter, 'MinimumAmountOutNotMet')
        .withArgs(minmumSpcOut, actualAmount)
    })

    it('should revert swap if SPC Tax drives the actual amount out below spcOutMin', async () => {
      // Arrange
      const { spaceRouter, bob, deployer, spaceCoin } = await loadFixture(setupFixtureWithLiquidity)
      const ethIn = ethers.utils.parseEther('1')
      const minmumSpcOut = await spaceRouter.getMaximumSpcAmountOut(ethIn)

      // Act
      await spaceCoin.connect(deployer).setTaxTransfers(true)
      const promise = spaceRouter.connect(bob).swapETHForSPC(minmumSpcOut, { value: ethIn })

      // Assert
      const isCloseToNetTransfer = (actualAmount: BigNumber) => {
        const expectedAmount = minmumSpcOut.mul(98).div(100)
        const difference = actualAmount.sub(expectedAmount).abs()
        return difference.lte(1)
      }

      await expect(promise)
        .to.be.revertedWithCustomError(spaceRouter, 'MinimumAmountOutNotMet')
        .withArgs(minmumSpcOut, isCloseToNetTransfer)
    })
  })

  describe('swapSPCForETH', () => {
    it('should swap SPC for ETH (ethOutMin = maxEthOut)', async () => {
      // Arrange
      const { spaceRouter, spaceCoin, alice } = await loadFixture(setupFixtureWithLiquidity)
      const spcIn = ethers.utils.parseEther('5')
      const maximumEthOut = await spaceRouter.getMaximumEthAmountOut(spcIn)

      // Act
      await spaceCoin.connect(alice).approve(spaceRouter.address, spcIn)
      const ethBalanceBefore = await alice.getBalance()
      await spaceRouter.connect(alice).swapSPCForETH(spcIn, maximumEthOut)

      // Assert
      const ethBalanceAfter = await alice.getBalance()
      const ethDelta = ethBalanceAfter.sub(ethBalanceBefore)
      expect(ethDelta).to.be.closeTo(maximumEthOut, ethers.utils.parseEther('0.001'))
    })

    it('should swap SPC for ETH (ethOutMin < actualEthOut)', async () => {
      // Arrange
      const { spaceRouter, spaceCoin, alice } = await loadFixture(setupFixtureWithLiquidity)
      const spcIn = ethers.utils.parseEther('5')
      const maximumEthOut = await spaceRouter.getMaximumEthAmountOut(spcIn)
      const ethOutMin = maximumEthOut.div(2)

      // Act
      await spaceCoin.connect(alice).approve(spaceRouter.address, spcIn)
      const ethBalanceBefore = await alice.getBalance()
      await spaceRouter.connect(alice).swapSPCForETH(spcIn, ethOutMin)

      // Assert
      const ethBalanceAfter = await alice.getBalance()
      const ethDelta = ethBalanceAfter.sub(ethBalanceBefore)
      expect(ethDelta).to.be.closeTo(maximumEthOut, ethers.utils.parseEther('0.001'))
    })

    it('should revert swap if ethOutMin > actual ETH out', async () => {
      // Arrange
      const { spaceRouter, spaceCoin, alice } = await loadFixture(setupFixtureWithLiquidity)
      const spcIn = ethers.utils.parseEther('5')
      const actualEthOut = await spaceRouter.getMaximumEthAmountOut(spcIn)
      const ethOutMin = actualEthOut.add(1)

      // Act
      await spaceCoin.connect(alice).approve(spaceRouter.address, spcIn)
      const promise = spaceRouter.connect(alice).swapSPCForETH(spcIn, ethOutMin)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(spaceRouter, 'MinimumAmountOutNotMet')
        .withArgs(ethOutMin, actualEthOut)
    })

    it('should revert if another trade adds too much unfavourable slippage to the trader', async () => {
      // Arrange
      const { spaceRouter, spaceCoin, alice, liquidityProvider1 } = await loadFixture(setupFixtureWithLiquidity)
      const spcIn = ethers.utils.parseEther('5')
      const ethOutMin = await spaceRouter.getMaximumEthAmountOut(spcIn)

      // Act
      await spaceCoin.connect(liquidityProvider1).approve(spaceRouter.address, spcIn)
      await spaceRouter.connect(liquidityProvider1).swapSPCForETH(spcIn, ethOutMin) // First trade executes successfully!
      await spaceCoin.connect(alice).approve(spaceRouter.address, spcIn)
      const promise = spaceRouter.connect(alice).swapSPCForETH(spcIn, ethOutMin) // Second trade fails due to slippage from the first trade

      // Assert
      const actualAmount = await spaceRouter.getMaximumEthAmountOut(spcIn)
      await expect(promise)
        .to.be.revertedWithCustomError(spaceRouter, 'MinimumAmountOutNotMet')
        .withArgs(ethOutMin, actualAmount)
    })

    it('should revert swap if SPC Tax drives the actual amount out below ethOutMin', async () => {
      // Arrange
      const { spaceRouter, spaceCoin, alice, deployer } = await loadFixture(setupFixtureWithLiquidity)
      const spcIn = ethers.utils.parseEther('5')
      const ethOutMin = await spaceRouter.getMaximumEthAmountOut(spcIn)

      // Act
      await spaceCoin.connect(deployer).setTaxTransfers(true)
      await spaceCoin.connect(alice).approve(spaceRouter.address, spcIn)
      const promise = spaceRouter.connect(alice).swapSPCForETH(spcIn, ethOutMin)

      // Assert
      const spcInAfterTax = spcIn.mul(98).div(100)
      const ethOutAfterTax = await spaceRouter.getMaximumEthAmountOut(spcInAfterTax)
      await expect(promise)
        .to.be.revertedWithCustomError(spaceRouter, 'MinimumAmountOutNotMet')
        .withArgs(ethOutMin, ethOutAfterTax)
    })
  })

  describe('E2E Test', () => {
    it('should allow raised funds to be deposited into the LP for public trading', async () => {
      // Step 1 - Raise funds via the ICO
      const { ico, deployer, alice, treasury, carol, spaceRouter, spaceCoin } = await loadFixture(setupFixture)
      await ico.advancePhase(IcoPhase.GENERAL)
      await ico.advancePhase(IcoPhase.OPEN)
      await ico.connect(alice).contribute({ value: ICO_MAX_CONTRIBUTION_LIMIT })

      // Step 2 - Move funds from the ICO to the Tresusry
      const treasuryBalanceBefore = await treasury.getBalance()
      await ico.connect(deployer).withdraw()
      const treasuryEthBalanceAfter = await treasury.getBalance()
      const treasuryEthDelta = treasuryEthBalanceAfter.sub(treasuryBalanceBefore)
      expect(treasuryEthDelta).to.equal(ICO_MAX_CONTRIBUTION_LIMIT)

      // Step 3 - Deposit liquidity from the Treasury into the LP
      const treasurySPCBalance = await spaceCoin.balanceOf(treasury.address)
      const toDepositEth = treasurySPCBalance.div(5)
      await spaceCoin.connect(treasury).approve(spaceRouter.address, treasurySPCBalance)
      await spaceRouter.connect(treasury).addLiquidity(treasurySPCBalance, { value: toDepositEth })

      // Step 4 - Allow an investor to redeem their SPC and sell it for ETH on the LP
      await ico.connect(alice).redeemTokens()
      const aliceSpcBalance = await spaceCoin.balanceOf(alice.address)
      const optimalEth = await spaceRouter.getMaximumEthAmountOut(aliceSpcBalance)
      await spaceCoin.connect(alice).approve(spaceRouter.address, aliceSpcBalance)

      const alicePreviousEthBalance = await alice.getBalance()
      await spaceRouter.connect(alice).swapSPCForETH(aliceSpcBalance, optimalEth)

      // Step 5 - Ensures Alice got the ETH she was expecting
      const aliceCurrentEthBalance = await alice.getBalance()
      const aliceEthDelta = aliceCurrentEthBalance.sub(alicePreviousEthBalance)
      expect(aliceEthDelta).to.be.closeTo(optimalEth, ethers.utils.parseEther('0.001'))
    })
  })
})
