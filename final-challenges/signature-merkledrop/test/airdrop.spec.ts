import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ClaimSigner } from './helpers/ClaimSigner'
import { generateMerkleTree } from './helpers/merkle-generator'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'

describe('Airdrop', function () {
  async function setupAirdropFixture() {
    const [deployer, alice, bob, charles, ...rest] = await ethers.getSigners()

    const MacroToken = await ethers.getContractFactory('MacroToken')
    const macroToken = await MacroToken.deploy('Macro Token', 'MACRO')
    await macroToken.deployed()

    const { root: merkleRoot, claims: merkleClaims } = generateMerkleTree([
      { address: alice.address, amount: ethers.utils.parseEther('100') },
      { address: bob.address, amount: ethers.utils.parseEther('200') },
      { address: charles.address, amount: ethers.utils.parseEther('300') },
      { address: rest[0].address, amount: ethers.utils.parseEther('400') },
    ])

    const airdrop = await (
      await ethers.getContractFactory('Airdrop')
    ).deploy(merkleRoot, deployer.address, macroToken.address)
    await airdrop.deployed()

    await macroToken.mint(airdrop.address, ethers.utils.parseEther('1000000'))

    const claimSigner = new ClaimSigner(deployer, airdrop)

    return { deployer, alice, bob, charles, rest, macroToken, airdrop, merkleRoot, claimSigner, merkleClaims }
  }

  describe('MacroToken Setup', () => {
    it('should reject non-owner attempts to mint new MacroToken', async () => {
      // Arrange
      const { alice, macroToken } = await loadFixture(setupAirdropFixture)

      // Act
      const promise = macroToken.connect(alice).mint(alice.address, ethers.utils.parseEther('100'))

      // Assert
      await expect(promise).to.be.revertedWith('ONLY_OWNER')
    })
  })

  describe('ECDSA Setup', () => {
    it('should allow owner to disable ECDSA Verification', async () => {
      // Arrange
      const { deployer, airdrop } = await loadFixture(setupAirdropFixture)

      // Act
      const tx = await airdrop.connect(deployer).disableECDSAVerification()

      // Assert
      await expect(tx).to.emit(airdrop, 'ECDSADisabled').withArgs(deployer.address)
      expect(await airdrop.isECDSADisabled()).to.be.true
    })

    it('should reject non-owners attempts to disable ECDSA Verification', async () => {
      // Arrange
      const { alice, airdrop } = await loadFixture(setupAirdropFixture)

      // Act
      const promise = airdrop.connect(alice).disableECDSAVerification()

      // Assert
      await expect(promise).to.be.revertedWith('Ownable: caller is not the owner')
      expect(await airdrop.isECDSADisabled()).to.be.false
    })
  })

  describe('Signature claiming', () => {
    it('should allow signature claiming for a valid signature and claimant', async () => {
      // Arrange
      const amount = ethers.utils.parseEther('100')
      const { alice, airdrop, claimSigner, macroToken } = await loadFixture(setupAirdropFixture)
      const signature = await claimSigner.signClaim(alice.address, amount)

      // Act
      const tx = await airdrop.connect(alice).signatureClaim(signature, alice.address)

      // Assert
      await expect(tx).to.emit(airdrop, 'AirdropClaimed').withArgs(alice.address, amount, alice.address)
      const aliceBalance = await macroToken.balanceOf(alice.address)
      expect(aliceBalance).to.equal(amount)
    })

    it('should reject signature claiming if the msg.sender is not the claimant', async () => {
      // Arrange
      const amount = ethers.utils.parseEther('100')
      const { alice, bob, airdrop, claimSigner } = await loadFixture(setupAirdropFixture)
      const signature = await claimSigner.signClaim(alice.address, amount)

      // Act
      const promise = airdrop.connect(bob).signatureClaim(signature, alice.address)

      // Assert
      await expect(promise)
        .to.be.revertedWithCustomError(airdrop, 'InvalidClaimant')
        .withArgs(alice.address, bob.address)
    })

    it('should reject signature claiming if ECDSA Verification is disabled', async () => {
      // Arrange
      const amount = ethers.utils.parseEther('100')
      const { alice, airdrop, claimSigner } = await loadFixture(setupAirdropFixture)
      const signature = await claimSigner.signClaim(alice.address, amount)
      await airdrop.disableECDSAVerification()

      // Act
      const promise = airdrop.connect(alice).signatureClaim(signature, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'SignatureClaimsDisabled')
    })

    it('should reject replayed signatures', async () => {
      // Arrange
      const amount = ethers.utils.parseEther('100')
      const { alice, airdrop, claimSigner } = await loadFixture(setupAirdropFixture)
      const signature = await claimSigner.signClaim(alice.address, amount)

      // Act
      await airdrop.connect(alice).signatureClaim(signature, alice.address)
      const promise = airdrop.connect(alice).signatureClaim(signature, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'AlreadyClaimed').withArgs(alice.address)
    })

    it('should reject signatures issued by a different signer', async () => {
      // Arrange
      const amount = ethers.utils.parseEther('100')
      const { alice, bob, airdrop, claimSigner } = await loadFixture(setupAirdropFixture)
      const signature = await claimSigner.signClaim(alice.address, amount, bob)

      // Act
      const promise = airdrop.connect(alice).signatureClaim(signature, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'InvalidSignature')
    })

    it('should not reject claimant to claim twice, even with different claim values', async () => {
      // Arrange
      const amount1 = ethers.utils.parseEther('100')
      const amount2 = ethers.utils.parseEther('200')
      const { alice, airdrop, claimSigner } = await loadFixture(setupAirdropFixture)
      const signature1 = await claimSigner.signClaim(alice.address, amount1)
      const signature2 = await claimSigner.signClaim(alice.address, amount2)

      // Act
      await airdrop.connect(alice).signatureClaim(signature1, alice.address)
      const promise = airdrop.connect(alice).signatureClaim(signature2, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'AlreadyClaimed').withArgs(alice.address)
    })

    it('should allow sending MACRO tokens to an arbitrary destination', async () => {
      // Arrange
      const amount = ethers.utils.parseEther('100')
      const { alice, airdrop, claimSigner, macroToken, bob } = await loadFixture(setupAirdropFixture)
      const signature = await claimSigner.signClaim(alice.address, amount)

      // Act
      const tx = await airdrop.connect(alice).signatureClaim(signature, bob.address)

      // Assert
      await expect(tx).to.emit(airdrop, 'AirdropClaimed').withArgs(alice.address, amount, bob.address)
      const bobBalance = await macroToken.balanceOf(bob.address)
      expect(bobBalance).to.equal(amount)
    })

    it('should reject sending MACRO tokens for unsigned amount', async () => {
      // Arrange
      const amount = ethers.utils.parseEther('100')
      const { alice, airdrop, claimSigner } = await loadFixture(setupAirdropFixture)
      const signature = await claimSigner.signClaim(alice.address, amount)
      signature.amount = amount.add(1)

      // Act
      const promise = airdrop.connect(alice).signatureClaim(signature, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'InvalidSignature')
    })
  })

  describe('Merkle claiming', () => {
    it('should allow merkle claims with a valid proof', async () => {
      // Arrange
      const { alice, airdrop, merkleClaims, macroToken } = await loadFixture(setupAirdropFixture)

      // Act
      const claim = merkleClaims[alice.address]
      const tx = await airdrop.connect(alice).merkleClaim(claim.amount, claim.proof, alice.address)

      // Assert
      await expect(tx).to.emit(airdrop, 'AirdropClaimed').withArgs(alice.address, claim.amount, alice.address)
      const aliceBalance = await macroToken.balanceOf(alice.address)
      expect(aliceBalance).to.equal(claim.amount)
    })

    it('should reject merkle claims with an invalid proof', async () => {
      // Arrange
      const { alice, airdrop, merkleClaims, merkleRoot } = await loadFixture(setupAirdropFixture)
      const claim = merkleClaims[alice.address]
      const invalidProof = claim.proof.slice(0, -1)

      // Act
      const promise = airdrop.connect(alice).merkleClaim(claim.amount, invalidProof, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'InvalidProof').withArgs(anyValue, merkleRoot)
    })

    it('should reject merkle claims with an invalid amount', async () => {
      // Arrange
      const { alice, airdrop, merkleClaims, merkleRoot } = await loadFixture(setupAirdropFixture)
      const claim = merkleClaims[alice.address]
      const invalidAmount = claim.amount.add(1)

      // Act
      const promise = airdrop.connect(alice).merkleClaim(invalidAmount, claim.proof, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'InvalidProof').withArgs(anyValue, merkleRoot)
    })

    it('should reject merkle claims for an invalid claimant', async () => {
      // Arrange
      const { alice, bob, airdrop, merkleClaims, merkleRoot } = await loadFixture(setupAirdropFixture)
      const claim = merkleClaims[alice.address]

      // Act
      const promise = airdrop.connect(bob).merkleClaim(claim.amount, claim.proof, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'InvalidProof').withArgs(anyValue, merkleRoot)
    })

    it('should prevent merkle claim to be claimed twice', async () => {
      // Arrange
      const { alice, airdrop, merkleClaims } = await loadFixture(setupAirdropFixture)
      const claim = merkleClaims[alice.address]

      // Act
      await airdrop.connect(alice).merkleClaim(claim.amount, claim.proof, alice.address)
      const promise = airdrop.connect(alice).merkleClaim(claim.amount, claim.proof, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'AlreadyClaimed').withArgs(alice.address)
    })

    it('should prevent a signature claim to be claimed again via a merkle claim', async () => {
      // Arrange
      const amount = ethers.utils.parseEther('100')
      const { alice, airdrop, merkleClaims, claimSigner } = await loadFixture(setupAirdropFixture)
      const signature = await claimSigner.signClaim(alice.address, amount)
      const claim = merkleClaims[alice.address]

      // Act
      await airdrop.connect(alice).signatureClaim(signature, alice.address)
      const promise = airdrop.connect(alice).merkleClaim(claim.amount, claim.proof, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'AlreadyClaimed').withArgs(alice.address)
    })

    it('should prevent a merkle claim to be claimed again via a signature claim', async () => {
      // Arrange
      const { alice, airdrop, merkleClaims, claimSigner } = await loadFixture(setupAirdropFixture)
      const claim = merkleClaims[alice.address]
      const signature = await claimSigner.signClaim(alice.address, claim.amount)

      // Act
      await airdrop.connect(alice).merkleClaim(claim.amount, claim.proof, alice.address)
      const promise = airdrop.connect(alice).signatureClaim(signature, alice.address)

      // Assert
      await expect(promise).to.be.revertedWithCustomError(airdrop, 'AlreadyClaimed').withArgs(alice.address)
    })

    it('should allow sending MACRO tokens to an arbitrary destination', async () => {
      // Arrange
      const { alice, airdrop, merkleClaims, macroToken, bob } = await loadFixture(setupAirdropFixture)
      const claim = merkleClaims[alice.address]

      // Act
      const tx = await airdrop.connect(alice).merkleClaim(claim.amount, claim.proof, bob.address)

      // Assert
      await expect(tx).to.emit(airdrop, 'AirdropClaimed').withArgs(alice.address, claim.amount, bob.address)
      const bobBalance = await macroToken.balanceOf(bob.address)
      expect(bobBalance).to.equal(claim.amount)
    })

    it('should support multiple merkle claims', async () => {
      // Arrange
      const { alice, bob, airdrop, merkleClaims, macroToken } = await loadFixture(setupAirdropFixture)
      const aliceClaim = merkleClaims[alice.address]
      const bobClaim = merkleClaims[bob.address]

      // Act
      await airdrop.connect(alice).merkleClaim(aliceClaim.amount, aliceClaim.proof, alice.address)
      const tx = await airdrop.connect(bob).merkleClaim(bobClaim.amount, bobClaim.proof, bob.address)

      // Assert
      await expect(tx).to.emit(airdrop, 'AirdropClaimed').withArgs(bob.address, bobClaim.amount, bob.address)
      const bobBalance = await macroToken.balanceOf(bob.address)
      expect(bobBalance).to.equal(bobClaim.amount)
    })
  })
})
