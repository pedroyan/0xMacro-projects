import { BigNumberish } from 'ethers'
import { keccak256 } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { CollectorDao } from '../../typechain-types'

export type BuyNftProposalArgs = {
  daoContract: CollectorDao
  marketplaceAddress: string
  nftContract: string
  nftId: number
  price: BigNumberish
  description: string
}

export type ProposeArguments = [string[], BigNumberish[], string[], string]

export type ProposalData = {
  proposalPayload: ProposeArguments
  callPayload: ProposeArguments
}

export const buildBuyNftProposal = ({
  daoContract,
  marketplaceAddress,
  nftContract,
  nftId,
  price,
  description,
}: BuyNftProposalArgs): ProposalData => {
  const buyNftCalldata = daoContract.interface.encodeFunctionData('buyNFTFromMarketplace', [
    marketplaceAddress,
    nftContract,
    nftId,
    price,
  ])

  const descriptionHash = ethers.utils.id(description)

  return {
    proposalPayload: [[daoContract.address], [price], [buyNftCalldata], description],
    callPayload: [[daoContract.address], [price], [buyNftCalldata], descriptionHash],
  }
}

export const computeProposalId = (callPayload: ProposeArguments): string => {
  const encodedArgs = ethers.utils.defaultAbiCoder.encode('address[],uint256[],bytes[],bytes32'.split(','), callPayload)
  return keccak256(encodedArgs)
}

export const mergeProposals = (proposals: ProposalData[], description: string): ProposalData => {
  const merged: ProposalData = {
    proposalPayload: [[], [], [], description],
    callPayload: [[], [], [], ethers.utils.id(description)],
  }

  for (let i = 0; i < proposals.length; i++) {
    const toMerge = proposals[i]
    for (let i = 0; i < 3; i++) {
      ;(merged.callPayload[i] as any[]).push(...toMerge.callPayload[i])
      ;(merged.proposalPayload[i] as any[]).push(...toMerge.proposalPayload[i])
    }
  }

  return merged
}
