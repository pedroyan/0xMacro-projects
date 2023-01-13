// ----------------------------------------------------------------------------
// REQUIRED: Instructions
// ----------------------------------------------------------------------------
/*
  For this first project, we've provided a significant amount of scaffolding
  in your test suite. We've done this to:

    1. Set expectations, by example, of where the bar for testing is.
    3. Reduce the amount of time consumed this week by "getting started friction".

  Please note that:

    - We will not be so generous on future projects!
    - The tests provided are about ~90% complete.
    - IMPORTANT:
      - We've intentionally left out some tests that would reveal potential
        vulnerabilities you'll need to identify, solve for, AND TEST FOR!

      - Failing to address these vulnerabilities will leave your contracts
        exposed to hacks, and will certainly result in extra points being
        added to your micro-audit report! (Extra points are _bad_.)

  Your job (in this file):

    - DO NOT delete or change the test names for the tests provided
    - DO complete the testing logic inside each tests' callback function
    - DO add additional tests to test how you're securing your smart contracts
         against potential vulnerabilties you identify as you work through the
         project.

    - You will also find several places where "FILL_ME_IN" has been left for
      you. In those places, delete the "FILL_ME_IN" text, and replace with
      whatever is appropriate.
*/
// ----------------------------------------------------------------------------

import { expect, util } from 'chai'
import { ethers } from 'hardhat'
import { BigNumber, BigNumberish } from 'ethers'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  ERC721Attacker,
  ERC721Attacker__factory,
  ERC721Ignorant,
  ERC721Ignorant__factory,
  ERC721Receiver,
  ERC721Receiver__factory,
  Project,
  ProjectFactory,
  ProjectFactory__factory,
  Project__factory,
  RefundAttacker,
  RefundAttacker__factory,
} from '../typechain-types' // eslint-disable-line

// ----------------------------------------------------------------------------
// OPTIONAL: Constants and Helper Functions
// ----------------------------------------------------------------------------
// We've put these here for your convenience, and to make you aware these built-in
// Hardhat functions exist. Feel free to use them if they are helpful!
// eslint-disable-next-line no-unused-vars
const SECONDS_IN_DAY: number = 60 * 60 * 24
// eslint-disable-next-line no-unused-vars
const ONE_ETHER: BigNumber = ethers.utils.parseEther('1')

// Bump the timestamp by a specific amount of seconds
// eslint-disable-next-line no-unused-vars
const timeTravel = async (seconds: number): Promise<number> => {
  return time.increase(seconds)
}

// Or, set the time to be a specific amount (in seconds past epoch time)
// eslint-disable-next-line no-unused-vars
const timeTravelTo = async (seconds: number): Promise<void> => {
  return time.increaseTo(seconds)
}

// Compare two BigNumbers that are close to one another.
//
// This is useful for when you want to compare the balance of an address after
// it executes a transaction, and you don't want to worry about accounting for
// balances changes due to paying for gas a.k.a. transaction fees.
// eslint-disable-next-line no-unused-vars
const closeTo = async (a: BigNumberish, b: BigNumberish, margin: BigNumberish) => {
  expect(a).to.be.closeTo(b, margin)
}

enum ProjectStatus {
  Active = 0,
  Failed,
  Funded,
}
// ----------------------------------------------------------------------------

