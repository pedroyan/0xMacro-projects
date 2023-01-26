import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { TypedDataDomain, TypedDataField } from 'ethers'
import hre, { ethers } from 'hardhat'
import { CollectorDao } from '../../typechain-types'

// https://dev.to/zemse/ethersjs-signing-eip712-typed-structs-2ph8

const createCollectorDaoDomain = (dao: CollectorDao): TypedDataDomain => {
  return {
    name: 'Collector DAO',
    version: '1',
    chainId: hre.network.config.chainId,
    verifyingContract: dao.address,
  }
}

const TYPES: Record<string, TypedDataField[]> = {
  CastVote: [
    { name: 'proposalId', type: 'uint256' },
    { name: 'support', type: 'bool' },
    { name: 'voterAddress', type: 'address' },
  ],
}

export type Eip712VoteArgs = {
  proposalId: string
  signer: SignerWithAddress
  support: boolean
  dao: CollectorDao
  fakeAddress?: string
}

export const createEip712Vote = async ({
  proposalId,
  signer,
  support,
  dao,
  fakeAddress,
}: Eip712VoteArgs): Promise<CollectorDao.Eip712VoteStruct> => {
  const votePayload = {
    proposalId,
    support,
    voterAddress: fakeAddress ?? signer.address,
  }

  const domain = createCollectorDaoDomain(dao)

  const sig = await signer._signTypedData(domain, TYPES, votePayload)
  const { r, s, v } = ethers.utils.splitSignature(sig)

  return {
    ...votePayload,
    r,
    s,
    v,
  }
}
