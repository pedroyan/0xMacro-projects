import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { SpaceCoin, ICO, ForceFeeder__factory } from '../typechain-types'
import { expect } from 'chai'
import { BigNumberish } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { INITIAL_TREASURY_BALANCE } from './helpers'

describe('SpaceLP', () => {
  async function setupFixture() {
    const [deployer, treasury, alice, bob, carol, ...others] = await ethers.getSigners()

    const ICO = await ethers.getContractFactory('ICO')
    const ico: ICO = await ICO.deploy(treasury.address, [])
    await ico.deployed()

    const spaceCoin = (await ethers.getContractAt('SpaceCoin', await ico.spaceCoin())) as SpaceCoin

    const SpaceLP = await ethers.getContractFactory('SpaceLP')
    const spaceLp = await SpaceLP.deploy(spaceCoin.address)

    const ForceFeederFactory = (await ethers.getContractFactory('ForceFeeder')) as ForceFeeder__factory
    const lpForceFeeder = await ForceFeederFactory.deploy(spaceLp.address)

    const addLiquidity = async (
      ethIn: BigNumberish,
      spaceCoinIn: BigNumberish,
      provider?: SignerWithAddress,
      destination?: string,
    ) => {
      const liqProvider = provider ?? treasury
      await spaceCoin.connect(liqProvider).transfer(spaceLp.address, spaceCoinIn)
      return await spaceLp.connect(liqProvider).deposit(destination ?? liqProvider.address, { value: ethIn })
    }

    const burnLiquidity = async (lpAmount: BigNumberish, provider?: SignerWithAddress, destination?: string) => {
      const liquidityProvider = provider ?? treasury
      await spaceLp.connect(liquidityProvider).transfer(spaceLp.address, lpAmount)
      return spaceLp.connect(liquidityProvider).withdraw(destination ?? liquidityProvider.address)
    }

    const getLiquidityPoolK = async () => {
      const reserves = await spaceLp.getReserves()
      return reserves[0].mul(reserves[1])
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
      addLiquidity,
      burnLiquidity,
      getLiquidityPoolK,
      lpForceFeeder,
    }
  }

  async function setupFixtureWithAnotherLiquidityProvider() {
    const toReturn = await setupFixture()

    await toReturn.spaceCoin
      .connect(toReturn.treasury)
      .transfer(toReturn.alice.address, INITIAL_TREASURY_BALANCE.div(2))

    return { ...toReturn, liquidityProvider1: toReturn.treasury, liquidityProvider2: toReturn.alice }
  }

  async function setupFixtureWithInitialLiquidity() {
    const toReturn = await setupFixtureWithAnotherLiquidityProvider()

    // 1:5 Ratio
    await toReturn.addLiquidity(
      ethers.utils.parseEther('20000'),
      ethers.utils.parseEther('100000'),
      toReturn.liquidityProvider1,
    )

    return toReturn
  }

  describe('Deposit', async () => {
    it('should allow initial deposits to LP', async () => {
      // Arrange
      const { treasury, spaceLp, addLiquidity } = await loadFixture(setupFixture)

      // Act
      const ethIn = ethers.utils.parseEther('70000')
      const spaceCoinIn = INITIAL_TREASURY_BALANCE
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // Assert
      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(ethIn)
      expect(reserves[1]).to.equal(spaceCoinIn)
      expect(await spaceLp.totalSupply()).to.equal(await spaceLp.balanceOf(treasury.address))
    })

    it('should issue LP shares proportional to the reserve increase of subsequent deposits', async () => {
      // ----- Arrange ------
      const { treasury, spaceLp, addLiquidity } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('100')
      const spaceCoinIn = ethers.utils.parseEther('500')
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Act -----
      const treasuryLpSharesBefore = await spaceLp.balanceOf(treasury.address)
      const lpPreviousTotalSupply = await spaceLp.totalSupply()
      await addLiquidity(ethIn.div(2), spaceCoinIn.div(2), treasury) // 50% increase in reserves = 50% increase in LP shares
      const treasuryLpSharesAfter = await spaceLp.balanceOf(treasury.address)
      const lpNewTotalSupply = await spaceLp.totalSupply()

      // ----- Assert -----

      // Expect newTotalSupply to be 50% larger than lpPreviousTotalSupply
      expect(lpNewTotalSupply).to.equal(lpPreviousTotalSupply.mul(3).div(2))

      // Expect all the new shares to have been issued straight to the liquidity provider
      const newSharesCount = treasuryLpSharesAfter.sub(treasuryLpSharesBefore)
      expect(treasuryLpSharesBefore.add(newSharesCount)).to.equal(treasuryLpSharesAfter)
    })

    it('should allow multiple providers to add liquidity', async () => {
      // ----- Arrange ------
      const { spaceLp, addLiquidity, liquidityProvider1, liquidityProvider2 } = await loadFixture(
        setupFixtureWithAnotherLiquidityProvider,
      )

      // ----- Act -----
      const ethIn = ethers.utils.parseEther('100')
      const spaceCoinIn = ethers.utils.parseEther('500')
      await addLiquidity(ethIn, spaceCoinIn, liquidityProvider1)
      await addLiquidity(ethIn, spaceCoinIn, liquidityProvider2)

      // ----- Assert -----
      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(ethIn.mul(2))
      expect(reserves[1]).to.equal(spaceCoinIn.mul(2))

      const [lp1Shares, lp2Shares] = await Promise.all([
        spaceLp.balanceOf(liquidityProvider1.address),
        spaceLp.balanceOf(liquidityProvider2.address),
      ])
      expect(await spaceLp.totalSupply()).equal(lp1Shares.add(lp2Shares))
      expect(lp1Shares).to.equal(lp2Shares)
    })

    it('should add donated SPC to the pool reserves for added liquidity', async () => {
      // ----- Arrange ------
      const { treasury, spaceLp, addLiquidity, spaceCoin } = await loadFixture(setupFixture)
      const previousSpcIn = ethers.utils.parseEther('1')
      await spaceCoin.connect(treasury).transfer(spaceLp.address, previousSpcIn)

      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')

      // ----- Act -----
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Assert -----
      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(ethIn)
      expect(reserves[1]).to.equal(spaceCoinIn.add(previousSpcIn))
    })

    it('should add force-fed ETH to the pool reserves for added liquidity', async () => {
      // ----- Arrange ------
      const { treasury, spaceLp, addLiquidity, lpForceFeeder } = await loadFixture(setupFixture)
      const previousEthIn = ethers.utils.parseEther('10')
      await lpForceFeeder.forceFeed({ value: previousEthIn })

      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')

      // ----- Act -----
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Assert -----
      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(ethIn.add(previousEthIn))
      expect(reserves[1]).to.equal(spaceCoinIn)
    })

    it('should issue LP tokens in proportion to the lowest amountIn:ratio of the two tokens', async () => {
      // ----- Arrange ------
      const { treasury, spaceLp, addLiquidity, spaceCoin } = await loadFixture(setupFixture)
      const initialEthIn = ethers.utils.parseEther('100')
      const initialSpaceCoinIn = ethers.utils.parseEther('500')
      await addLiquidity(initialEthIn, initialSpaceCoinIn, treasury)

      // ----- Act -----
      const treasuryLpSharesBefore = await spaceLp.balanceOf(treasury.address)
      const lpPreviousTotalSupply = await spaceLp.totalSupply()
      await addLiquidity(
        initialEthIn.div(4), // 25% of initialEthIn
        initialSpaceCoinIn.div(2), // 50% of initialSpaceCoinIn
        treasury,
      ) // 25% is the lowest increase in reserves = 25% increase in LP shares, regardless of how much the other reserve increased
      const treasuryLpSharesAfter = await spaceLp.balanceOf(treasury.address)
      const lpNewTotalSupply = await spaceLp.totalSupply()

      // ----- Assert -----
      // Expect newTotalSupply to be 25% larger than lpPreviousTotalSupply
      expect(lpNewTotalSupply).to.equal(lpPreviousTotalSupply.mul(5).div(4))

      // Expect all the new shares to have been issued straight to the liquidity provider
      const newSharesCount = treasuryLpSharesAfter.sub(treasuryLpSharesBefore)
      expect(treasuryLpSharesBefore.add(newSharesCount)).to.equal(treasuryLpSharesAfter)
    })

    it('should reject initial deposits with 0 ETH', async () => {
      // Arrange
      const { treasury, spaceLp, addLiquidity } = await loadFixture(setupFixture)

      // Act
      const promise = addLiquidity(0, INITIAL_TREASURY_BALANCE, treasury)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(spaceLp, 'InsufficientLiquidityMinted')
    })

    it('should reject initial deposits with 0 SPC', async () => {
      // Arrange
      const { treasury, spaceLp, addLiquidity } = await loadFixture(setupFixture)

      // Act
      const promise = addLiquidity(ethers.utils.parseEther('70000'), 0, treasury)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(spaceLp, 'InsufficientLiquidityMinted')
    })

    it('should reject subsequent deposits with 0 ETH', async () => {
      // Arrange
      const { treasury, spaceLp, addLiquidity } = await loadFixture(setupFixtureWithInitialLiquidity)

      // Act
      const promise = addLiquidity(0, ethers.utils.parseEther('1'), treasury)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(spaceLp, 'InsufficientLiquidityMinted')
    })

    it('should reject subsequent deposits with 0 SPC', async () => {
      // Arrange
      const { treasury, spaceLp, addLiquidity } = await loadFixture(setupFixtureWithInitialLiquidity)

      // Act
      const promise = addLiquidity(ethers.utils.parseEther('1'), 0, treasury)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(spaceLp, 'InsufficientLiquidityMinted')
    })

    it('should emit "LiquidityAdded" event', async () => {
      // Arrange
      const { treasury, spaceLp, addLiquidity } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')

      // Act
      const tx = await addLiquidity(ethIn, spaceCoinIn, treasury)
      const lpTokens = await spaceLp.balanceOf(treasury.address)

      // Assert
      await expect(tx).to.emit(spaceLp, 'LiquidityAdded').withArgs(treasury.address, ethIn, spaceCoinIn, lpTokens)
    })

    it('should allow shares to be sent to an abitrary address', async () => {
      // Arrange
      const { treasury, spaceLp, addLiquidity, spaceCoin, bob } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')

      // Act
      await addLiquidity(ethIn, spaceCoinIn, treasury, bob.address)

      // Assert
      const lpTokens = await spaceLp.balanceOf(bob.address)
      expect(lpTokens).to.equal(await spaceLp.totalSupply())
    })
  })

  describe('Withdraw', async () => {
    it('should allow provider to fully withdraw their liquidity', async () => {
      // ----- Arrange -----
      const { treasury, spaceLp, addLiquidity, spaceCoin, burnLiquidity } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Act -----
      const [treasuryLpSharesBefore, treasuryEthBalanceBefore, treasurySpaceCoinBefore] = await Promise.all([
        spaceLp.balanceOf(treasury.address),
        ethers.provider.getBalance(treasury.address),
        spaceCoin.balanceOf(treasury.address),
      ])
      await burnLiquidity(treasuryLpSharesBefore, treasury)

      // ----- Assert ------

      // LP Balance should be 0
      expect(await spaceCoin.balanceOf(spaceLp.address)).to.equal(0)
      expect(await ethers.provider.getBalance(spaceLp.address)).to.equal(0)

      // LP Reserves should be 0
      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(0)
      expect(reserves[1]).to.equal(0)

      // Treasury should have received all the ETH and SPC it provided initially
      const [treasuryLpSharesAfter, treasuryEthBalanceAfter, treasurySpaceCoinBalanceAfter] = await Promise.all([
        spaceLp.balanceOf(treasury.address),
        ethers.provider.getBalance(treasury.address),
        spaceCoin.balanceOf(treasury.address),
      ])
      expect(treasuryLpSharesAfter).to.equal(0)
      expect(treasuryEthBalanceAfter).to.be.closeTo(
        treasuryEthBalanceBefore.add(ethIn),
        ethers.utils.parseEther('0.01'),
      )
      expect(treasurySpaceCoinBalanceAfter.sub(treasurySpaceCoinBefore)).to.equal(spaceCoinIn)
    })

    it('should allow provider to partially withdraw their liquidity', async () => {
      // ----- Arrange -----
      const { treasury, spaceLp, addLiquidity, spaceCoin, burnLiquidity } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Act -----
      const [treasuryLpSharesBefore, treasuryEthBalanceBefore, treasurySpaceCoinBefore] = await Promise.all([
        spaceLp.balanceOf(treasury.address),
        ethers.provider.getBalance(treasury.address),
        spaceCoin.balanceOf(treasury.address),
      ])
      const sharesToBurn = treasuryLpSharesBefore.div(4)
      await burnLiquidity(sharesToBurn, treasury)

      // ----- Assert ------

      const spaceCoin3Quarters = spaceCoinIn.mul(3).div(4)
      const eth3Quarters = ethIn.mul(3).div(4)

      // LP Balance should be 3/4 of the deposited amount
      expect(await spaceCoin.balanceOf(spaceLp.address)).to.equal(spaceCoin3Quarters)
      expect(await ethers.provider.getBalance(spaceLp.address)).to.equal(eth3Quarters)

      // LP Reserves should be 3/4 of the deposited amount
      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(eth3Quarters)
      expect(reserves[1]).to.equal(spaceCoin3Quarters)

      // Treasury should receive 1/4 of the ETH and SPC that was provided initially
      const [treasuryLpSharesAfter, treasuryEthBalanceAfter, treasurySpaceCoinBalanceAfter] = await Promise.all([
        spaceLp.balanceOf(treasury.address),
        ethers.provider.getBalance(treasury.address),
        spaceCoin.balanceOf(treasury.address),
      ])
      expect(treasuryLpSharesAfter).to.equal(treasuryLpSharesBefore.sub(sharesToBurn))
      expect(treasuryEthBalanceAfter).to.be.closeTo(
        treasuryEthBalanceBefore.add(ethIn.div(4)),
        ethers.utils.parseEther('0.01'),
      )
      expect(treasurySpaceCoinBalanceAfter.sub(treasurySpaceCoinBefore)).to.equal(spaceCoinIn.div(4))
    })

    it('should allow provider to withdraw only the liquidity they provided', async () => {
      // ----- Arrange -----
      const { liquidityProvider1, liquidityProvider2, spaceLp, addLiquidity, spaceCoin, burnLiquidity } =
        await loadFixture(setupFixtureWithAnotherLiquidityProvider)

      const beforeLiquidityLp2SpcBalance = await spaceCoin.balanceOf(liquidityProvider2.address)
      const beforeLiquidityLp2EthBalance = await ethers.provider.getBalance(liquidityProvider2.address)
      const ethInLp2 = ethers.utils.parseEther('10')
      const spaceCoinInLp2 = ethers.utils.parseEther('50')

      const ehtInLp1 = ethInLp2.div(2)
      const spcInLp1 = spaceCoinInLp2.div(2)

      await addLiquidity(ehtInLp1, spcInLp1, liquidityProvider1)
      await addLiquidity(ethInLp2, spaceCoinInLp2, liquidityProvider2)

      // ----- Act -----
      await burnLiquidity(await spaceLp.balanceOf(liquidityProvider2.address), liquidityProvider2)

      // ----- Assert ------

      // LP reserves from provider1 should be untouched
      expect(await spaceCoin.balanceOf(spaceLp.address)).to.equal(spcInLp1)
      expect(await ethers.provider.getBalance(spaceLp.address)).to.equal(ehtInLp1)
      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(ehtInLp1)
      expect(reserves[1]).to.equal(spcInLp1)

      // LP shares from provider1 should still be there
      expect(await spaceLp.balanceOf(liquidityProvider1.address)).to.equal(await spaceLp.totalSupply())

      // LP shares from provider2 should be 0
      expect(await spaceLp.balanceOf(liquidityProvider2.address)).to.equal(0)

      // Assets from provider2 should be returned to them
      expect(await spaceCoin.balanceOf(liquidityProvider2.address)).to.equal(beforeLiquidityLp2SpcBalance)
      expect(await ethers.provider.getBalance(liquidityProvider2.address)).to.be.closeTo(
        beforeLiquidityLp2EthBalance,
        ethers.utils.parseEther('0.01'),
      )
    })

    it('should emit "LiquidityWithdrawn" event', async () => {
      // ----- Arrange -----
      const { treasury, spaceLp, addLiquidity, spaceCoin, burnLiquidity } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Act -----
      const liquidityBurnt = await spaceLp.balanceOf(treasury.address)
      const tx = await burnLiquidity(liquidityBurnt, treasury)

      // ----- Assert ------
      await expect(tx)
        .to.emit(spaceLp, 'LiquidityWithdrawn')
        .withArgs(treasury.address, ethIn, spaceCoinIn, liquidityBurnt)
    })

    it('should allow provider to withdraw assets donated to the LP that were not yet recognized by into the reserves', async () => {
      // ----- Arrange -----
      const { treasury, spaceLp, addLiquidity, spaceCoin, burnLiquidity } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')
      const spcCoinBeforeLiquidity = await spaceCoin.balanceOf(treasury.address)
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Act -----
      const liquidityBurnt = await spaceLp.balanceOf(treasury.address)
      await spaceCoin.connect(treasury).transfer(spaceLp.address, spaceCoinIn.div(2)) // Unrecognized asset
      await burnLiquidity(liquidityBurnt, treasury)

      // ----- Assert ------
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(spcCoinBeforeLiquidity)
    })

    it('should allow assets to be sent to an abritrary destination', async () => {
      // ----- Arrange -----
      const { treasury, spaceLp, addLiquidity, spaceCoin, burnLiquidity, bob } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Act -----
      const liquidityBurnt = await spaceLp.balanceOf(treasury.address)
      const tx = await burnLiquidity(liquidityBurnt, treasury, bob.address)

      // ----- Assert ------
      await expect(tx).to.emit(spaceCoin, 'Transfer').withArgs(spaceLp.address, bob.address, spaceCoinIn)
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(spaceCoinIn)
    })

    it('should revert if eth withdrawal fails', async () => {
      // ----- Arrange -----
      const { treasury, spaceLp, addLiquidity, spaceCoin, burnLiquidity } = await loadFixture(setupFixture)
      const ethIn = ethers.utils.parseEther('10')
      const spaceCoinIn = ethers.utils.parseEther('50')
      await addLiquidity(ethIn, spaceCoinIn, treasury)

      // ----- Act -----
      const liquidityBurnt = await spaceLp.balanceOf(treasury.address)
      const promise = burnLiquidity(liquidityBurnt, treasury, spaceCoin.address)

      // ----- Assert ------
      await expect(promise).revertedWithCustomError(spaceLp, 'EthTransferFailed')
    })

    it('should revert if insufficient liqudity is burnt (ETH)', async () => {
      // Arrange
      const { liquidityProvider1, spaceLp, burnLiquidity } = await loadFixture(setupFixtureWithInitialLiquidity)

      // Act
      const promise = burnLiquidity(1, liquidityProvider1)

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'InsufficientLiquidityBurned')
    })

    it('should revert if insufficient liqudity is burnt (SPC)', async () => {
      // Arrange
      const { liquidityProvider1, spaceLp, burnLiquidity, addLiquidity } = await loadFixture(
        setupFixtureWithAnotherLiquidityProvider,
      )
      // SPC 5:1 ETH Ratio
      await addLiquidity(ethers.utils.parseEther('100000'), ethers.utils.parseEther('20000'), liquidityProvider1)

      // Act
      const promise = burnLiquidity(1, liquidityProvider1)

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'InsufficientLiquidityBurned')
    })

    it('should not allow reentrancy', async () => {
      // Arrange
      const { spaceLp, liquidityProvider1, burnLiquidity } = await loadFixture(setupFixtureWithInitialLiquidity)
      const ReentrantFactory = await ethers.getContractFactory('ReetrantLPWithdraw')
      const reetrantContract = await ReentrantFactory.deploy(spaceLp.address)

      // Act
      const promise = burnLiquidity(ethers.utils.parseEther('1'), liquidityProvider1, reetrantContract.address)

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'ReentrancyLockEngaged')
    })
  })

  describe('Swap', () => {
    // Copy helper calculator to follow along with the test
    // https://docs.google.com/spreadsheets/d/1-H8n5zC3eOFwoE3J9Kh64BaUdkwezsA_KhH38YHOyoc/edit?usp=sharing
    it('should allow swapping ETH for SPC', async () => {
      // Arrange
      const { spaceLp, spaceCoin, bob, getLiquidityPoolK } = await loadFixture(setupFixtureWithInitialLiquidity)
      const reservesBefore = await spaceLp.getReserves()
      const kBefore = await getLiquidityPoolK()

      // Act
      const ethIn = ethers.utils.parseEther('1')
      await spaceLp.connect(bob).swap(bob.address, true, { value: ethIn })

      // Assert
      const bobBalance = await spaceCoin.balanceOf(bob.address)
      const expectedSpcOut = ethers.utils.parseEther('4.94975498712814') // Expected value when solving for the constant product formula
      expect(bobBalance).to.be.closeTo(expectedSpcOut, 10000)

      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(ethers.utils.parseEther('20001'))
      expect(reserves[1]).to.equal(reservesBefore[1].sub(bobBalance))

      const kAfter = await getLiquidityPoolK()
      expect(kAfter).to.be.greaterThan(kBefore) // Fee incorporated into reserves means k will increase
    })

    it('should allow swapping SPC for ETH', async () => {
      // Arrange
      const { spaceLp, spaceCoin, bob, getLiquidityPoolK, liquidityProvider1 } = await loadFixture(
        setupFixtureWithInitialLiquidity,
      )
      const reservesBefore = await spaceLp.getReserves()
      const kBefore = await getLiquidityPoolK()
      const bobBeforeBalance = await ethers.provider.getBalance(bob.address)

      // Act
      const spcIn = ethers.utils.parseEther('1')
      await spaceCoin.connect(liquidityProvider1).transfer(spaceLp.address, spcIn)
      await spaceLp.connect(liquidityProvider1).swap(bob.address, false, { value: 0 })

      // Assert
      const bobNewBalance = await ethers.provider.getBalance(bob.address)
      const expectedEthOut = ethers.utils.parseEther('0.19799803981940600') // Expected value when solving for the constant product formula
      const balanceDelta = bobNewBalance.sub(bobBeforeBalance)
      expect(balanceDelta).to.be.closeTo(expectedEthOut, ethers.utils.parseEther('0.00000000000001'))

      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(reservesBefore[0].sub(balanceDelta))
      expect(reserves[1]).to.equal(ethers.utils.parseEther('100001'))

      const kAfter = await getLiquidityPoolK()
      expect(kAfter).to.be.greaterThan(kBefore) // Fee incorporated into reserves means k will increase
    })

    it('should revert if SPC liquidity insufficient for the swap', async () => {
      // Arrange
      const { spaceLp, spaceCoin, bob, getLiquidityPoolK, liquidityProvider1 } = await loadFixture(
        setupFixtureWithInitialLiquidity,
      )

      // Act
      await spaceCoin.connect(liquidityProvider1).transfer(spaceLp.address, 1)
      const promise = spaceLp.connect(liquidityProvider1).swap(bob.address, false, { value: 0 })

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'InsufficientLiquidity')
    })

    it('should revert if ETH liquidity insufficient for the swap', async () => {
      // Arrange
      const { liquidityProvider1, spaceLp, addLiquidity, bob } = await loadFixture(
        setupFixtureWithAnotherLiquidityProvider,
      )
      // SPC 5:1 ETH Ratio
      await addLiquidity(ethers.utils.parseEther('100000'), ethers.utils.parseEther('20000'), liquidityProvider1)

      // Act
      const promise = spaceLp.connect(liquidityProvider1).swap(bob.address, true, { value: 1 })

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'InsufficientLiquidity')
    })

    it('should allow provider to withdraw all accrued fees', async () => {
      // ----- Arrange -----
      const { spaceLp, spaceCoin, bob, liquidityProvider1, liquidityProvider2, burnLiquidity } = await loadFixture(
        setupFixtureWithInitialLiquidity,
      )
      const initialReserves = await spaceLp.getReserves()

      // 1% of the SPC is held in the liquidity pool and ETH is sent back
      const spcIn = ethers.utils.parseEther('100')
      await spaceCoin.connect(liquidityProvider2).transfer(spaceLp.address, spcIn)
      await spaceLp.connect(liquidityProvider2).swap(liquidityProvider2.address, false, { value: 0 })
      const newReserves = await spaceLp.getReserves()

      // Top ETH back up to the previous reserve, accounting for fees
      const toIncrease = initialReserves[0].sub(newReserves[0])
      const inputEthToIncrease = toIncrease.mul(100).div(99)
      await spaceLp.connect(liquidityProvider2).swap(liquidityProvider2.address, true, { value: inputEthToIncrease })

      const bobBalanceBefore = await ethers.provider.getBalance(bob.address)

      // ----- Act -----
      const lpShares = await spaceLp.balanceOf(liquidityProvider1.address)
      await burnLiquidity(lpShares, liquidityProvider1, bob.address)

      // ----- Assert ------

      // Retained SPC 1% fee goes to the liquidity provider
      const spcBalanceAfter = await spaceCoin.balanceOf(bob.address)
      expect(spcBalanceAfter).to.be.closeTo(
        initialReserves[1].add(ethers.utils.parseEther('1')),
        ethers.utils.parseEther('0.001'),
      )

      // Retained ETH 1% fee also goes to the liquidity provider
      const bobBalanceAfter = await ethers.provider.getBalance(bob.address)
      const balanceDelta = bobBalanceAfter.sub(bobBalanceBefore)
      const ethOnePercentFee = inputEthToIncrease.div(100)
      expect(balanceDelta).to.equal(initialReserves[0].add(ethOnePercentFee))
    })

    it('should incorporate donated SPC into ETH -> SPC Swaps', async () => {
      // ----- Arrange -----
      const { spaceLp, spaceCoin, bob, getLiquidityPoolK, liquidityProvider2 } = await loadFixture(
        setupFixtureWithInitialLiquidity,
      )
      const reservesBefore = await spaceLp.getReserves()

      // Donated spc without triggering a liqudiity event
      const donatedSpc = ethers.utils.parseEther('100')
      await spaceCoin.connect(liquidityProvider2).transfer(spaceLp.address, donatedSpc)

      // ------ Act ------
      const ethIn = ethers.utils.parseEther('1')
      await spaceLp.connect(bob).swap(bob.address, true, { value: ethIn })

      // ----- Assert -----
      const bobBalance = await spaceCoin.balanceOf(bob.address)

      // Expected value when solving for the constant product formula, incorporating donated SPC into reserves
      // for extra liquidity
      const expectedSpcOut = ethers.utils.parseEther('4.95470474211527')
      expect(bobBalance).to.be.closeTo(expectedSpcOut, 10000)

      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(ethers.utils.parseEther('20001'))
      expect(reserves[1]).to.equal(reservesBefore[1].add(donatedSpc).sub(bobBalance))
    })

    it('should incorporate donated ETH into SPC -> ETH Swaps', async () => {
      // ----- Arrange -----
      const { spaceLp, spaceCoin, bob, liquidityProvider2, lpForceFeeder } = await loadFixture(
        setupFixtureWithInitialLiquidity,
      )
      const reservesBefore = await spaceLp.getReserves()

      // Donated eth without triggering a liqudity event
      const donatedEth = ethers.utils.parseEther('100')
      await lpForceFeeder.connect(bob).forceFeed({
        value: donatedEth,
      })

      // ------ Act ------
      const bobBalanceBefore = await ethers.provider.getBalance(bob.address)
      const spcIn = ethers.utils.parseEther('1')
      await spaceCoin.connect(liquidityProvider2).transfer(spaceLp.address, spcIn)
      await spaceLp.connect(liquidityProvider2).swap(bob.address, false, { value: 0 })

      // ----- Assert -----
      const bobBalance = await ethers.provider.getBalance(bob.address)

      // Expected value when solving for the constant product formula, incorporating donated ETH into reserves
      // for extra liquidity
      const expectedEthOut = ethers.utils.parseEther('0.1989880300185')
      const bobBalanceDelta = bobBalance.sub(bobBalanceBefore)
      expect(bobBalanceDelta).to.be.closeTo(expectedEthOut, ethers.utils.parseEther('0.00000000000001'))

      const reserves = await spaceLp.getReserves()
      expect(reserves[0]).to.equal(reservesBefore[0].add(donatedEth).sub(bobBalanceDelta))
      expect(reserves[1]).to.equal(ethers.utils.parseEther('100001'))
    })

    it('should not allow reentrancy', async () => {
      // Arrange
      const { spaceLp, liquidityProvider1, burnLiquidity, spaceCoin, liquidityProvider2 } = await loadFixture(
        setupFixtureWithInitialLiquidity,
      )
      const ReentrantFactory = await ethers.getContractFactory('ReetrantLPSwap')
      const reetrantContract = await ReentrantFactory.deploy(spaceLp.address)

      // Act
      const spcIn = ethers.utils.parseEther('1')
      await spaceCoin.connect(liquidityProvider2).transfer(spaceLp.address, spcIn)
      const promise = spaceLp.connect(liquidityProvider2).swap(reetrantContract.address, false, { value: 0 })

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'ReentrancyLockEngaged')
    })

    it('should revert ETH -> SPC Swap with 0 input ETH', async () => {
      // Arrange
      const { spaceLp, bob } = await loadFixture(setupFixtureWithInitialLiquidity)

      // Act
      const promise = spaceLp.connect(bob).swap(bob.address, true, { value: 0 })

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'InsufficientInputAmount')
    })

    it('should revert SPC -> ETH Swap with 0 input SPC', async () => {
      // Arrange
      const { spaceLp, bob } = await loadFixture(setupFixtureWithInitialLiquidity)

      // Act
      const promise = spaceLp.connect(bob).swap(bob.address, false, { value: 0 })

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'InsufficientInputAmount')
    })

    it('should revert ETH -> SPC swap on empty reserves', async () => {
      // Arrange
      const { spaceLp, bob } = await loadFixture(setupFixtureWithAnotherLiquidityProvider)

      // Act
      const promise = spaceLp.connect(bob).swap(bob.address, true, { value: 1000 })

      // Assert
      await expect(promise).revertedWithCustomError(spaceLp, 'InsufficientLiquidity')
    })

    // TODO (if there is time): test that the contract can handle ERC-20 transfer failures via booleans. Requires
    // deploying a mock ERC-20 contract that can be configured to fail transfers.
    // it('should handle ERC-20 transfer failures', async () => {})
  })
})
