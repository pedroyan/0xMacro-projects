import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { expect } from 'chai'

describe('Libraries', () => {
  async function setupFixture() {
    const [deployer, alice] = await ethers.getSigners()

    const FailableCoin = await ethers.getContractFactory('FailableCoin')
    const failableCoin = await FailableCoin.deploy()

    const LibraryTestContract = await ethers.getContractFactory('LibraryTestContract')
    const libraryTestContract = await LibraryTestContract.deploy()

    return { failableCoin, libraryTestContract, deployer, alice }
  }

  it('should revert if transferFrom returns a false boolean', async () => {
    // Arrange
    const { failableCoin, libraryTestContract, deployer, alice } = await loadFixture(setupFixture)

    // Act
    await failableCoin.connect(deployer).approve(libraryTestContract.address, 100)
    await failableCoin.connect(deployer).setShouldFail(true)
    const promise = libraryTestContract.safeTransferFrom(failableCoin.address, deployer.address, alice.address, 100)

    // Assert
    await expect(promise)
      .to.be.revertedWithCustomError(libraryTestContract, 'TokenTransferFailed')
      .withArgs(failableCoin.address, deployer.address, alice.address, 100)
  })

  it('should revert if transfer returns a false boolean', async () => {
    // Arrange
    const { failableCoin, libraryTestContract, deployer, alice } = await loadFixture(setupFixture)

    // Act
    await failableCoin.connect(deployer).transfer(libraryTestContract.address, 100)
    await failableCoin.connect(deployer).setShouldFail(true)
    const promise = libraryTestContract.safeTransfer(failableCoin.address, alice.address, 100)

    // Assert
    await expect(promise)
      .to.be.revertedWithCustomError(libraryTestContract, 'TokenTransferFailed')
      .withArgs(failableCoin.address, libraryTestContract.address, alice.address, 100)
  })

  it('should revert if reserveOut is 0', async () => {
    // Arrange
    const { libraryTestContract, deployer } = await loadFixture(setupFixture)

    // Act
    const promise = libraryTestContract.getMaximumAmountOut(100, 100, 0)

    // Assert
    await expect(promise).to.be.revertedWithCustomError(libraryTestContract, 'InsufficientLiquidity')
  })

  it('should return 1 if square root argument is < 3', async () => {
    // Arrange
    const { libraryTestContract } = await loadFixture(setupFixture)

    // Act
    const result = await libraryTestContract.sqrt(2)

    // Assert
    expect(result).to.equal(1)
  })
})

// TODO On another file (?): E2E Test covering the ICO Scenario described on the LMS
// TODO Increase covergae.
