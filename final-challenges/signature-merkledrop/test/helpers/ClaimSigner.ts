import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Airdrop } from '../../typechain-types'
import { EIP712Airdrop } from '../../typechain-types/contracts/Airdrop'
import hre, { ethers } from 'hardhat'
import { BigNumberish, TypedDataDomain, TypedDataField } from 'ethers'

const TYPES: Record<string, TypedDataField[]> = {
  Claim: [
    { name: 'claimer', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
}

export class ClaimSigner {
  constructor(private signer: SignerWithAddress, private aidropContract: Airdrop) {}

  private createAidropDomain(): TypedDataDomain {
    return {
      name: 'Airdrop',
      version: 'v1',
      chainId: hre.network.config.chainId,
      verifyingContract: this.aidropContract.address,
    }
  }

  async signClaim(
    claimer: string,
    amount: BigNumberish,
    overrideSigner?: SignerWithAddress,
  ): Promise<EIP712Airdrop.SignedClaimStruct> {
    const signer = overrideSigner ?? this.signer

    const domain = this.createAidropDomain()

    const payload = {
      claimer,
      amount,
    }

    const sig = await signer._signTypedData(domain, TYPES, payload)
    const { r, s, v } = ethers.utils.splitSignature(sig)

    return {
      ...payload,
      r,
      s,
      v,
    }
  }
}
