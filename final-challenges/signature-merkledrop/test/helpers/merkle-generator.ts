import { BigNumber, BigNumberish, ethers } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import { keccak256 } from 'ethers/lib/utils' // TODO: Do I need to install the keccak256 package?

export type ClaimArgs = {
  amount: BigNumber
  proof: string[]
}

export type MerkleTreeResult = {
  root: string
  claims: Record<string, ClaimArgs>
}

export type TokenDrop = {
  address: string
  amount: BigNumber
}

export const generateMerkleTree = (airdrops: TokenDrop[]): MerkleTreeResult => {
  const leaves = airdrops.map((drop) => {
    return {
      address: drop.address,
      amount: drop.amount,
      node: Buffer.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [drop.address, drop.amount]).slice(2),
        'hex',
      ),
    }
  })

  const merkleTree = new MerkleTree(
    leaves.map((l) => l.node),
    keccak256,
    { sortPairs: true },
  )

  return {
    root: merkleTree.getHexRoot(),
    claims: leaves.reduce((acc, leaf) => {
      acc[leaf.address] = {
        amount: leaf.amount,
        proof: merkleTree.getHexProof(leaf.node),
      }
      return acc
    }, {} as Record<string, ClaimArgs>),
  }
}
