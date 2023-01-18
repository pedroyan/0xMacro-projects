/* eslint-disable camelcase */
// ----------------------------------------------------------------------------
// REQUIRED: Instructions
// ----------------------------------------------------------------------------
/*
  For this second project, we've provided dramatically reduce the amount
  of provided scaffolding in your test suite. We've done this to:

    1. Take the training wheels off, while still holding you accountable to the
       level of testing required. (Illustrated in the previous projects test suite.)
    2. Instead, redirect your attention to the next testing lesson; a more advanced
       testing feature we'll use called fixtures! (See comments below, where
       beforeEach used to be!)

  Please note that:

    - You will still find several places where "FILL_ME_IN" has been left for
      you. In those places, delete the "FILL_ME_IN" text, and replace it with
      whatever is appropriate.

    - You're free to edit the setupFixture function if you need to due to a
      difference in your design choices while implementing your contracts.
*/
// ----------------------------------------------------------------------------

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { BigNumber, BigNumberish } from 'ethers'
import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ForceFeeder__factory, ICO, ICO__factory, SpaceCoin } from '../typechain-types' // eslint-disable-line

enum IcoPhase {
  SEED,
  GENERAL,
  OPEN,
}

// ----------------------------------------------------------------------------
// OPTIONAL: Constants and Helper Functions
// ----------------------------------------------------------------------------
// We've put these here for your convenience, and to make you aware these built-in
// Hardhat functions exist. Feel free to use them if they are helpful!
const SECONDS_IN_DAY: number = 60 * 60 * 24
const ONE_ETHER: BigNumber = ethers.utils.parseEther('1')

// Bump the timestamp by a specific amount of seconds
const timeTravel = async (seconds: number): Promise<number> => {
  return time.increase(seconds)
}

// Or, set the time to be a specific amount (in seconds past epoch time)
const timeTravelTo = async (seconds: number): Promise<void> => {
  return time.increaseTo(seconds)
}

// Compare two BigNumbers that are close to one another.
//
// This is useful for when you want to compare the balance of an address after
// it executes a transaction, and you don't want to worry about accounting for
// balances changes due to paying for gas a.k.a. transaction fees.
const closeTo = async (a: BigNumberish, b: BigNumberish, margin: BigNumberish) => {
  expect(a).to.be.closeTo(b, margin)
}
// ----------------------------------------------------------------------------

