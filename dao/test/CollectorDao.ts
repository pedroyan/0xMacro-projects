import { ethers } from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import {
  buildBuyNftProposal,
  BuyNftProposalArgs,
  computeProposalId,
  timeTravel,
  createEip712Vote,
  mergeProposals,
} from './helpers'

const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7
const ONE_HOUR_IN_SECONDS = 60 * 60

type CreateBuyNftProposalArgs = Pick<BuyNftProposalArgs, 'nftId' | 'price' | 'description'>

describe('CollectorDao', () => {
  async function deployCollectorDaoFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice, bob, charles, member1, member2, ...others] = await ethers.getSigners()

    const CollectorDao = await ethers.getContractFactory('CollectorDao')
    const collectorDao = await CollectorDao.deploy()

    const NftMarketplace = await ethers.getContractFactory('MockNftMarketplace')
    const nftMarketplace = await NftMarketplace.deploy()

    const createBuyNftProposal = ({ nftId, price, description }: CreateBuyNftProposalArgs) => {
      const toReturn = buildBuyNftProposal({
        daoContract: collectorDao,
        marketplaceAddress: nftMarketplace.address,
        nftContract: nftMarketplace.address,
        nftId,
        description,
        price,
      })

      const proposalId = computeProposalId(toReturn.callPayload)
      return { ...toReturn, proposalId }
    }

    return { collectorDao, nftMarketplace, owner, alice, bob, charles, others, member1, member2, createBuyNftProposal }
  }

  async function setupProposalFixture() {
    const toReturn = await deployCollectorDaoFixture()

    const { collectorDao, alice, bob, createBuyNftProposal, member1, member2 } = toReturn
    await collectorDao.connect(alice).purchaseMembership({
      value: ethers.utils.parseEther('1'),
    })

    await collectorDao.connect(bob).purchaseMembership({
      value: ethers.utils.parseEther('1'),
    })

    await collectorDao.connect(member1).purchaseMembership({
      value: ethers.utils.parseEther('1'),
    })

    await collectorDao.connect(member2).purchaseMembership({
      value: ethers.utils.parseEther('1'),
    })

    const buyNftProposal = createBuyNftProposal({
      nftId: 0,
      description: 'Buy NFT #0',
      price: ethers.utils.parseEther('0.1'),
    })
    await collectorDao.connect(alice).propose(...buyNftProposal.proposalPayload)

    return { ...toReturn, buyNftProposal }
  }

  describe('Membership purchase', async () => {
    it('should allow a user to purchase a membership', async () => {
      // Arrange
      const { collectorDao, alice } = await loadFixture(deployCollectorDaoFixture)

      // Act
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Assert
      const membership = await collectorDao.members(alice.address)
      expect(membership.joinedAtProposalNumber).to.equal(0)
      expect(membership.votingPower).to.equal(1)
      expect(await collectorDao.memberCount()).to.equal(1)
    })

    it('should reject purchases with values different than ETH', async () => {
      // Arrange
      const { collectorDao, alice } = await loadFixture(deployCollectorDaoFixture)

      // Act
      const promiseUnder = collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('0.5'),
      })
      const promiseOver = collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1.5'),
      })

      // Assert
      await expect(promiseUnder).to.be.revertedWithCustomError(collectorDao, 'InvalidMembershipPurchase')
      await expect(promiseOver).to.be.revertedWithCustomError(collectorDao, 'InvalidMembershipPurchase')
      expect(await collectorDao.memberCount()).to.equal(0)
    })

    it('should reject purchases from users that already have a membership', async () => {
      // Arrange
      const { collectorDao, alice } = await loadFixture(deployCollectorDaoFixture)

      // Act
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })
      const promise = collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'AlreadyAMember').withArgs(alice.address)
    })
  })

  describe('Propose', async () => {
    it('should allow creating a proposal', async () => {
      // Arrange
      const { collectorDao, alice, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Act
      const { proposalPayload, callPayload } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      await collectorDao.connect(alice).propose(...proposalPayload)

      // Assert
      const proposal = await collectorDao.proposals(computeProposalId(callPayload))

      expect(proposal.proposer).to.equal(alice.address)

      const expectedTimestamp = Math.floor(Date.now() / 1000) + SEVEN_DAYS_IN_SECONDS
      expect(proposal.voteEndTimestamp).to.be.closeTo(expectedTimestamp, ONE_HOUR_IN_SECONDS)
      expect(proposal.executed).to.be.false
      expect(proposal.proposalNumber).to.equal(1)
      expect(proposal.quorum).to.equal(1)
      expect(proposal.yesVotes).to.equal(0)
      expect(proposal.noVotes).to.equal(0)
      expect(proposal.totalMemberVotes).to.equal(0)
    })

    it('should allow creating multiple identical proposals', async () => {
      // Arrange
      const { collectorDao, alice, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Act
      const { proposalPayload: pp1, callPayload: cp1 } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      const { proposalPayload: pp2, callPayload: cp2 } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #1',
        price: ethers.utils.parseEther('0.1'),
      })
      await collectorDao.connect(alice).propose(...pp1)
      await collectorDao.connect(alice).propose(...pp2)

      // Assert
      const proposal1 = await collectorDao.proposals(computeProposalId(cp1))
      expect(proposal1.proposalNumber).to.equal(1)

      const proposal2 = await collectorDao.proposals(computeProposalId(cp2))
      expect(proposal2.proposalNumber).to.equal(2)

      expect(await collectorDao.latestProposalNumber()).to.equal(2)
    })

    it('should reject proposals created by non-members', async () => {
      // Arrange
      const { collectorDao, alice, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)

      // Act
      const { proposalPayload } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      const promise = collectorDao.connect(alice).propose(...proposalPayload)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'NotAMember').withArgs(alice.address)
    })

    it('should reject empty proposals', async () => {
      // Arrange
      const { collectorDao, alice } = await loadFixture(deployCollectorDaoFixture)
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Act
      const promise = collectorDao.connect(alice).propose([], [], [], 'derp')

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'EmptyProposal')
    })

    it('should reject proposals with mistmatched arguments (values)', async () => {
      // Arrange
      const { collectorDao, alice, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Act
      const { proposalPayload } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      proposalPayload[1].push(1234) // Add a random argument to one of the proposal arrays, mistmatching their sizes
      const promise = collectorDao.connect(alice).propose(...proposalPayload)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'MismatchedProposalArgs')
    })

    it('should reject proposals with mistmatched arguments (calldatas)', async () => {
      // Arrange
      const { collectorDao, alice, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Act
      const { proposalPayload } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      proposalPayload[2].push('0x1234') // Add a random argument to one of the proposal arrays, mistmatching their sizes
      const promise = collectorDao.connect(alice).propose(...proposalPayload)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'MismatchedProposalArgs')
    })

    it('should reject duplicate proposals', async () => {
      // Arrange
      const { collectorDao, alice, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Act
      const { proposalPayload, callPayload } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      await collectorDao.connect(alice).propose(...proposalPayload)
      const promise = collectorDao.connect(alice).propose(...proposalPayload)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'DuplicateProposal')
        .withArgs(computeProposalId(callPayload))
    })

    it('should emit a ProposalCreated event', async () => {
      // Arrange
      const { collectorDao, alice, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)
      await collectorDao.connect(alice).purchaseMembership({
        value: ethers.utils.parseEther('1'),
      })

      // Act
      const { proposalPayload, callPayload } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      const tx = await collectorDao.connect(alice).propose(...proposalPayload)

      const receipt = await tx.wait()

      // Assert
      await expect(tx)
        .to.emit(collectorDao, 'ProposalCreated')
        .withArgs(
          alice.address,
          computeProposalId(callPayload),
          1,
          proposalPayload[0],
          proposalPayload[1],
          proposalPayload[2],
          proposalPayload[3],
          (await ethers.provider.getBlock(receipt.blockNumber)).timestamp + SEVEN_DAYS_IN_SECONDS,
          1,
        )
    })

    it('should correctly set quorum for proposal', async () => {
      // Arrange
      const { collectorDao, alice, others, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)
      const promiseArray: Promise<unknown>[] = []
      promiseArray.push(collectorDao.connect(alice).purchaseMembership({ value: ethers.utils.parseEther('1') }))
      for (let i = 0; i < 10; i++) {
        promiseArray.push(collectorDao.connect(others[i]).purchaseMembership({ value: ethers.utils.parseEther('1') }))
      }
      await Promise.all(promiseArray)

      // Act
      const { proposalPayload, callPayload } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      await collectorDao.connect(alice).propose(...proposalPayload)

      // Assert
      const proposal = await collectorDao.proposals(computeProposalId(callPayload))
      expect(proposal.quorum).to.equal(3)
    })

    it('should set quorum based on the amount of members at the time of the proposal creation', async () => {
      // Arrange
      const { collectorDao, alice, others, createBuyNftProposal } = await loadFixture(deployCollectorDaoFixture)
      await collectorDao.connect(alice).purchaseMembership({ value: ethers.utils.parseEther('1') })

      // Act
      const { proposalPayload: pp1, callPayload: cp1 } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0',
        price: ethers.utils.parseEther('0.1'),
      })
      await collectorDao.connect(alice).propose(...pp1)
      const proposal1Id = computeProposalId(cp1)

      const promiseArray: Promise<unknown>[] = []
      for (let i = 0; i < 11; i++) {
        promiseArray.push(collectorDao.connect(others[i]).purchaseMembership({ value: ethers.utils.parseEther('1') }))
      }
      await Promise.all(promiseArray)

      const { proposalPayload: pp2, callPayload: cp2 } = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #1',
        price: ethers.utils.parseEther('0.1'),
      })
      await collectorDao.connect(alice).propose(...pp2)
      const proposal2Id = computeProposalId(cp2)

      // Assert
      const proposal1 = await collectorDao.proposals(proposal1Id)
      expect(proposal1.quorum).to.equal(1)

      const proposal2 = await collectorDao.proposals(proposal2Id)
      expect(proposal2.quorum).to.equal(3)
    })
  })

  describe('Vote', async () => {
    it('should allow member to vote yes on a proposal', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob } = await loadFixture(setupProposalFixture)

      // Act
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)

      // Assert
      const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
      expect(proposal.yesVotes).to.equal(1)
      expect(proposal.noVotes).to.equal(0)
      expect(proposal.totalMemberVotes).to.equal(1)
    })

    it('should allow member to vote no on a proposal', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob } = await loadFixture(setupProposalFixture)

      // Act
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, false)

      // Assert
      const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
      expect(proposal.yesVotes).to.equal(0)
      expect(proposal.noVotes).to.equal(1)
      expect(proposal.totalMemberVotes).to.equal(1)
    })

    it('should allow members to vote on their own proposal', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, alice } = await loadFixture(setupProposalFixture)

      // Act
      await collectorDao.connect(alice).castVote(buyNftProposal.proposalId, false)

      // Assert
      const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
      expect(proposal.yesVotes).to.equal(0)
      expect(proposal.noVotes).to.equal(1)
      expect(proposal.totalMemberVotes).to.equal(1)
    })

    it('should allow members to vote on multiple ongoing proposals', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob, createBuyNftProposal } = await loadFixture(setupProposalFixture)
      const { proposalPayload, callPayload } = createBuyNftProposal({
        nftId: 1,
        description: 'Buy NFT #1',
        price: ethers.utils.parseEther('0.1'),
      })
      await collectorDao.connect(bob).propose(...proposalPayload)
      const proposalId2 = computeProposalId(callPayload)

      // Act
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
      await collectorDao.connect(bob).castVote(proposalId2, false)

      // Assert
      const proposal1 = await collectorDao.proposals(buyNftProposal.proposalId)
      expect(proposal1.yesVotes).to.equal(1)
      expect(proposal1.noVotes).to.equal(0)
      expect(proposal1.totalMemberVotes).to.equal(1)

      const proposal2 = await collectorDao.proposals(proposalId2)
      expect(proposal2.yesVotes).to.equal(0)
      expect(proposal2.noVotes).to.equal(1)
      expect(proposal2.totalMemberVotes).to.equal(1)
    })

    it('should prevent a member from voting twice on the same proposal', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob } = await loadFixture(setupProposalFixture)
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)

      // Act
      const promise = collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'VoteAlreadyCast')
        .withArgs(bob.address, buyNftProposal.proposalId)
    })

    it('should prevent a non-member from voting', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, charles } = await loadFixture(setupProposalFixture)

      // Act
      const promise = collectorDao.connect(charles).castVote(buyNftProposal.proposalId, true)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'NotAMember')
    })

    it('should prevent members from changing their votes', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob } = await loadFixture(setupProposalFixture)
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)

      // Act
      const promise = collectorDao.connect(bob).castVote(buyNftProposal.proposalId, false)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'VoteAlreadyCast')
        .withArgs(bob.address, buyNftProposal.proposalId)
    })

    it('should prevent members that joined after the proposal was created from voting', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, charles } = await loadFixture(setupProposalFixture)
      await collectorDao.connect(charles).purchaseMembership({ value: ethers.utils.parseEther('1') })

      // Act
      const promise = collectorDao.connect(charles).castVote(buyNftProposal.proposalId, true)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'JoinedAfterProposal')
        .withArgs(charles.address, buyNftProposal.proposalId)
    })

    it('should prevent members that joined after the proposal was created from voting, even if they joined in the same block as the proposal', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, charles, alice, createBuyNftProposal } = await loadFixture(
        setupProposalFixture,
      )

      // Act
      await ethers.provider.send('evm_setAutomine', [false])

      const { proposalId, proposalPayload } = createBuyNftProposal({
        nftId: 1,
        description: 'Buy NFT #1',
        price: ethers.utils.parseEther('0.1'),
      })
      await collectorDao.connect(alice).propose(...proposalPayload)
      await collectorDao.connect(charles).purchaseMembership({ value: ethers.utils.parseEther('1') })
      await ethers.provider.send('evm_setAutomine', [true])
      console.log('Automine on')
      const votePromise = collectorDao.connect(charles).castVote(proposalId, true)

      // Assert
      await expect(votePromise)
        .revertedWithCustomError(collectorDao, 'JoinedAfterProposal')
        .withArgs(charles.address, proposalId)
    })

    it('should reject votes on non-existent proposals', async () => {
      // Arrange
      const { collectorDao, bob } = await loadFixture(setupProposalFixture)

      // Act
      const promise = collectorDao.connect(bob).castVote(1, true)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'ProposalDoesNotExist').withArgs(1)
    })

    it('should reject votes after the 7 days voting period has ended', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob } = await loadFixture(setupProposalFixture)
      await timeTravel(7 * 24 * 60 * 60 + 1)

      // Act
      const promise = collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'VotingPeriodEnded')
    })

    it('should emit a "VoteCast" event', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob } = await loadFixture(setupProposalFixture)

      // Act
      const tx = await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)

      // Assert
      await expect(tx).to.emit(collectorDao, 'VoteCast').withArgs(bob.address, buyNftProposal.proposalId, true, 1)
    })

    describe('EIP-712 Votes', () => {
      it('should allow member to vote yes on a proposal using EIP-712 signatures', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: true, dao: collectorDao })
        await collectorDao.connect(alice).castEip712Vote(vote)

        // Assert
        const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
        expect(proposal.yesVotes).to.equal(1)
        expect(proposal.noVotes).to.equal(0)
        expect(proposal.totalMemberVotes).to.equal(1)
      })

      it('should allow member to vote no on a proposal using EIP-712 signatures', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: false, dao: collectorDao })
        await collectorDao.connect(alice).castEip712Vote(vote)

        // Assert
        const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
        expect(proposal.yesVotes).to.equal(0)
        expect(proposal.noVotes).to.equal(1)
        expect(proposal.totalMemberVotes).to.equal(1)
      })

      it('should emit a "VoteCast" event', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: true, dao: collectorDao })
        const tx = await collectorDao.connect(alice).castEip712Vote(vote)

        // Assert
        await expect(tx).to.emit(collectorDao, 'VoteCast').withArgs(bob.address, buyNftProposal.proposalId, true, 1)
      })

      it('should allow non-members to cast votes on behalf of members', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, charles } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: true, dao: collectorDao })
        await collectorDao.connect(charles).castEip712Vote(vote)

        // Assert
        const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
        expect(proposal.yesVotes).to.equal(1)
        expect(proposal.noVotes).to.equal(0)
        expect(proposal.totalMemberVotes).to.equal(1)
      })

      it('should reject votes being re-cast on a replay attack', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: true, dao: collectorDao })
        await collectorDao.connect(alice).castEip712Vote(vote)
        const promise = collectorDao.connect(alice).castEip712Vote(vote)

        // Assert
        await expect(promise)
          .to.be.revertedWithCustomError(collectorDao, 'VoteAlreadyCast')
          .withArgs(bob.address, buyNftProposal.proposalId)
      })

      it('should reject votes being cast directly if already cast via EIP-712', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: true, dao: collectorDao })
        await collectorDao.connect(alice).castEip712Vote(vote)
        const promise = collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)

        // Assert
        await expect(promise)
          .to.be.revertedWithCustomError(collectorDao, 'VoteAlreadyCast')
          .withArgs(bob.address, buyNftProposal.proposalId)
      })

      it('should reject votes from a wallet claiming to be another address', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({
          proposalId,
          signer: bob,
          support: true,
          dao: collectorDao,
          fakeAddress: alice.address,
        })
        const promise = collectorDao.connect(alice).castEip712Vote(vote)

        // Assert
        await expect(promise).to.be.revertedWithCustomError(collectorDao, 'InvalidSignature')
      })

      it('should reject votes from an invalid signature', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({
          proposalId,
          signer: bob,
          support: true,
          dao: collectorDao,
        })
        vote.v = 91
        const promise = collectorDao.connect(alice).castEip712Vote(vote)

        // Assert
        await expect(promise).to.be.revertedWithCustomError(collectorDao, 'InvalidSignature')
      })
    })

    describe('Bulk EIP-712 Votes', async () => {
      it('should allow bulk submission of EIP-712 votes to the same proposal', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice, charles } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: true, dao: collectorDao })
        const vote2 = await createEip712Vote({ proposalId, signer: alice, support: false, dao: collectorDao })
        await collectorDao.connect(charles).castEip712Votes([vote, vote2])

        // Assert
        const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
        expect(proposal.yesVotes).to.equal(1)
        expect(proposal.noVotes).to.equal(1)
        expect(proposal.totalMemberVotes).to.equal(2)
      })

      it('should allow bulk submission of EIP-712 votes to different proposals', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice, createBuyNftProposal } = await loadFixture(
          setupProposalFixture,
        )
        const { proposalId: proposalId1 } = buyNftProposal
        const { proposalPayload, proposalId: proposalId2 } = createBuyNftProposal({
          nftId: 1,
          price: ethers.utils.parseEther('0.1'),
          description: 'Buy NFT 2',
        })
        await collectorDao.connect(bob).propose(...proposalPayload)

        // Act
        const vote = await createEip712Vote({ proposalId: proposalId1, signer: bob, support: true, dao: collectorDao })
        const vote2 = await createEip712Vote({
          proposalId: proposalId2,
          signer: bob,
          support: false,
          dao: collectorDao,
        })
        await collectorDao.connect(alice).castEip712Votes([vote, vote2])

        // Assert
        const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
        expect(proposal.yesVotes).to.equal(1)
        expect(proposal.noVotes).to.equal(0)
        expect(proposal.totalMemberVotes).to.equal(1)

        const proposal2 = await collectorDao.proposals(proposalId2)
        expect(proposal2.yesVotes).to.equal(0)
        expect(proposal2.noVotes).to.equal(1)
        expect(proposal2.totalMemberVotes).to.equal(1)
      })

      it('should emit multiple "VoteCast" events', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice, charles } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: true, dao: collectorDao })
        const vote2 = await createEip712Vote({ proposalId, signer: alice, support: false, dao: collectorDao })
        const tx = await collectorDao.connect(charles).castEip712Votes([vote, vote2])

        // Assert
        await expect(tx)
          .to.emit(collectorDao, 'VoteCast')
          .withArgs(bob.address, proposalId, true, 1)
          .and.to.emit(collectorDao, 'VoteCast')
          .withArgs(alice.address, proposalId, false, 1)
      })

      it('should revert all votes if one of the votes fails to validate', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, alice, charles } = await loadFixture(setupProposalFixture)
        const { proposalId } = buyNftProposal

        // Act
        const vote = await createEip712Vote({ proposalId, signer: bob, support: true, dao: collectorDao }) // valid
        const vote2 = await createEip712Vote({ proposalId, signer: alice, support: false, dao: collectorDao }) // valid
        const vote3 = await createEip712Vote({ proposalId, signer: charles, support: false, dao: collectorDao }) // invalid - charles is not a member
        const promise = collectorDao.connect(alice).castEip712Votes([vote, vote2, vote3])

        // Assert
        await expect(promise).to.be.revertedWithCustomError(collectorDao, 'NotAMember').withArgs(charles.address)
        const proposal = await collectorDao.proposals(buyNftProposal.proposalId)
        expect(proposal.yesVotes).to.equal(0)
        expect(proposal.noVotes).to.equal(0)
        expect(proposal.totalMemberVotes).to.equal(0)
      })
    })
  })

  describe('Execution', async () => {
    it('should be executable by anyone', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob, charles, nftMarketplace } = await loadFixture(setupProposalFixture)
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

      // Act
      const tx = await collectorDao.connect(charles).execute(...buyNftProposal.callPayload)

      // Assert
      await expect(tx).to.emit(collectorDao, 'ProposalExecuted').withArgs(buyNftProposal.proposalId, charles.address)
      expect(await nftMarketplace.ownerOf(0)).to.equal(collectorDao.address)
    })

    it('should allow executing a proposal with multiple calls', async () => {
      // Arrange
      const { collectorDao, createBuyNftProposal, bob, buyNftProposal, charles, nftMarketplace } = await loadFixture(
        setupProposalFixture,
      )
      const { callPayload, proposalPayload } = mergeProposals(
        [
          buyNftProposal,
          createBuyNftProposal({
            nftId: 1,
            description: 'Buy NFT #1',
            price: ethers.utils.parseEther('0.1'),
          }),
        ],
        'Multiple NFTs',
      )

      const proposalId = computeProposalId(callPayload)

      await collectorDao.connect(bob).propose(...proposalPayload)
      await collectorDao.connect(bob).castVote(proposalId, true)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

      // Act
      const tx = await collectorDao.connect(charles).execute(...callPayload)

      // Assert
      await expect(tx)
        .to.emit(collectorDao, 'ProposalExecuted')
        .withArgs(proposalId, charles.address)
        .and.to.emit(nftMarketplace, 'Transfer')
        .withArgs(nftMarketplace.address, collectorDao.address, 0)
        .and.to.emit(nftMarketplace, 'Transfer')
        .withArgs(nftMarketplace.address, collectorDao.address, 1)

      expect(await nftMarketplace.ownerOf(0)).to.equal(collectorDao.address)
      expect(await nftMarketplace.ownerOf(1)).to.equal(collectorDao.address)
    })

    it('should reject execution of non-existent proposals', async () => {
      // Arrange
      const { collectorDao, alice, createBuyNftProposal } = await loadFixture(setupProposalFixture)
      const proposal = createBuyNftProposal({
        nftId: 1,
        description: 'Buy NFT #1',
        price: ethers.utils.parseEther('0.1'),
      })

      // Act
      const promise = collectorDao.connect(alice).execute(...proposal.callPayload)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'ProposalDoesNotExist')
        .withArgs(proposal.proposalId)
    })

    it('should reject execution of proposals that have already been executed', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob, charles } = await loadFixture(setupProposalFixture)
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)
      await collectorDao.connect(charles).execute(...buyNftProposal.callPayload)

      // Act
      const promise = collectorDao.connect(charles).execute(...buyNftProposal.callPayload)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'ProposalAlreadyExecuted')
        .withArgs(buyNftProposal.proposalId)
    })

    it('should reject execution of proposals that are still in the voting period', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob } = await loadFixture(setupProposalFixture)
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)

      // Act
      const promise = collectorDao.connect(bob).execute(...buyNftProposal.callPayload)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'VotingPeriodStillActive')
        .withArgs(buyNftProposal.proposalId)
    })

    it('should reject execution of proposals that have not reached quorum', async () => {
      // Arrange
      const { collectorDao, bob, alice, others, createBuyNftProposal } = await loadFixture(setupProposalFixture) // 4 memberships created here
      const promises: Promise<unknown>[] = []
      for (let i = 0; i < 11; i++) {
        promises.push(collectorDao.connect(others[i]).purchaseMembership({ value: ethers.utils.parseEther('1') }))
      }
      await Promise.all(promises) // 11 memberships created here, total 15
      const buyNftNewProposal = createBuyNftProposal({
        nftId: 0,
        description: 'Buy NFT #0 - New Proposal',
        price: ethers.utils.parseEther('0.1'),
      })

      await collectorDao.connect(bob).propose(...buyNftNewProposal.proposalPayload)
      await collectorDao.connect(bob).castVote(buyNftNewProposal.proposalId, true)
      await collectorDao.connect(alice).castVote(buyNftNewProposal.proposalId, true)
      await collectorDao.connect(others[0]).castVote(buyNftNewProposal.proposalId, true)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

      // Act
      const promise = collectorDao.connect(bob).execute(...buyNftNewProposal.callPayload)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'QuorumNotReached')
        .withArgs(buyNftNewProposal.proposalId, 4, 3)
    })

    it('should reject execution of proposals that have not reached majority (No majority)', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, alice, member1, member2, bob, charles } = await loadFixture(
        setupProposalFixture,
      )
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
      await collectorDao.connect(alice).castVote(buyNftProposal.proposalId, false)
      await collectorDao.connect(member1).castVote(buyNftProposal.proposalId, false)
      await collectorDao.connect(member2).castVote(buyNftProposal.proposalId, false)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

      // Act
      const promise = collectorDao.connect(charles).execute(...buyNftProposal.callPayload)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'MajorityNotReached')
        .withArgs(buyNftProposal.proposalId, 1, 3)
    })

    it('should reject execution of proposals that have not reached majority (Draw)', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, alice, member1, member2, bob, charles } = await loadFixture(
        setupProposalFixture,
      )
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
      await collectorDao.connect(alice).castVote(buyNftProposal.proposalId, true)
      await collectorDao.connect(member1).castVote(buyNftProposal.proposalId, false)
      await collectorDao.connect(member2).castVote(buyNftProposal.proposalId, false)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

      // Act
      const promise = collectorDao.connect(charles).execute(...buyNftProposal.callPayload)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'MajorityNotReached')
        .withArgs(buyNftProposal.proposalId, 2, 2)
    })

    it('should revert execution of proposals where one of the calls fails', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob, charles, createBuyNftProposal } = await loadFixture(
        setupProposalFixture,
      )
      const { callPayload, proposalPayload } = mergeProposals(
        [
          buyNftProposal,
          createBuyNftProposal({
            nftId: 1,
            description: 'fail proposal',
            price: ethers.utils.parseEther('0.01'),
          }),
        ],
        'Merged Proposal',
      )
      const proposalId = computeProposalId(callPayload)
      await collectorDao.connect(bob).propose(...proposalPayload)
      await collectorDao.connect(bob).castVote(proposalId, true)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

      // Act
      const promise = collectorDao.connect(charles).execute(...callPayload)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(collectorDao, 'ProposalExecutionFailed')
        .withArgs(proposalId, 1)
    })

    it('should emit a "ProposalExecuted" event', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob, charles } = await loadFixture(setupProposalFixture)
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

      // Act
      const tx = await collectorDao.connect(charles).execute(...buyNftProposal.callPayload)

      // Assert
      await expect(tx).to.emit(collectorDao, 'ProposalExecuted').withArgs(buyNftProposal.proposalId, charles.address)
    })

    it('should reject direct invocations of the buyNFTFromMarketplace function', async () => {
      // Arrange
      const { buyNftProposal, collectorDao, bob, charles, nftMarketplace } = await loadFixture(setupProposalFixture)
      await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
      await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

      // Act
      const nftAddr = nftMarketplace.address
      const promise = collectorDao
        .connect(charles)
        .buyNFTFromMarketplace(nftAddr, nftAddr, 0, ethers.utils.parseEther('0.01'))

      // Assert
      await expect(promise).to.be.revertedWithCustomError(collectorDao, 'Unauthorized')
    })

    describe('Execution reward', () => {
      it('should provide execution reward of 0.01 ETH if proposal is successful and balance after execution is >= 5 ETH', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, charles } = await loadFixture(setupProposalFixture)
        await bob.sendTransaction({ to: collectorDao.address, value: ethers.utils.parseEther('5') })
        await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
        await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

        // Act
        const charlesBalanceBefore = await charles.getBalance()
        const receipt = await collectorDao
          .connect(charles)
          .execute(...buyNftProposal.callPayload)
          .then((tx) => tx.wait())
        const charlesBalanceAfter = await charles.getBalance()

        // Assert
        const gasCosts = receipt.gasUsed.mul(receipt.effectiveGasPrice)
        const ethReceivedForExecution = charlesBalanceAfter.sub(charlesBalanceBefore).add(gasCosts)
        expect(ethReceivedForExecution).to.equal(ethers.utils.parseEther('0.01'))
      })

      it('should not provide execution reward if proposal is successful and balance after execution is < 5 ETH', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, charles } = await loadFixture(setupProposalFixture)
        await bob.sendTransaction({ to: collectorDao.address, value: ethers.utils.parseEther('1') })
        const daoBalanceBefore = await ethers.provider.getBalance(collectorDao.address)
        await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
        await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

        // Act
        const charlesBalanceBefore = await charles.getBalance()
        const receipt = await collectorDao
          .connect(charles)
          .execute(...buyNftProposal.callPayload)
          .then((tx) => tx.wait())
        const charlesBalanceAfter = await charles.getBalance()

        // Assert
        expect(daoBalanceBefore).to.equal(ethers.utils.parseEther('5'))
        const gasCosts = receipt.gasUsed.mul(receipt.effectiveGasPrice)
        const ethReceivedForExecution = charlesBalanceAfter.sub(charlesBalanceBefore).add(gasCosts)
        expect(ethReceivedForExecution).to.equal(0)
      })

      it('should not provide execution reward if execution reverts', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, charles, createBuyNftProposal } = await loadFixture(
          setupProposalFixture,
        )
        const { callPayload, proposalPayload } = mergeProposals(
          [
            createBuyNftProposal({
              nftId: 1,
              description: 'fail proposal',
              price: ethers.utils.parseEther('0.01'),
            }),
            buyNftProposal,
          ],
          'Merged Proposal',
        )
        const proposalId = computeProposalId(callPayload)
        await collectorDao.connect(bob).propose(...proposalPayload)
        await collectorDao.connect(bob).castVote(proposalId, true)
        await bob.sendTransaction({ to: collectorDao.address, value: ethers.utils.parseEther('5') })
        await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

        // Act
        const charlesBalanceBefore = await charles.getBalance()
        const promise = collectorDao.connect(charles).execute(...callPayload)
        const charlesBalanceAfter = await charles.getBalance()

        // Assert
        await expect(promise)
          .to.be.revertedWithCustomError(collectorDao, 'ProposalExecutionFailed')
          .withArgs(proposalId, 0)

        const ethReceivedForExecution = charlesBalanceAfter.sub(charlesBalanceBefore)
        expect(ethReceivedForExecution).to.equal(0)
      })
    })

    describe('Voting power reward', () => {
      it('should increase voting power of the proposer of a successfully executed proposal by 1', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, charles, alice } = await loadFixture(setupProposalFixture)
        await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
        await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)

        // Act
        await collectorDao.connect(charles).execute(...buyNftProposal.callPayload)

        // Assert
        const member = await collectorDao.members(alice.address)
        expect(member.votingPower).to.equal(2)
      })

      it('should reflect increased voting power on subsequent proposal votes', async () => {
        // Arrange
        const { buyNftProposal, collectorDao, bob, charles, alice, createBuyNftProposal } = await loadFixture(
          setupProposalFixture,
        )
        await collectorDao.connect(bob).castVote(buyNftProposal.proposalId, true)
        await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)
        await collectorDao.connect(charles).execute(...buyNftProposal.callPayload) // Succesful execution raises alice voting power to 2

        const newProposal = createBuyNftProposal({
          nftId: 1,
          description: 'Buy NFT #1',
          price: ethers.utils.parseEther('0.1'),
        })
        const proposalId = computeProposalId(newProposal.callPayload)
        await collectorDao.connect(alice).propose(...newProposal.proposalPayload)

        // Act
        await collectorDao.connect(alice).castVote(proposalId, true) // Alice has 2 voting power, 2 yes votes
        await collectorDao.connect(bob).castVote(proposalId, false) // Bob has 1 voting power, 1 no votes
        await timeTravel(SEVEN_DAYS_IN_SECONDS + 1)
        const promise = collectorDao.connect(charles).execute(...newProposal.callPayload) // 2 yes, 1 no = Proposal passes

        await expect(promise).to.not.be.reverted
        const member = await collectorDao.members(alice.address)
        expect(member.votingPower).to.equal(3)
      })
    })
  })

  // Attacks
  //  should revert reentrant proposal executions
  //  should revert reentrant execution reward receiver
})
