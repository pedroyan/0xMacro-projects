import { time } from '@nomicfoundation/hardhat-network-helpers'

/**
 * Bump the timestamp by a specific amount of seconds
 * @param seconds seconds to bump the timestamp by
 */
export const timeTravel = async (seconds: number): Promise<number> => {
  return time.increase(seconds)
}

/**
 * Set the time to be a specific amount (in seconds past epoch time)
 * @param seconds seconds to set the timestamp to
 */
export const timeTravelTo = async (seconds: number): Promise<void> => {
  return time.increaseTo(seconds)
}

export * from './proposals'
export * from './eip-721'