describe('ICO', () => {
  let deployer: SignerWithAddress
  let treasury: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let carol: SignerWithAddress
  let allowlistedInvestors: SignerWithAddress[]
  let others: SignerWithAddress[]

  const SEED_INDIVIDUAL_LIMIT = ethers.utils.parseEther('1500')
  const GENERAL_INDIVIDUAL_LIMIT = ethers.utils.parseEther('1000')
  const MAX_CONTRIBUTION_LIMIT = ethers.utils.parseEther('30000')

  beforeEach(async () => {
    let rest: SignerWithAddress[]
    ;[deployer, treasury, alice, bob, carol, ...rest] = await ethers.getSigners()

    allowlistedInvestors = rest.slice(0, 11)

    others = rest.slice(11)
  })

  // See the Hardhat docs on fixture for why we're using them:
  // https://hardhat.org/hardhat-network-helpers/docs/reference#fixtures

  // In particular, they allow you to run your tests in parallel using
  // `npx hardhat test --parallel` without the error-prone side-effects
  // that come from using mocha's `beforeEach`
  async function setupFixture() {
    // NOTE: You may need to pass arguments to the `deploy` function, if your
    //       ICO contract's constructor has input parameters
    const ICO = (await ethers.getContractFactory('ICO')) as ICO__factory
    const ico: ICO = (await ICO.deploy(
      treasury.address,
      allowlistedInvestors.map((i) => i.address),
    )) as ICO
    await ico.deployed()

    const spaceCoin = (await ethers.getContractAt('SpaceCoin', await ico.spaceCoin())) as SpaceCoin
    return { ico, spaceCoin, deployer, treasury }
  }

  async function setupGeneralPhase() {
    const toReturn = await setupFixture()

    await toReturn.ico.connect(deployer).advancePhase(IcoPhase.GENERAL)

    return toReturn
  }

  async function setupOpenPhase() {
    const toReturn = await setupGeneralPhase()

    await toReturn.ico.connect(deployer).advancePhase(IcoPhase.OPEN)

    return toReturn
  }

  describe('Deployment & Initialization', () => {
    it('Deploys a contract', async () => {
      // NOTE: We don't need to extract spaceCoin here because we don't use it
      // in this test. However, we'll need to extract it in tests that require it.
      const { ico } = await loadFixture(setupFixture)

      const projecCode = await ethers.provider.getCode(ico.address)
      expect(projecCode).to.not.equal('0x')
    })

    it('ICO should be in SEED phase when initialized', async () => {
      const { ico } = await loadFixture(setupFixture)

      expect(await ico.currentPhase()).to.equal(IcoPhase.SEED)
    })

    it('ICO should have 150_000 SPC when initialized', async () => {
      const { ico, spaceCoin } = await loadFixture(setupFixture)

      expect(await spaceCoin.balanceOf(ico.address)).to.equal(ethers.utils.parseUnits('150000', 18))
    })
  })

  describe('Phase Changes', () => {
    it('should only allow the owner to change the phase', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)

      // Assert
      expect(await ico.currentPhase()).to.equal(IcoPhase.GENERAL)
    })

    it('should reject non-owner calls to change the phase', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      const promise = ico.connect(alice).advancePhase(IcoPhase.GENERAL)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(ico, 'Unauthorized')
      expect(await ico.currentPhase()).to.equal(IcoPhase.SEED)
    })

    it('should reject calls that skip past a phase', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      const promise = ico.connect(deployer).advancePhase(IcoPhase.OPEN)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(ico, 'InvalidTransition')
      expect(await ico.currentPhase()).to.equal(IcoPhase.SEED)
    })

    it('should protect the owner from accidently calling the "phase change" twice', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
      const promise = ico.connect(deployer).advancePhase(IcoPhase.GENERAL)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(ico, 'InvalidTransition')
      expect(await ico.currentPhase()).to.equal(IcoPhase.GENERAL)
    })

    it('should allow fully transitioning to the OPEN phase', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
      await ico.connect(deployer).advancePhase(IcoPhase.OPEN)

      // Assert
      expect(await ico.currentPhase()).to.equal(IcoPhase.OPEN)
    })

    it('should reject invalid phases', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
      await ico.connect(deployer).advancePhase(IcoPhase.OPEN)
      const promise = ico.connect(deployer).advancePhase(IcoPhase.OPEN + 1)

      // Assert
      await expect(promise).to.be.revertedWithoutReason()
    })

    it('should emit "PhaseChanged" event when transitioning to a new phase', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      const promise = ico.connect(deployer).advancePhase(IcoPhase.GENERAL)

      // Assert
      await expect(promise).to.emit(ico, 'PhaseChanged').withArgs(IcoPhase.SEED, IcoPhase.GENERAL)
    })

    // Should we wait for a phase to achieve full contribution before transitioning? Ask later
  })

  describe('SEED Phase', () => {
    const SEED_CONTRIBUTION_LIMIT = ethers.utils.parseEther('15000')

    it('should allow contributions from investors in the passlist', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      await ico.connect(allowlistedInvestors[0]).contribute({ value: ethers.utils.parseEther('1') })

      // Assert
      expect(await ico.totalContributions()).to.equal(ethers.utils.parseEther('1'))
      expect(await ico.totalContributionsMap(allowlistedInvestors[0].address)).to.equal(ethers.utils.parseEther('1'))
    })

    it('should allow multiple contributions from investors', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      await ico.connect(allowlistedInvestors[0]).contribute({ value: ethers.utils.parseEther('1') })
      await ico.connect(allowlistedInvestors[0]).contribute({ value: ethers.utils.parseEther('1') })

      // Assert
      expect(await ico.totalContributions()).to.equal(ethers.utils.parseEther('2'))
      expect(await ico.totalContributionsMap(allowlistedInvestors[0].address)).to.equal(ethers.utils.parseEther('2'))
    })

    it('should reject contributions from addresses not in the passlist', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      const promise = ico.connect(alice).contribute({ value: ethers.utils.parseEther('1') })

      // Assert
      await expect(promise).to.be.revertedWithCustomError(ico, 'InvestorNotInPasslist').withArgs(alice.address)
      expect(await ico.totalContributions()).to.equal(ethers.utils.parseEther('0'))
      expect(await ico.totalContributionsMap(alice.address)).to.equal(ethers.utils.parseEther('0'))
    })

    it('should enforce SEED individual contribution limit', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      const contribution = SEED_INDIVIDUAL_LIMIT.add(1)

      // Act
      const promise = ico.connect(allowlistedInvestors[0]).contribute({ value: contribution })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'IndividualLimitReached')
        .withArgs(allowlistedInvestors[0].address, contribution, SEED_INDIVIDUAL_LIMIT)
      expect(await ico.totalContributions()).to.equal(0)
      expect(await ico.totalContributionsMap(allowlistedInvestors[0].address)).to.equal(0)
    })

    it('should allow contributions at the individual limit', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      await ico.connect(allowlistedInvestors[0]).contribute({ value: SEED_INDIVIDUAL_LIMIT })

      // Assert
      expect(await ico.totalContributions()).to.equal(SEED_INDIVIDUAL_LIMIT)
      expect(await ico.totalContributionsMap(allowlistedInvestors[0].address)).to.equal(SEED_INDIVIDUAL_LIMIT)
    })

    it('should emit "ContributionReceived" event with the correct params', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      const contribution = ethers.utils.parseEther('1')

      // Act
      const promise = ico.connect(allowlistedInvestors[1]).contribute({ value: contribution })

      // Assert
      await expect(promise)
        .to.emit(ico, 'ContributionReceived')
        .withArgs(allowlistedInvestors[1].address, contribution, IcoPhase.SEED)
    })

    it('should not allow investors to make a last contribution above the individual SEED contribution limit', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      const contribution1 = SEED_INDIVIDUAL_LIMIT.div(2)
      const contribution2 = contribution1.add(1)

      // Act
      await ico.connect(allowlistedInvestors[0]).contribute({ value: contribution1 })
      const promise = ico.connect(allowlistedInvestors[0]).contribute({ value: contribution2 })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'IndividualLimitReached')
        .withArgs(allowlistedInvestors[0].address, contribution1.add(contribution2), SEED_INDIVIDUAL_LIMIT)
      expect(await ico.totalContributions()).to.equal(contribution1)
      expect(await ico.totalContributionsMap(allowlistedInvestors[0].address)).to.equal(contribution1)
    })

    it('should enforce SEED total contribution limit', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      const contributionPromiseArr: Promise<unknown>[] = []
      for (let i = 0; i < 10; i++) {
        contributionPromiseArr.push(ico.connect(allowlistedInvestors[i]).contribute({ value: SEED_INDIVIDUAL_LIMIT }))
      }
      await Promise.all(contributionPromiseArr) // Total Contribution here: 15_000 ETH, the exact limit for the SEED phase

      // Act
      const promise = ico.connect(allowlistedInvestors[10]).contribute({ value: 1 })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'PhaseLimitReached')
        .withArgs(SEED_CONTRIBUTION_LIMIT.add(1), SEED_CONTRIBUTION_LIMIT)
      expect(await ico.totalContributions()).to.equal(SEED_CONTRIBUTION_LIMIT)
    })

    it('should enforce SEED total contribution limit, even on the last contribution', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      const contributionPromiseArr: Promise<unknown>[] = []
      for (let i = 0; i < 9; i++) {
        contributionPromiseArr.push(ico.connect(allowlistedInvestors[i]).contribute({ value: SEED_INDIVIDUAL_LIMIT }))
      }
      const lastContribution = SEED_INDIVIDUAL_LIMIT.sub(ethers.utils.parseEther('10'))
      contributionPromiseArr.push(ico.connect(allowlistedInvestors[9]).contribute({ value: lastContribution }))
      await Promise.all([contributionPromiseArr]) // Total Contribution here: 14_990 ETH, 10 ETH short of the limit

      // Act
      const promise = ico.connect(allowlistedInvestors[10]).contribute({ value: ethers.utils.parseEther('11') })
      const newTotal = SEED_CONTRIBUTION_LIMIT.add(ethers.utils.parseEther('1')) // Contribution above goes 1 ETH above the top

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'PhaseLimitReached')
        .withArgs(newTotal, SEED_CONTRIBUTION_LIMIT)

      expect(await ico.totalContributions()).to.equal(ethers.utils.parseEther('14990')) // Total contributions should remain at 14_990 ETH
    })

    it('should reject token redemptions at this phase', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)

      // Act
      const promise = ico.connect(allowlistedInvestors[0]).redeemTokens()

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'NotAllowedOnPhase')
        .withArgs(IcoPhase.SEED, IcoPhase.OPEN)
    })
  })

  describe('GENERAL Phase', () => {
    it('it should allow any investor to contribute', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)
      const contribution = ethers.utils.parseEther('1')

      // Act
      await ico.connect(alice).contribute({ value: contribution })

      // Assert
      expect(await ico.totalContributions()).to.equal(contribution)
      expect(await ico.totalContributionsMap(alice.address)).to.equal(contribution)
    })

    it('should emit "ContributionReceived" event with the correct params', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)
      const contribution = ethers.utils.parseEther('1')

      // Act
      const tx = await ico.connect(alice).contribute({ value: contribution })

      // Assert
      await expect(tx).to.emit(ico, 'ContributionReceived').withArgs(alice.address, contribution, IcoPhase.GENERAL)
    })

    it('should allow multiple contributions from any investors', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)
      const contribution1 = ethers.utils.parseEther('1')
      const contribution2 = ethers.utils.parseEther('2')

      // Act
      await ico.connect(alice).contribute({ value: contribution1 })
      await ico.connect(alice).contribute({ value: contribution2 })

      // Assert
      const totalContribution = contribution1.add(contribution2)
      expect(await ico.totalContributions()).to.equal(totalContribution)
      expect(await ico.totalContributionsMap(alice.address)).to.equal(totalContribution)
    })

    it('should allow contributions at the individual limit', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)
      const contribution = GENERAL_INDIVIDUAL_LIMIT

      // Act
      await ico.connect(alice).contribute({ value: contribution })

      // Assert
      expect(await ico.totalContributions()).to.equal(contribution)
      expect(await ico.totalContributionsMap(alice.address)).to.equal(contribution)
    })

    it('should not allow investors to make a contribution above the individual contribution limit', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)
      const contribution = GENERAL_INDIVIDUAL_LIMIT.add(ethers.utils.parseEther('1'))

      // Act
      const promise = ico.connect(alice).contribute({ value: contribution })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'IndividualLimitReached')
        .withArgs(alice.address, contribution, GENERAL_INDIVIDUAL_LIMIT)
    })

    it('should not allow investors to make a last contribution above the individual contribution limit', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)
      const contribution = GENERAL_INDIVIDUAL_LIMIT.sub(ethers.utils.parseEther('10'))
      await ico.connect(alice).contribute({ value: contribution })

      // Act
      const contribution2 = ethers.utils.parseEther('11')
      const promise = ico.connect(alice).contribute({ value: contribution2 })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'IndividualLimitReached')
        .withArgs(alice.address, contribution.add(contribution2), GENERAL_INDIVIDUAL_LIMIT)
    })

    it('should enforce MAX total contribution limits', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)
      const accounts = [...allowlistedInvestors, ...others]

      const contributionPromiseArr: Promise<unknown>[] = []
      for (let i = 0; i < 30; i++) {
        contributionPromiseArr.push(ico.connect(accounts[i]).contribute({ value: GENERAL_INDIVIDUAL_LIMIT }))
      }
      await Promise.all(contributionPromiseArr) // Total Contribution: 30_000 ETH

      // Act
      const promise = ico.connect(bob).contribute({ value: 1 })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'PhaseLimitReached')
        .withArgs(MAX_CONTRIBUTION_LIMIT.add(1), MAX_CONTRIBUTION_LIMIT)
    })

    it('should reject token redemptions at this phase', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)

      // Act
      const promise = ico.connect(alice).redeemTokens()

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'NotAllowedOnPhase')
        .withArgs(IcoPhase.GENERAL, IcoPhase.OPEN)
    })

    it('should reject redemptionsTo at this phase', async () => {
      // Arrange
      const { ico } = await loadFixture(setupGeneralPhase)

      // Act
      const promise = ico.connect(alice).redeemTokensTo(bob.address)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'NotAllowedOnPhase')
        .withArgs(IcoPhase.GENERAL, IcoPhase.OPEN)
    })

    it('should enforce MAX total contribution limits to contributions made on the previous phases', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      let contributionPromiseArr: Promise<unknown>[] = []
      for (let i = 0; i < 10; i++) {
        contributionPromiseArr.push(ico.connect(allowlistedInvestors[i]).contribute({ value: SEED_INDIVIDUAL_LIMIT }))
      }
      await Promise.all(contributionPromiseArr) // Total Contribution here: 15_000 ETH

      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)

      contributionPromiseArr = []
      for (let i = 0; i < 15; i++) {
        contributionPromiseArr.push(ico.connect(others[i]).contribute({ value: GENERAL_INDIVIDUAL_LIMIT }))
      }
      await Promise.all(contributionPromiseArr) // Total Contribution: 30_000 ETH

      // Act
      const promise = ico.connect(alice).contribute({ value: 1 })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'PhaseLimitReached')
        .withArgs(MAX_CONTRIBUTION_LIMIT.add(1), MAX_CONTRIBUTION_LIMIT)
    })

    it('should enforce individual contribution limits to contributions made on the previous phases', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      const seedContribution = ethers.utils.parseEther('1200') // Someone invests 1200 ETH, advance phase, attempt to invest 1 ETH and get reversion
      await ico.connect(allowlistedInvestors[0]).contribute({ value: seedContribution })
      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)

      // Act
      const generalContribution = ethers.utils.parseEther('1')
      const promise = ico.connect(allowlistedInvestors[0]).contribute({ value: generalContribution })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'IndividualLimitReached')
        .withArgs(allowlistedInvestors[0].address, seedContribution.add(generalContribution), GENERAL_INDIVIDUAL_LIMIT)
    })
  })

  describe('OPEN Phase', () => {
    it('should allow any investor to contribute', async () => {
      // Arrange
      const { ico } = await loadFixture(setupOpenPhase)
      const contribution = ethers.utils.parseEther('1')

      // Act
      await ico.connect(alice).contribute({ value: contribution })

      // Assert
      expect(await ico.totalContributions()).to.equal(contribution)
      expect(await ico.totalContributionsMap(alice.address)).to.equal(contribution)
    })

    it('should emit "ContributionReceived" event with the correct params', async () => {
      // Arrange
      const { ico } = await loadFixture(setupOpenPhase)
      const contribution = ethers.utils.parseEther('1')

      // Act
      const tx = await ico.connect(alice).contribute({ value: contribution })

      // Assert
      await expect(tx).to.emit(ico, 'ContributionReceived').withArgs(alice.address, contribution, IcoPhase.OPEN)
    })

    it('should allow an investor to make the MAX total contribution', async () => {
      // Arrange
      const { ico } = await loadFixture(setupOpenPhase)
      const contribution = MAX_CONTRIBUTION_LIMIT

      // Act
      await ico.connect(alice).contribute({ value: contribution })

      // Assert
      expect(await ico.totalContributions()).to.equal(contribution)
      expect(await ico.totalContributionsMap(alice.address)).to.equal(contribution)
    })

    it('should enforce MAX total contribution limits', async () => {
      // Arrange
      const { ico } = await loadFixture(setupOpenPhase)
      const contribution = MAX_CONTRIBUTION_LIMIT.add(1)

      // Act
      const promise = ico.connect(alice).contribute({ value: contribution })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'PhaseLimitReached')
        .withArgs(MAX_CONTRIBUTION_LIMIT.add(1), MAX_CONTRIBUTION_LIMIT)
    })

    it('should remove individual contribution limits from previous phases', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)

      // Act
      await ico.connect(alice).contribute({ value: GENERAL_INDIVIDUAL_LIMIT })
      await ico.connect(deployer).advancePhase(IcoPhase.OPEN)
      await ico.connect(alice).contribute({ value: GENERAL_INDIVIDUAL_LIMIT })

      // Assert
      const twiceLimit = GENERAL_INDIVIDUAL_LIMIT.mul(2)
      expect(await ico.totalContributions()).to.equal(twiceLimit)
      expect(await ico.totalContributionsMap(alice.address)).to.equal(twiceLimit)
    })

    it('should enforce MAX total contribution limits to contributions made on the previous phases', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
      const accounts = [...allowlistedInvestors, ...others]

      const contributionPromiseArr: Promise<unknown>[] = []
      for (let i = 0; i < 30; i++) {
        contributionPromiseArr.push(ico.connect(accounts[i]).contribute({ value: GENERAL_INDIVIDUAL_LIMIT }))
      }
      await Promise.all(contributionPromiseArr) // Total Contribution: 30_000 ETH

      // Act
      await ico.connect(deployer).advancePhase(IcoPhase.OPEN)
      const promise = ico.connect(alice).contribute({ value: 1 })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'PhaseLimitReached')
        .withArgs(MAX_CONTRIBUTION_LIMIT.add(1), MAX_CONTRIBUTION_LIMIT)
    })

    it('should enforce MAX total contribution limit, even on the last contribution', async () => {
      // Arrange
      const { ico } = await loadFixture(setupFixture)
      await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
      await ico.connect(deployer).advancePhase(IcoPhase.OPEN)
      const contribution = MAX_CONTRIBUTION_LIMIT.sub(ethers.utils.parseEther('2'))

      // Act
      await ico.connect(alice).contribute({ value: contribution })
      const promise = ico.connect(alice).contribute({ value: ethers.utils.parseEther('3') })

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(ico, 'PhaseLimitReached')
        .withArgs(MAX_CONTRIBUTION_LIMIT.add(ethers.utils.parseEther('1')), MAX_CONTRIBUTION_LIMIT)
    })

    describe('Token Redemption', () => {
      it('should allow investors from SEED phase to redeem tokens at a 1:5 ratio', async () => {
        // Arrange
        const { ico, spaceCoin } = await loadFixture(setupFixture)
        const contribution = ethers.utils.parseEther('1')
        await ico.connect(allowlistedInvestors[0]).contribute({ value: contribution })
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
        await ico.connect(deployer).advancePhase(IcoPhase.OPEN)

        // Act
        await ico.connect(allowlistedInvestors[0]).redeemTokens()

        // Assert
        expect(await spaceCoin.balanceOf(allowlistedInvestors[0].address)).to.equal(contribution.mul(5))
      })

      it('should allow investors from GENERAL phase to redeem tokens at a 1:5 ratio', async () => {
        // Arrange
        const { ico, spaceCoin } = await loadFixture(setupFixture)
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
        const contribution = ethers.utils.parseEther('1')
        await ico.connect(alice).contribute({ value: contribution })
        await ico.connect(deployer).advancePhase(IcoPhase.OPEN)

        // Act
        await ico.connect(alice).redeemTokens()

        // Assert
        expect(await spaceCoin.balanceOf(alice.address)).to.equal(contribution.mul(5))
      })

      it('should allow investors from OPEN phase to redeem tokens at a 1:5 ratio', async () => {
        // Arrange
        const { ico, spaceCoin } = await setupOpenPhase()
        const contribution = ethers.utils.parseEther('1')
        await ico.connect(alice).contribute({ value: contribution })

        // Act
        await ico.connect(alice).redeemTokens()

        // Assert
        expect(await spaceCoin.balanceOf(alice.address)).to.equal(contribution.mul(5))
      })

      it('should emit a "TokensRedeemed" event', async () => {
        // Arrange
        const { ico } = await setupOpenPhase()
        const contribution = ethers.utils.parseEther('1')
        await ico.connect(alice).contribute({ value: contribution })

        // Act
        const tx = await ico.connect(alice).redeemTokens()

        // Assert
        await expect(tx).to.emit(ico, 'TokensRedeemed').withArgs(alice.address, alice.address, contribution.mul(5))
      })

      it('should reject token redemptions from investors that have not contributed to the ICO', async () => {
        // Arrange
        const { ico } = await setupOpenPhase()

        // Act
        const promise = ico.connect(alice).redeemTokens()

        // Assert
        await expect(promise).to.be.revertedWithCustomError(ico, 'NothingToRedeem').withArgs(alice.address)
      })

      it('should reject token redemptions from investors that have already redeemed their tokens', async () => {
        // Arrange
        const { ico } = await setupOpenPhase()
        const contribution = ethers.utils.parseEther('1')
        await ico.connect(alice).contribute({ value: contribution })
        await ico.connect(alice).redeemTokens()

        // Act
        const promise = ico.connect(alice).redeemTokens()

        // Assert
        await expect(promise).to.be.revertedWithCustomError(ico, 'NothingToRedeem').withArgs(alice.address)
      })

      it('should allow investors to redeem, contribute and redeem again', async () => {
        // Arrange
        const { ico, spaceCoin } = await setupOpenPhase()
        const contribution = ethers.utils.parseEther('1')
        await ico.connect(alice).contribute({ value: contribution })
        await ico.connect(alice).redeemTokens()

        // Act
        await ico.connect(alice).contribute({ value: contribution })
        await ico.connect(alice).redeemTokens()

        // Assert
        expect(await spaceCoin.balanceOf(alice.address)).to.equal(contribution.mul(2 * 5))
      })

      it('should allow redeeming tokens to an arbitrary destination', async () => {
        // Arrange
        const { ico, spaceCoin } = await setupOpenPhase()
        const contribution = ethers.utils.parseEther('1')
        await ico.connect(alice).contribute({ value: contribution })

        // Act
        await ico.connect(alice).redeemTokensTo(bob.address)

        // Assert
        expect(await spaceCoin.balanceOf(bob.address)).to.equal(contribution.mul(5))
      })

      it('should allow redeeming all tokens if MAX contribution is reached', async () => {
        // Arrange
        const { ico, spaceCoin } = await setupOpenPhase()
        await ico.connect(alice).contribute({ value: MAX_CONTRIBUTION_LIMIT })

        // Act
        await ico.connect(alice).redeemTokens()

        // Assert
        expect(await spaceCoin.balanceOf(alice.address)).to.equal(MAX_CONTRIBUTION_LIMIT.mul(5))
        expect(await spaceCoin.totalSupply()).to.equal(ethers.utils.parseEther('500000'))
      })
    })
  })

  describe('Pause Functionality', () => {
    describe('ETH Contributions', () => {
      it('should allow the owner to pause ETH Contributions at SEED phase', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)

        // Act
        await ico.connect(deployer).setPauseContributions(true)

        // Assert
        expect(await ico.pauseContributions()).to.be.true
        await expect(
          ico.connect(alice).contribute({ value: ethers.utils.parseEther('1') }),
        ).to.be.revertedWithCustomError(ico, 'ContributionsPaused')
      })

      it('should emit "PauseContributionsChanged" event', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)

        // Act
        const tx = await ico.connect(deployer).setPauseContributions(true)

        // Assert
        await expect(tx).to.emit(ico, 'PauseContributionsChanged').withArgs(true)
      })

      it('should allow the owner to pause ETH Contributions at GENERAL phase', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)

        // Act
        await ico.connect(deployer).setPauseContributions(true)

        // Assert
        expect(await ico.pauseContributions()).to.be.true
        await expect(
          ico.connect(alice).contribute({ value: ethers.utils.parseEther('1') }),
        ).to.be.revertedWithCustomError(ico, 'ContributionsPaused')
      })

      it('should allow the owner to pause ETH Contributions at OPEN phase', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
        await ico.connect(deployer).advancePhase(IcoPhase.OPEN)

        // Act
        await ico.connect(deployer).setPauseContributions(true)

        // Assert
        expect(await ico.pauseContributions()).to.be.true
        await expect(
          ico.connect(alice).contribute({ value: ethers.utils.parseEther('1') }),
        ).to.be.revertedWithCustomError(ico, 'ContributionsPaused')
      })

      it('should allow the owner to unpause ETH Contributions at SEED phase', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).setPauseContributions(true)

        // Act
        await ico.connect(deployer).setPauseContributions(false)

        // Assert
        expect(await ico.pauseContributions()).to.be.false
        await ico.connect(allowlistedInvestors[0]).contribute({ value: ethers.utils.parseEther('1') }) // should not revert
      })

      it('should allow the owner to unpause ETH Contributions at GENERAL phase', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
        await ico.connect(deployer).setPauseContributions(true)

        // Act
        await ico.connect(deployer).setPauseContributions(false)

        // Assert
        expect(await ico.pauseContributions()).to.be.false
        await ico.connect(allowlistedInvestors[0]).contribute({ value: ethers.utils.parseEther('1') }) // should not revert
      })

      it('should allow the owner to unpause ETH Contributions at OPEN phase', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
        await ico.connect(deployer).advancePhase(IcoPhase.OPEN)
        await ico.connect(deployer).setPauseContributions(true)

        // Act
        await ico.connect(deployer).setPauseContributions(false)

        // Assert
        expect(await ico.pauseContributions()).to.be.false
        await ico.connect(allowlistedInvestors[0]).contribute({ value: ethers.utils.parseEther('1') }) // should not revert
      })

      it('should revert if non-owner attempts to unpause ETH Contributions', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).setPauseContributions(true)

        // Act
        const promise = ico.connect(alice).setPauseContributions(false)

        // Assert
        await expect(promise).to.be.revertedWithCustomError(ico, 'Unauthorized')
      })

      it('should revert if non-owner attempts to unpause ETH Contributions', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).setPauseContributions(true)

        // Act
        const promise = ico.connect(alice).setPauseContributions(false)

        // Assert
        await expect(promise).to.be.revertedWithCustomError(ico, 'Unauthorized')
      })

      // should revert if setting does not change
      it('should revert if setting does not change', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)

        // Act
        const promise = ico.connect(deployer).setPauseContributions(false)

        // Assert
        await expect(promise).to.be.revertedWithCustomError(ico, 'FlagUnchanged').withArgs(false)
      })
    })

    describe('Token Redemptions', () => {
      it('should allow the owner to pause token redemptions at OPEN phase', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
        await ico.connect(deployer).advancePhase(IcoPhase.OPEN)

        // Act
        await ico.connect(deployer).setPauseRedemptions(true)

        // Assert
        expect(await ico.pauseRedemptions()).to.be.true
        await expect(ico.connect(alice).redeemTokens()).to.be.revertedWithCustomError(ico, 'RedemptionsPaused')
      })

      it('should emit "PauseRedemptionsChanged" event', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)

        // Act
        const tx = await ico.connect(deployer).setPauseRedemptions(true)

        // Assert
        await expect(tx).to.emit(ico, 'PauseRedemptionsChanged').withArgs(true)
      })

      it('should allow the owner to unpause token redemptions at OPEN phase', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
        await ico.connect(deployer).advancePhase(IcoPhase.OPEN)
        await ico.connect(deployer).setPauseRedemptions(true)

        // Act
        await ico.connect(alice).contribute({ value: ethers.utils.parseEther('1') })
        await ico.connect(deployer).setPauseRedemptions(false)

        // Assert
        expect(await ico.pauseRedemptions()).to.be.false
        await ico.connect(alice).redeemTokens() // should not revert
      })

      it('should revert if non-owner attempts to pause token redemptions', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)

        // Act
        const promise = ico.connect(alice).setPauseRedemptions(true)

        // Assert
        await expect(promise).to.be.revertedWithCustomError(ico, 'Unauthorized')
      })

      it('should revert if non-owner attempts to unpause token redemptions', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)
        await ico.connect(deployer).setPauseRedemptions(true)

        // Act
        const promise = ico.connect(alice).setPauseRedemptions(false)

        // Assert
        await expect(promise).to.be.revertedWithCustomError(ico, 'Unauthorized')
      })

      it('should revert if setting does not change', async () => {
        // Arrange
        const { ico } = await loadFixture(setupFixture)

        // Act
        const promise = ico.connect(deployer).setPauseRedemptions(false)

        // Assert
        await expect(promise).to.be.revertedWithCustomError(ico, 'FlagUnchanged').withArgs(false)
      })
    })
  })

  describe('Attacks', () => {
    async function setupFixtureAndForceFeeder() {
      const toReturn = await setupFixture()

      const ForceFeederFactory = (await ethers.getContractFactory('ForceFeeder')) as ForceFeeder__factory
      const forceFeeder = await ForceFeederFactory.deploy(toReturn.ico.address)

      return { ...toReturn, forceFeeder }
    }

    describe('ETH Force-Feeding', async () => {
      it('should not account for force-fed ETH', async () => {
        // Arrange
        const { ico, forceFeeder } = await loadFixture(setupFixtureAndForceFeeder)

        // Act
        await forceFeeder.connect(deployer).forceFeedIco({ value: ethers.utils.parseEther('1') })

        // Assert
        expect(await ico.totalContributions()).to.equal(ethers.utils.parseEther('0'))
        expect(await ethers.provider.getBalance(ico.address)).to.equal(ethers.utils.parseEther('1'))
      })

      it('should not take into account force-fed ETH in the phase limits', async () => {
        // Arrange
        const { ico, forceFeeder } = await loadFixture(setupFixtureAndForceFeeder)
        const contributionPromiseArr: Promise<unknown>[] = []
        for (let i = 0; i < 9; i++) {
          contributionPromiseArr.push(ico.connect(allowlistedInvestors[i]).contribute({ value: SEED_INDIVIDUAL_LIMIT }))
        }
        await Promise.all(contributionPromiseArr) // Total Contribution here: 13_500 ETH, 1_500 ETH left
        // Act
        forceFeeder.connect(deployer).forceFeedIco({ value: SEED_INDIVIDUAL_LIMIT }) // Contribute 1_500 ETH, but not accounted for the limit
        await ico.connect(allowlistedInvestors[9]).contribute({ value: SEED_INDIVIDUAL_LIMIT }) // Total Contribution here: 15_000 ETH. Should not revert.

        // Assert
        expect(await ico.totalContributions()).to.equal(ethers.utils.parseEther('15000'))
      })

      it('should not skew token redemption ratios for force-fed ETH', async () => {
        // Arrange
        const { ico, forceFeeder, spaceCoin } = await loadFixture(setupFixtureAndForceFeeder)
        await ico.connect(deployer).advancePhase(IcoPhase.GENERAL)
        await ico.connect(deployer).advancePhase(IcoPhase.OPEN)
        const contribution = MAX_CONTRIBUTION_LIMIT

        // Act
        await ico.connect(alice).contribute({ value: contribution })
        await forceFeeder.connect(bob).forceFeedIco({ value: ethers.utils.parseEther('100') })
        await ico.connect(alice).redeemTokens()

        // Assert
        expect(await ico.totalContributions()).to.equal(contribution)
        expect(await spaceCoin.balanceOf(alice.address)).to.equal(MAX_CONTRIBUTION_LIMIT.mul(5))
      })
    })
  })
})
