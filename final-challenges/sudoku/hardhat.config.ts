import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'

// The config below is the original config from the fake sudoku PR that I'm auditing.
// const config = {
//   solidity: "0.8.12",
//   networks: {
//     ropsten: {
//       url: process.env.ROPSTEN_URL || "",
//       accounts:
//         process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
//     },
//   }
// };

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.12',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10_000,
      },
    },
  },
}

export default config