describe('Crowdfundr', () => {
  // eslint-disable-next-line no-unused-vars
  let deployer: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let bert: SignerWithAddress

  let ProjectFactory: ProjectFactory__factory
  let projectFactory: ProjectFactory

  beforeEach(async () => {
    ;[deployer, alice, bob, bert] = await ethers.getSigners()

    ProjectFactory = (await ethers.getContractFactory('ProjectFactory')) as ProjectFactory__factory
    projectFactory = (await ProjectFactory.deploy()) as ProjectFactory
    await projectFactory.deployed()
  })

  describe('ProjectFactory: Additional Tests', () => {
    // If you are looking for my additional tests, look for tests and sections prefixed with "ADDED -". This is to allow collocation of tests and was
    // accepted by the Instructions Team as a valid format.
    // https://discord.com/channels/870313767873962014/1062064790412996659/1063139568611774564
  })

  describe('ProjectFactory', () => {
    it('Deploys a contract', async () => {
      // Act
      const receipt = await projectFactory
        .connect(alice)
        .create(ethers.utils.parseEther('1'))
        .then((tx) => tx.wait())

      // Assert
      const projectAddress = receipt.events![0].args![0]
      const projecCode = await ethers.provider.getCode(projectAddress)
      expect(projecCode).to.not.equal('0x')
    })

    it('Can register a single project', async () => {
      // Act
      const receipt = await projectFactory
        .connect(alice)
        .create(ethers.utils.parseEther('1'))
        .then((tx) => tx.wait())

      // Assert
      const registeredProjects = await projectFactory.getProjects()
      expect(registeredProjects.length).to.equal(1)
      expect(registeredProjects[0]).to.equal(receipt.events![0].args![0])
    })

    it('Can register multiple projects', async () => {
      // Act
      await Promise.all([
        projectFactory.connect(alice).create(ethers.utils.parseEther('1')),
        projectFactory.connect(bob).create(ethers.utils.parseEther('1')),
        projectFactory.connect(bert).create(ethers.utils.parseEther('1')),
      ])

      // Assert
      const registeredProjects = await projectFactory.getProjects()
      expect(registeredProjects.length).to.equal(3)
    })

    it('Registers projects with the correct owner', async () => {
      // Act
      await projectFactory.connect(alice).create(ethers.utils.parseEther('1'))

      // Assert
      const registeredProjects = await projectFactory.getProjects()
      const projectContract = Project__factory.connect(registeredProjects[0], ethers.provider)
      expect(await projectContract.creator()).to.equal(alice.address)
    })

    it('Registers projects with a preset funding goal (in units of wei)', async () => {
      // Arrange
      const fundingGoal = ethers.utils.parseEther('1')

      // Act
      await projectFactory.connect(alice).create(fundingGoal)

      // Assert
      const registeredProjects = await projectFactory.getProjects()
      const projectContract = Project__factory.connect(registeredProjects[0], ethers.provider)
      expect(await projectContract.fundingGoal()).to.equal(fundingGoal)
    })

    it('Emits a "ProjectCreated" event after registering a project', async () => {
      // ---- Act -----
      const receipt = await projectFactory
        .connect(alice)
        .create(ethers.utils.parseEther('1'))
        .then((tx) => tx.wait())

      // ---- Assert ----

      // Ensure event was emitted
      expect(receipt.logs.length).to.equal(1)
      const projectCreatedEvent = receipt.events![0]
      expect(projectCreatedEvent.topics[0]).to.equal(projectFactory.interface.getEventTopic('ProjectCreated'))

      // Ensure the contract in the event matches the registered contract
      const registeredProjects = await projectFactory.getProjects()
      expect(registeredProjects.length).to.equal(1)
      expect(registeredProjects[0]).to.equal(projectCreatedEvent.args![0])

      // Ensures the remaining arguments are correct
      expect(projectCreatedEvent.args![1]).to.equal(alice.address)
      expect(projectCreatedEvent.args![2]).to.equal(ethers.utils.parseEther('1'))
    })

    it('Allows multiple contracts to accept ETH simultaneously', async () => {
      // Arrange
      await Promise.all([
        projectFactory.connect(alice).create(ethers.utils.parseEther('1')),
        projectFactory.connect(bob).create(ethers.utils.parseEther('1')),
      ])
      const registeredProjects = await projectFactory.getProjects()

      const project0Contribution = ethers.utils.parseEther('0.3')
      const project1Contribution = ethers.utils.parseEther('0.5')

      // Act
      await Promise.all([
        Project__factory.connect(registeredProjects[0], alice).contribute({
          value: project0Contribution,
        }),
        Project__factory.connect(registeredProjects[1], bob).contribute({
          value: project1Contribution,
        }),
      ])

      // Assert
      expect(await ethers.provider.getBalance(registeredProjects[0])).to.equal(project0Contribution)
      expect(await ethers.provider.getBalance(registeredProjects[1])).to.equal(project1Contribution)
    })

    it('ADDED - Rejects the creation of projects with funding goals below minimum contribution (0.01 ETH)', async () => {
      // Act
      const promise = projectFactory.connect(alice).create(ethers.utils.parseEther('0.009'))

      // Assert
      await expect(promise).to.be.revertedWithCustomError(projectFactory, 'InvalidFundingGoal')
    })
  })

  describe('Project: Additional Tests', () => {
    // If you are looking for my additional tests, look for tests and sections prefixed with "ADDED -". This is to allow collocation of tests and was
    // accepted by the Instructions Team as a valid format.
    // https://discord.com/channels/870313767873962014/1062064790412996659/1063139568611774564
  })

  describe('Project', () => {
    let project: Project
    let creator: SignerWithAddress
    const FUNDING_GOAL = ethers.utils.parseEther('10')

    beforeEach(async () => {
      creator = deployer
      const txReceipt = await projectFactory
        .connect(creator)
        .create(FUNDING_GOAL)
        .then((tx) => tx.wait())

      const projectAddress = txReceipt.events![0].args![0]
      project = (await ethers.getContractAt('Project', projectAddress)) as Project
    })

    describe('Contributions', () => {
      describe('Contributors', () => {
        it('Allows the creator to contribute', async () => {
          // Arrange
          const contribution = ethers.utils.parseEther('1')

          // Act
          await project.connect(creator).contribute({ value: contribution })

          // Assert
          expect(await ethers.provider.getBalance(project.address)).to.equal(contribution)
        })

        it('Allows any EOA to contribute', async () => {
          // Arrange
          const contribution = ethers.utils.parseEther('1')

          // Act
          await project.connect(alice).contribute({ value: contribution })

          // Assert
          expect(await ethers.provider.getBalance(project.address)).to.equal(contribution)
        })

        it('Allows an EOA to make many separate contributions', async () => {
          // Arrange
          const contributions = [
            ethers.utils.parseEther('0.1'),
            ethers.utils.parseEther('0.5'),
            ethers.utils.parseEther('0.7'),
          ]

          // Act
          for (const contribution of contributions) {
            await project.connect(alice).contribute({ value: contribution })
          }

          // Assert
          const sum = contributions.reduce((a, b) => a.add(b))
          expect(await ethers.provider.getBalance(project.address)).to.equal(sum)
        })

        it('Emits a "ContributionReceived" event after a contribution is made', async () => {
          // ---- Arrange ----
          const contribution = ethers.utils.parseEther('0.5')

          // ---- Act -----
          const receipt = await project
            .connect(alice)
            .contribute({ value: contribution })
            .then((tx) => tx.wait())

          // ---- Assert ----
          expect(receipt.logs.length).to.equal(1)

          const contributionReceivedEvent = receipt.events![0]
          expect(contributionReceivedEvent.topics[0]).to.equal(project.interface.getEventTopic('ContributionReceived'))

          expect(contributionReceivedEvent.args![0]).to.equal(alice.address)
          expect(contributionReceivedEvent.args![1]).to.equal(contribution)
        })
      })

      describe('Minimum ETH Per Contribution', () => {
        it('Reverts contributions below 0.01 ETH', async () => {
          // Arrange
          const contribution = ethers.utils.parseEther('0.009')

          // Act
          const promise = project.connect(alice).contribute({ value: contribution })

          // Assert
          await expect(promise).to.be.revertedWithCustomError(project, 'InsuficientContribution')
        })

        it('Accepts contributions of exactly 0.01 ETH', async () => {
          // Arrange
          const contribution = ethers.utils.parseEther('0.01')

          // Act
          await project.connect(alice).contribute({ value: contribution })

          // Assert
          expect(await ethers.provider.getBalance(project.address)).to.equal(contribution)
        })
      })

      describe('Final Contributions', () => {
        it('Allows the final contribution to exceed the project funding goal', async () => {
          // Arrange
          const contribution1 = FUNDING_GOAL.sub(ethers.utils.parseEther('1')) // 1 ETH short of funding goal
          await project.connect(alice).contribute({ value: contribution1 })

          // Act
          const contribution2 = ethers.utils.parseEther('5') // 4 ETH over funding goal (considering the 1 ETH short above)
          await project.connect(bob).contribute({ value: contribution2 })

          // Assert
          const expectedBalance = contribution1.add(contribution2)
          expect(await ethers.provider.getBalance(project.address)).to.equal(expectedBalance)
        })

        it('Prevents additional contributions after a project is fully funded', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })

          // Act
          const contribution2 = ethers.utils.parseEther('0.01')
          const promise = project.connect(bob).contribute({ value: contribution2 })

          // Assert
          await expect(promise)
            .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
            .withArgs(ProjectStatus.Active, ProjectStatus.Funded)
        })

        it('Prevents additional contributions after 30 days have passed since Project instance deployment', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') }) // First contribution - OK
          await timeTravel(30 * 24 * 60 * 60 + 1) // 30 days and 1 second later

          // Act
          const promise = project.connect(bob).contribute({ value: ethers.utils.parseEther('1') })

          // Assert
          await expect(promise)
            .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
            .withArgs(ProjectStatus.Active, ProjectStatus.Failed)
        })

        it('ADDED - Prevents additional contributions when project is cancelled', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') }) // First contribution - OK
          await project.connect(creator).cancel()

          // Act
          const promise = project.connect(bob).contribute({ value: ethers.utils.parseEther('1') })

          // Assert
          await expect(promise)
            .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
            .withArgs(ProjectStatus.Active, ProjectStatus.Failed)
        })
      })
    })

    describe('Withdrawals', () => {
      describe('Project Status: Active', () => {
        it('Prevents the creator from withdrawing any funds', async () => {
          // Arrange
          const contribution = ethers.utils.parseEther('0.5')
          await project.connect(alice).contribute({ value: contribution })

          // Act
          const promise = project.connect(creator).withdraw(contribution)

          // Assert
          await expect(promise)
            .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
            .withArgs(ProjectStatus.Funded, ProjectStatus.Active)
        })

        it('Prevents contributors from withdrawing any funds', async () => {
          // Arrange
          const contribution = ethers.utils.parseEther('0.5')
          await project.connect(alice).contribute({ value: contribution })

          // Act
          const promise = project.connect(alice).withdraw(contribution)

          // Assert
          await expect(promise).to.be.revertedWithCustomError(project, 'Unauthorized')
        })

        it('Prevents non-contributors from withdrawing any funds', async () => {
          // Arrange
          const contribution = ethers.utils.parseEther('0.5')
          await project.connect(alice).contribute({ value: contribution })

          // Act
          const promise = project.connect(bert).withdraw(contribution)

          // Assert
          await expect(promise).to.be.revertedWithCustomError(project, 'Unauthorized')
        })
      })

      describe('Project Status: Success', () => {
        it('Allows the creator to withdraw some of the contribution balance', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })
          const creatorBalanceBefore = await ethers.provider.getBalance(creator.address)

          // Act
          const withdrawal = ethers.utils.parseEther('0.5')
          const receipt = await project
            .connect(creator)
            .withdraw(withdrawal)
            .then((tx) => tx.wait())

          // Assert
          const balanceDelta = (await ethers.provider.getBalance(creator.address)).sub(creatorBalanceBefore)
          const gasCosts = receipt.gasUsed.mul(receipt.effectiveGasPrice)
          const expectedNetWithdrawal = withdrawal.sub(gasCosts)
          expect(balanceDelta).to.equal(expectedNetWithdrawal)
        })

        it('Allows the creator to withdraw the entire contribution balance', async () => {
          // Arrange
          const totalContribution = FUNDING_GOAL.add(ethers.utils.parseEther('1'))
          await project.connect(alice).contribute({ value: totalContribution })
          const creatorBalanceBefore = await ethers.provider.getBalance(creator.address)

          // Act
          const receipt = await project
            .connect(creator)
            .withdraw(totalContribution)
            .then((tx) => tx.wait())

          // Assert
          const balanceDelta = (await ethers.provider.getBalance(creator.address)).sub(creatorBalanceBefore)
          const gasCosts = receipt.gasUsed.mul(receipt.effectiveGasPrice)
          const expectedNetWithdrawal = totalContribution.sub(gasCosts)
          expect(balanceDelta).to.equal(expectedNetWithdrawal)
        })

        it('Allows the creator to make multiple withdrawals', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })
          const creatorBalanceBefore = await ethers.provider.getBalance(creator.address)

          // Act
          const halfWithdrawal = FUNDING_GOAL.div(2)
          const withdrawal1 = await project
            .connect(creator)
            .withdraw(halfWithdrawal)
            .then((tx) => tx.wait())

          const withdrawal2 = await project
            .connect(creator)
            .withdraw(halfWithdrawal)
            .then((tx) => tx.wait())

          // Assert
          const balanceDelta = (await ethers.provider.getBalance(creator.address)).sub(creatorBalanceBefore)
          const gasCosts = [
            withdrawal1.gasUsed.mul(withdrawal1.effectiveGasPrice),
            withdrawal2.gasUsed.mul(withdrawal2.effectiveGasPrice),
          ].reduce((a, b) => a.add(b))

          const expectedNetWithdrawal = FUNDING_GOAL.sub(gasCosts)
          expect(balanceDelta).to.equal(expectedNetWithdrawal)
        })

        it('Prevents the creator from withdrawing more than the contribution balance', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })

          // Act
          const promise = project.connect(creator).withdraw(FUNDING_GOAL.add(1))

          // Assert
          await expect(promise).to.be.revertedWithCustomError(project, 'EthTransferFailed')
        })

        it('Emits a "ProjectWithdrawn" event after a withdrawal is made by the creator', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })

          // Act
          const receipt = await project
            .connect(creator)
            .withdraw(FUNDING_GOAL)
            .then((tx) => tx.wait())

          // Assert
          const event = receipt.events!.filter((e) => e.event === 'ProjectWithdrawn')
          expect(event).to.have.length(1)
        })

        it('Prevents contributors from withdrawing any funds', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })

          // Act
          const promise = project.connect(alice).withdraw(FUNDING_GOAL)

          // Assert
          await expect(promise).to.be.revertedWithCustomError(project, 'Unauthorized')
        })

        it('Prevents non-contributors from withdrawing any funds', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })

          // Act
          const promise = project.connect(bert).withdraw(FUNDING_GOAL)

          // Assert
          await expect(promise).to.be.revertedWithCustomError(project, 'Unauthorized')
        })

        it('ADDED - funded projects should not go back to "active" after withdrawals', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })

          // Act
          await project.connect(creator).withdraw(ethers.utils.parseEther('0.5'))

          // Assert
          expect(await project.getCurrentStatus()).to.equal(ProjectStatus.Funded)
          await project.connect(creator).withdraw(ethers.utils.parseEther('0.5')) // should not revert
        })

        it('ADDED - funded projects not be considered inactive if 30 days have passed after the goal is met', async () => {
          // Arrange
          await project.connect(alice).contribute({ value: FUNDING_GOAL })

          // Act
          await timeTravel(30 * 24 * 60 * 60 + 1) // 30 days + 1 second

          // Assert
          expect(await project.getCurrentStatus()).to.equal(ProjectStatus.Funded)
          await project.connect(creator).withdraw(ethers.utils.parseEther('0.5')) // should not revert
        })
      })

      // Note: The terms "withdraw" and "refund" are distinct from one another.
      // Withdrawal = Creator extracts all funds raised from the contract.
      // Refund = Contributors extract the funds they personally contributed.
      describe('Project Status: Failure', () => {
        beforeEach(async () => {
          await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') })
          await project.connect(creator).cancel()
        })

        it('Prevents the creator from withdrawing any funds raised', async () => {
          // Act
          const promise = project.connect(creator).withdraw(ethers.utils.parseEther('1'))

          // Assert
          await expect(promise)
            .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
            .withArgs(ProjectStatus.Funded, ProjectStatus.Failed)
        })

        it('Prevents contributors from withdrawing any funds raised', async () => {
          // Act
          const promise = project.connect(alice).withdraw(ethers.utils.parseEther('1'))

          // Assert
          await expect(promise).to.be.revertedWithCustomError(project, 'Unauthorized')
        })

        it('Prevents non-contributors from withdrawing any funds', async () => {
          // Act
          const promise = project.connect(bert).withdraw(ethers.utils.parseEther('1'))

          // Assert
          await expect(promise).to.be.revertedWithCustomError(project, 'Unauthorized')
        })
      })
    })

    describe('Refunds', () => {
      it('Allows contributors to be refunded when a project fails', async () => {
        // Arrange
        const originalContribution = ethers.utils.parseEther('1')
        const aliceBalanceBefore = await ethers.provider.getBalance(alice.address)
        const contributionReceipt = await project
          .connect(alice)
          .contribute({ value: originalContribution })
          .then((tx) => tx.wait())
        await project.connect(creator).cancel()

        // Act
        const refundReceipt = await project
          .connect(alice)
          .refund()
          .then((tx) => tx.wait())

        // Assert
        const aliceBalanceAfter = await ethers.provider.getBalance(alice.address)
        const totalGasCosts = [
          refundReceipt.gasUsed.mul(refundReceipt.effectiveGasPrice),
          contributionReceipt.gasUsed.mul(contributionReceipt.effectiveGasPrice),
        ].reduce((a, b) => a.add(b))

        // Balance will the same as before, minus the gas costs from the refund and the contribution transactions.
        expect(aliceBalanceAfter).to.equal(aliceBalanceBefore.sub(totalGasCosts))
      })

      it('Prevents contributors from being refunded if a project has not failed', async () => {
        // Arrange
        await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') })

        // Act
        const promise = project.connect(alice).refund()

        // Assert
        await expect(promise)
          .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
          .withArgs(ProjectStatus.Failed, ProjectStatus.Active)
      })

      it('Emits a "RefundIssued" event after a a contributor receives a refund', async () => {
        // Arrange
        const aliceContribution = ethers.utils.parseEther('1')
        await project.connect(alice).contribute({ value: aliceContribution })
        await project.connect(creator).cancel()

        // Act
        const receipt = await project
          .connect(alice)
          .refund()
          .then((tx) => tx.wait())

        // Assert
        const event = receipt.events!.filter((e) => e.event === 'RefundIssued')
        expect(event).to.have.length(1)

        expect(event[0].args![0]).to.equal(alice.address)
        expect(event[0].args![1]).to.equal(aliceContribution)
      })

      it('ADDED - Prevents refund to be issued if contribution balance is 0', async () => {
        // Arrange
        await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') })
        await project.connect(creator).cancel()

        // Act
        const promise = project.connect(bob).refund()

        // Assert
        await expect(promise).to.be.revertedWithCustomError(project, 'InsuficientBalance')
      })

      it('ADDED - Allows multiple contributors to be refunded when a project fails', async () => {
        // Arrange
        const aliceContribution = ethers.utils.parseEther('1')
        const bobContribution = ethers.utils.parseEther('2')
        const aliceBalanceBefore = await ethers.provider.getBalance(alice.address)
        const bobBalanceBefore = await ethers.provider.getBalance(bob.address)

        const aliceContributionReceipt = await project
          .connect(alice)
          .contribute({ value: aliceContribution })
          .then((tx) => tx.wait())
        const bobContributionReceipt = await project
          .connect(bob)
          .contribute({ value: bobContribution })
          .then((tx) => tx.wait())

        await project.connect(creator).cancel()

        // Act
        const aliceRefundReceipt = await project
          .connect(alice)
          .refund()
          .then((tx) => tx.wait())

        const bobRefundReceipt = await project
          .connect(bob)
          .refund()
          .then((tx) => tx.wait())

        // Assert
        const aliceBalanceAfter = await ethers.provider.getBalance(alice.address)
        const bobBalanceAfter = await ethers.provider.getBalance(bob.address)

        const aliceTotalGasCosts = [
          aliceRefundReceipt.gasUsed.mul(aliceRefundReceipt.effectiveGasPrice),
          aliceContributionReceipt.gasUsed.mul(aliceContributionReceipt.effectiveGasPrice),
        ].reduce((a, b) => a.add(b))

        const bobTotalGasCosts = [
          bobRefundReceipt.gasUsed.mul(bobRefundReceipt.effectiveGasPrice),
          bobContributionReceipt.gasUsed.mul(bobContributionReceipt.effectiveGasPrice),
        ].reduce((a, b) => a.add(b))

        // Balance will the same as before, minus the gas costs from the refund and the contribution transactions.
        expect(aliceBalanceAfter).to.equal(aliceBalanceBefore.sub(aliceTotalGasCosts))
        expect(bobBalanceAfter).to.equal(bobBalanceBefore.sub(bobTotalGasCosts))
      })
    })

    describe('Cancelations (creator-triggered project failures)', () => {
      it('Allows the creator to cancel the project if < 30 days since deployment has passed', async () => {
        // Act
        await project.connect(creator).cancel()

        // Assert
        expect(await project.getCurrentStatus()).to.equal(ProjectStatus.Failed)
      })

      it('Prevents the creator from canceling the project if at least 30 days have passed', async () => {
        // Arrange
        await timeTravel(30 * 24 * 60 * 60 + 1) // 30 days and 1 second later

        // Act
        const promise = project.connect(creator).cancel()

        // Assert
        await expect(promise)
          .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
          .withArgs(ProjectStatus.Active, ProjectStatus.Failed)
      })

      it("Prevents the creator from canceling the project if it has already reached it's funding goal", async () => {
        // Arrange
        await project.connect(alice).contribute({ value: FUNDING_GOAL })

        // Act
        const promise = project.connect(creator).cancel()

        // Assert
        await expect(promise)
          .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
          .withArgs(ProjectStatus.Active, ProjectStatus.Funded)
      })

      it('Prevents the creator from canceling the project if it has already been canceled', async () => {
        // Arrange
        await project.connect(creator).cancel()

        // Act
        const promise = project.connect(creator).cancel()

        // Assert
        await expect(promise)
          .to.be.revertedWithCustomError(project, 'NotAllowedOnStatus')
          .withArgs(ProjectStatus.Active, ProjectStatus.Failed)
      })

      it('Prevents non-creators from canceling the project', async () => {
        // Act
        const promise = project.connect(alice).cancel()

        // Assert
        await expect(promise).to.be.revertedWithCustomError(project, 'Unauthorized')
      })

      it('Emits a "ProjectCanceled" event after a project is canceled by the creator', async () => {
        // Act
        const receipt = await project
          .connect(creator)
          .cancel()
          .then((tx) => tx.wait())

        // Assert
        const event = receipt.events!.filter((e) => e.event === 'ProjectCanceled')
        expect(event.length).to.equal(1)
      })
    })

    describe('NFT Contributor Badges', () => {
      it('Awards a contributor with a badge when they make a single contribution of at least 1 ETH', async () => {
        // Arrange
        const aliceProject = project.connect(alice)
        await aliceProject.contribute({ value: ethers.utils.parseEther('1') })

        // Act
        await aliceProject.claimBadges()

        // Assert
        const badgesOwned = await aliceProject.balanceOf(alice.address)
        expect(badgesOwned).to.equal(1)
        expect(await aliceProject.ownerOf(0)).to.equal(alice.address)
      })

      it('Awards a contributor with a badge when they make multiple contributions to a single project that sum to at least 1 ETH', async () => {
        // Arrange
        const aliceProject = project.connect(alice)
        await aliceProject.contribute({ value: ethers.utils.parseEther('0.5') })
        await aliceProject.contribute({ value: ethers.utils.parseEther('0.5') })

        // Act
        await aliceProject.claimBadges()

        // Assert
        const badgesOwned = await aliceProject.balanceOf(alice.address)
        expect(badgesOwned).to.equal(1)
        expect(await aliceProject.ownerOf(0)).to.equal(alice.address)
      })

      it('Does not award a contributor with a badge if their total contribution to a single project sums to < 1 ETH', async () => {
        // Arrange
        const aliceProject = project.connect(alice)
        await aliceProject.contribute({ value: ethers.utils.parseEther('0.3') })
        await aliceProject.contribute({ value: ethers.utils.parseEther('0.3') })
        await aliceProject.contribute({ value: ethers.utils.parseEther('0.3') })

        // Act
        const promise = aliceProject.claimBadges()

        // Assert
        await expect(promise).to.be.revertedWithCustomError(project, 'NoBadgesToClaim')
        const badgesOwned = await aliceProject.balanceOf(alice.address)
        expect(badgesOwned).to.equal(0)
      })

      it('Awards a contributor with a second badge when their total contribution to a single project sums to at least 2 ETH', async () => {
        // Arrange
        const aliceProject = project.connect(alice)
        await aliceProject.contribute({ value: ethers.utils.parseEther('1') })
        await aliceProject.contribute({ value: ethers.utils.parseEther('1.5') })

        // Act
        await aliceProject.claimBadges()

        // Assert
        const badgesOwned = await aliceProject.balanceOf(alice.address)
        expect(badgesOwned).to.equal(2)
        expect(await aliceProject.ownerOf(0)).to.equal(alice.address)
        expect(await aliceProject.ownerOf(1)).to.equal(alice.address)
      })

      it('Does not award a contributor with a second badge if their total contribution to a single project is > 1 ETH but < 2 ETH', async () => {
        // Arrange
        const aliceProject = project.connect(alice)
        await aliceProject.contribute({ value: ethers.utils.parseEther('1.5') })

        // Act
        await aliceProject.claimBadges()

        // Assert
        const badgesOwned = await aliceProject.balanceOf(alice.address)
        expect(badgesOwned).to.equal(1)
        expect(await aliceProject.ownerOf(0)).to.equal(alice.address)
      })

      it('Awards contributors with different NFTs for contributions to different projects', async () => {
        // Arrange
        const txReceipt = await projectFactory
          .connect(creator)
          .create(FUNDING_GOAL)
          .then((tx) => tx.wait())

        const newProjectAddress = txReceipt.events![0].args![0]
        const newProject = (await ethers.getContractAt('Project', newProjectAddress)) as Project

        // Act
        await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') })
        await newProject.connect(alice).contribute({ value: ethers.utils.parseEther('3') })

        await project.connect(alice).claimBadges()
        await newProject.connect(alice).claimBadges()

        // Assert
        const proj1BadgesOwned = await project.balanceOf(alice.address)
        const proj2BadgesOwned = await newProject.balanceOf(alice.address)
        expect(proj1BadgesOwned).to.equal(1)
        expect(proj2BadgesOwned).to.equal(3)
      })

      it('Allows contributor badge holders to transfer the NFT to another address', async () => {
        // Arrange
        await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') })
        await project.connect(alice).claimBadges()

        // Act
        await project.connect(alice).transferFrom(alice.address, bob.address, 0)

        // Assert
        const bobBadges = await project.balanceOf(bob.address)
        expect(bobBadges).to.equal(1)
        expect(await project.ownerOf(0)).to.equal(bob.address)

        const aliceBadges = await project.balanceOf(alice.address)
        expect(aliceBadges).to.equal(0)
      })

      it('Allows contributor badge holders to transfer the NFT to another address even after its related project fails', async () => {
        // Arrange
        await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') })
        await project.connect(alice).claimBadges()
        await project.connect(creator).cancel()

        // Act
        await project.connect(alice).transferFrom(alice.address, bob.address, 0)

        // Assert
        const bobBadges = await project.balanceOf(bob.address)
        expect(bobBadges).to.equal(1)
        expect(await project.ownerOf(0)).to.equal(bob.address)

        const aliceBadges = await project.balanceOf(alice.address)
        expect(aliceBadges).to.equal(0)

        expect(await project.getCurrentStatus()).to.equal(ProjectStatus.Failed)
      })

      it('ADDED - Emits a single "Transfer" event after a contributor claims 1 badge', async () => {
        // Arrange
        const aliceProject = project.connect(alice)
        await aliceProject.contribute({ value: ethers.utils.parseEther('1') })

        // Act
        const receipt = await aliceProject.claimBadges().then((tx) => tx.wait())

        // Assert
        const event = receipt.events!.filter((e) => e.event === 'Transfer')
        expect(event.length).to.equal(1)

        const [from, to, tokenId] = event[0].args!
        expect(from).to.equal(ethers.constants.AddressZero)
        expect(to).to.equal(alice.address)
        expect(tokenId).to.equal(0)
      })

      it('ADDED - Refunds do not affect the amount of claimable badges', async () => {
        // Arrange
        const aliceProject = project.connect(alice)
        await aliceProject.contribute({ value: ethers.utils.parseEther('1') })
        await project.connect(creator).cancel()

        // Act
        await aliceProject.refund()
        await aliceProject.claimBadges()

        // Assert
        const badgesOwned = await aliceProject.balanceOf(alice.address)
        expect(badgesOwned).to.equal(1)
        expect(await aliceProject.ownerOf(0)).to.equal(alice.address)
      })

      it('ADDED - Withdrawals do not affect the amount of claimable badges', async () => {
        // Arrange
        const creatorProject = project.connect(creator)
        await creatorProject.contribute({ value: FUNDING_GOAL })

        // Act
        await creatorProject.withdraw(FUNDING_GOAL)
        await creatorProject.claimBadges()

        // Assert
        const badgesOwned = await creatorProject.balanceOf(creator.address)
        expect(badgesOwned).to.equal(10)
      })

      it('ADDED - Contributors can still claim badges on funded projects', async () => {
        // Arrange
        await project.connect(alice).contribute({ value: ethers.utils.parseEther('1') })
        await project.connect(bob).contribute({ value: ethers.utils.parseEther('1') })
        await project.connect(bert).contribute({ value: FUNDING_GOAL })

        // Act
        await project.connect(alice).claimBadges()
        await project.connect(bob).claimBadges()
        await project.connect(bert).claimBadges()

        // Assert
        expect(await project.balanceOf(alice.address)).to.equal(1)
        expect(await project.balanceOf(bob.address)).to.equal(1)
        expect(await project.balanceOf(bert.address)).to.equal(10)
      })

      it('ADDED - Multiple contributors can claim multiple badges', async () => {
        // Arrange
        await project.connect(alice).contribute({ value: ethers.utils.parseEther('2') })
        await project.connect(bob).contribute({ value: ethers.utils.parseEther('3') })

        // Act
        await project.connect(alice).claimBadges()
        await project.connect(bob).claimBadges()

        // Assert

        // 0 and 1 belong to Alice
        expect(await project.balanceOf(alice.address)).to.equal(2)
        expect(await project.ownerOf(0)).to.equal(alice.address)
        expect(await project.ownerOf(1)).to.equal(alice.address)

        // 2, 3, and 4 belong to Bob
        expect(await project.balanceOf(bob.address)).to.equal(3)
        expect(await project.ownerOf(2)).to.equal(bob.address)
        expect(await project.ownerOf(3)).to.equal(bob.address)
        expect(await project.ownerOf(4)).to.equal(bob.address)
      })

      it('ADDED - Contracts that do not implement ERC721TokenReceiver cannot receive a badge', async () => {
        // Arrange
        const ERC721IgnorantFactory = (await ethers.getContractFactory('ERC721Ignorant')) as ERC721Ignorant__factory
        const ignorantContract = (await ERC721IgnorantFactory.deploy()) as ERC721Ignorant
        await ignorantContract.deployed()
        await ignorantContract.contribute(project.address, { value: ethers.utils.parseEther('1') })

        // Act
        const promise = ignorantContract.claimBadges(project.address)

        // Assert
        await expect(promise).to.be.revertedWith('ERC721: transfer to non ERC721Receiver implementer')
      })

      it('ADDED - Contracts that do implement ERC721TokenReceiver can receive a badge', async () => {
        // Arrange
        const ERC721ReceiverFactory = (await ethers.getContractFactory('ERC721Receiver')) as ERC721Receiver__factory
        const receiverContract = (await ERC721ReceiverFactory.deploy()) as ERC721Receiver
        await receiverContract.deployed()
        await receiverContract.contribute(project.address, { value: ethers.utils.parseEther('1') })

        // Act
        await receiverContract.claimBadges(project.address)

        // Assert
        expect(await project.balanceOf(receiverContract.address)).to.equal(1)
        expect(await project.ownerOf(0)).to.equal(receiverContract.address)
      })
    })

    describe.only('ADDED - Attacks Resiliency', () => {
      it('ADDED - Should not allow reentracy attacks to overclaim NFTs', async () => {
        // Arrange
        const ERC721AttackerFactory = (await ethers.getContractFactory('ERC721Attacker')) as ERC721Attacker__factory
        const attackerContract = (await ERC721AttackerFactory.deploy(project.address)) as ERC721Attacker
        await attackerContract.deployed()
        await attackerContract.contribute({ value: ethers.utils.parseEther('2') })

        // Act
        const promise = attackerContract.attack()

        // Assert
        await expect(promise).to.be.revertedWithCustomError(project, 'NoBadgesToClaim')
        expect(await project.balanceOf(attackerContract.address)).to.equal(0)
      })

      it('ADDED - Should not allow reentry attacks to overclaim refunds', async () => {
        // Arrange
        const RefundAttackerFactory = (await ethers.getContractFactory('RefundAttacker')) as RefundAttacker__factory
        const attackerContract = (await RefundAttackerFactory.deploy(project.address)) as RefundAttacker
        await attackerContract.deployed()

        // Attacker has a balance of 1 ETH and should only be able to get refunded for 1 ETH
        attackerContract.contribute({ value: ethers.utils.parseEther('1') })

        // Added more funds to allow the attacker to make more funds available to be claimed via a possible
        // reentrancy attack
        await project.connect(alice).contribute({ value: ethers.utils.parseEther('5') })

        await project.connect(creator).cancel()

        // Act
        const promise = attackerContract.attack()

        // Assert
        await expect(promise).to.be.reverted
      })
    })
  })
})
