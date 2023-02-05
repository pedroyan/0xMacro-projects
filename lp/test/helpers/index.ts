import { ethers } from 'hardhat'

export const INITIAL_TREASURY_BALANCE = ethers.utils.parseEther('350000')
export const ICO_MAX_CONTRIBUTION_LIMIT = ethers.utils.parseEther('30000')

export enum IcoPhase {
  SEED,
  GENERAL,
  OPEN,
}
