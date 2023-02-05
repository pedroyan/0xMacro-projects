import { expect } from 'chai'
import { ethers } from 'hardhat'
import { BigNumber, BigNumberish } from 'ethers'
import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ICO, SpaceCoin, SpaceCoin__factory, ICO__factory } from '../typechain-types' // eslint-disable-line
import { INITIAL_TREASURY_BALANCE } from './helpers'

describe('SpaceCoin', () => {
  let deployer: SignerWithAddress
  let treasury: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let carol: SignerWithAddress
  let others: SignerWithAddress[]

  beforeEach(async () => {
    ;[deployer, treasury, alice, bob, carol, ...others] = await ethers.getSigners()
  })

  // See the Hardhat docs on fixture for why we're using them:
  // https://hardhat.org/hardhat-network-helpers/docs/reference#fixtures

  // In particular, they allow you to run your tests in parallel using
  // `npx hardhat test --parallel` without the error-prone side-effects
  // that come from using mocha's `beforeEach`
  async function setupFixture() {
    // NOTE: You may need to pass arguments to the `deploy` function, if your
    //       ICO contract's constructor has input parameters
    const ICO = await ethers.getContractFactory('ICO')
    const ico: ICO = await ICO.deploy(treasury.address, [])
    await ico.deployed()

    const spaceCoin = (await ethers.getContractAt('SpaceCoin', await ico.spaceCoin())) as SpaceCoin
    return { ico, spaceCoin, deployer, treasury, bob }
  }

  async function setupFixtureWithBobFunded() {
    const toReturn = await setupFixture()

    await toReturn.spaceCoin.connect(treasury).transfer(toReturn.bob.address, ethers.utils.parseUnits('100', 18))

    const treasuryBalance = await toReturn.spaceCoin.balanceOf(treasury.address)

    return { ...toReturn, treasuryBalance }
  }

  describe('Deployment & Test Setup', () => {
    it('Deploys a contract', async () => {
      const { spaceCoin } = await loadFixture(setupFixture)

      const projecCode = await ethers.provider.getCode(spaceCoin.address)
      expect(projecCode).to.not.equal('0x')
    })
  })

  describe('Token Properties', () => {
    it('should have the correct name', async () => {
      // Act
      const { spaceCoin } = await loadFixture(setupFixture)

      // Assert
      expect(await spaceCoin.name()).to.equal('SpaceCoin')
    })

    it('should have the correct symbol', async () => {
      // Act
      const { spaceCoin } = await loadFixture(setupFixture)

      // Assert
      expect(await spaceCoin.symbol()).to.equal('SPC')
    })

    it('should have the correct decimals', async () => {
      // Act
      const { spaceCoin } = await loadFixture(setupFixture)

      // Assert
      expect(await spaceCoin.decimals()).to.equal(18)
    })
  })

  describe('Initialization', () => {
    it('should mint a total supply of 500,000 SPC uppon initialization', async () => {
      // Act
      const { spaceCoin } = await loadFixture(setupFixture)

      // Assert
      expect(await spaceCoin.totalSupply()).to.equal(ethers.utils.parseUnits('500000', 18))
    })

    it('should mint 150,000 SPC tokens to the ICO Contract uppon initialization', async () => {
      // Act
      const { spaceCoin, ico } = await loadFixture(setupFixture)

      // Assert
      expect(await spaceCoin.balanceOf(ico.address)).to.equal(ethers.utils.parseUnits('150000', 18))
    })

    it('should mint 350,000 SPC tokens to the Treasury', async () => {
      // Act
      const { spaceCoin } = await loadFixture(setupFixture)

      // Assert
      expect(await spaceCoin.balanceOf(treasury.address)).to.equal(INITIAL_TREASURY_BALANCE)
    })
  })

  describe('ERC-20 Mechanics', () => {
    it('should allow addresses to transfer tokens to another address', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixture)

      // Act
      await spaceCoin.connect(treasury).transfer(bob.address, ethers.utils.parseUnits('100', 18))

      // Assert
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(ethers.utils.parseUnits('100', 18))
    })

    it('should not allow transfers bigger than the existing balance', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixture)

      // Act
      const promise = spaceCoin.connect(treasury).transfer(bob.address, ethers.utils.parseUnits('9000000', 18))

      // Assert
      await expect(promise).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('should allow addresses to transfer tokens to another address (via allowance)', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixture)

      // Act
      await spaceCoin.connect(treasury).approve(bob.address, ethers.utils.parseUnits('100', 18))
      await spaceCoin.connect(bob).transferFrom(treasury.address, alice.address, ethers.utils.parseUnits('100', 18))

      // Assert
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(ethers.utils.parseUnits('100', 18))
    })

    it('should not allow transfers bigger than the existing allowance', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixture)

      // Act
      await spaceCoin.connect(treasury).approve(bob.address, ethers.utils.parseUnits('100', 18))
      const promise = spaceCoin
        .connect(bob)
        .transferFrom(treasury.address, alice.address, ethers.utils.parseUnits('101', 18))

      // Assert
      await expect(promise).to.be.revertedWith('ERC20: insufficient allowance')
    })

    it('should deduct the transferred amount from allowance', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixture)

      // Act
      await spaceCoin.connect(treasury).approve(bob.address, ethers.utils.parseUnits('100', 18))
      await spaceCoin.connect(bob).transferFrom(treasury.address, alice.address, ethers.utils.parseUnits('50', 18))

      // Assert
      expect(await spaceCoin.allowance(treasury.address, bob.address)).to.equal(ethers.utils.parseUnits('50', 18))
      const overAllowancePromise = spaceCoin
        .connect(bob)
        .transferFrom(treasury.address, alice.address, ethers.utils.parseUnits('51', 18))
      await expect(overAllowancePromise).to.be.revertedWith('ERC20: insufficient allowance')
    })
  })

  describe('Tax', () => {
    it('should be disabled by default', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixtureWithBobFunded)

      // Act
      await spaceCoin.connect(bob).transfer(alice.address, ethers.utils.parseUnits('100', 18))

      // Assert
      expect(await spaceCoin.taxTransfers()).to.equal(false)
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(ethers.utils.parseUnits('100', 18))
    })

    it('should be configurable by the owner (Turn On)', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixtureWithBobFunded)

      // Act
      await spaceCoin.connect(deployer).setTaxTransfers(true)

      // Assert
      expect(await spaceCoin.taxTransfers()).to.equal(true)
    })

    it('should be configurable by the owner (Turn Off)', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixtureWithBobFunded)

      // Act
      await spaceCoin.connect(deployer).setTaxTransfers(true)
      await spaceCoin.connect(deployer).setTaxTransfers(false)

      // Assert
      expect(await spaceCoin.taxTransfers()).to.equal(false)
    })

    it('should revert if setting does not change', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixtureWithBobFunded)

      // Act
      const promise = spaceCoin.connect(deployer).setTaxTransfers(false)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(spaceCoin, 'FlagUnchanged').withArgs(false)
    })

    it('should prevent non-owner from configuring tax', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixtureWithBobFunded)

      // Act
      const promise = spaceCoin.connect(bob).setTaxTransfers(true)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(spaceCoin, 'Unauthorized')
    })

    it('should charge a 2% tax on a transfer from one address to another address', async () => {
      // Arrange
      const { spaceCoin, treasuryBalance } = await loadFixture(setupFixtureWithBobFunded)

      // Act
      await spaceCoin.connect(deployer).setTaxTransfers(true)
      await spaceCoin.connect(bob).transfer(alice.address, ethers.utils.parseUnits('100', 18))

      // Assert
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(ethers.utils.parseUnits('0', 18))
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(ethers.utils.parseUnits('98', 18))
      const netTreasuryBalanceChange = (await spaceCoin.balanceOf(treasury.address)).sub(treasuryBalance)
      expect(netTreasuryBalanceChange).to.equal(ethers.utils.parseUnits('2', 18))
    })

    it('should charge a 2% tax on approved transfers from one address to another address', async () => {
      // Arrange
      const { spaceCoin, treasuryBalance } = await loadFixture(setupFixtureWithBobFunded)

      // Act
      await spaceCoin.connect(deployer).setTaxTransfers(true)
      await spaceCoin.connect(bob).approve(alice.address, ethers.utils.parseUnits('100', 18))
      await spaceCoin.connect(alice).transferFrom(bob.address, carol.address, ethers.utils.parseUnits('100', 18))

      // Assert
      expect(await spaceCoin.balanceOf(bob.address)).to.equal(ethers.utils.parseUnits('0', 18))
      expect(await spaceCoin.balanceOf(carol.address)).to.equal(ethers.utils.parseUnits('98', 18))
      const netTreasuryBalanceChange = (await spaceCoin.balanceOf(treasury.address)).sub(treasuryBalance)
      expect(netTreasuryBalanceChange).to.equal(ethers.utils.parseUnits('2', 18))
    })

    it('should enforce allowance limits, even with tax enabled', async () => {
      // Arrange
      const { spaceCoin } = await loadFixture(setupFixtureWithBobFunded)

      // Act
      await spaceCoin.connect(deployer).setTaxTransfers(true)
      await spaceCoin.connect(bob).approve(alice.address, ethers.utils.parseUnits('100', 18))
      const promise = spaceCoin
        .connect(alice)
        .transferFrom(bob.address, carol.address, ethers.utils.parseUnits('101', 18))

      // Assert
      await expect(promise).to.be.revertedWith('ERC20: insufficient allowance')
    })

    it('should round-down the tax amount to the nearest whole number', async () => {
      // Arrange
      const { spaceCoin, treasuryBalance } = await loadFixture(setupFixtureWithBobFunded)
      const bobBeforeBalance = await spaceCoin.balanceOf(bob.address)

      // Act
      const TRANSFER = 51
      await spaceCoin.connect(deployer).setTaxTransfers(true)
      await spaceCoin.connect(bob).transfer(alice.address, TRANSFER)

      // Assert
      expect((await spaceCoin.balanceOf(bob.address)).sub(bobBeforeBalance)).to.equal(-TRANSFER)
      expect(await spaceCoin.balanceOf(alice.address)).to.equal(TRANSFER - 1)
      const netTreasuryBalanceChange = (await spaceCoin.balanceOf(treasury.address)).sub(treasuryBalance)
      expect(netTreasuryBalanceChange).to.equal(1)
    })
  })
})
