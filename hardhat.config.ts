import dotenv from "dotenv";
dotenv.config();
import { parseEther } from "@ethersproject/units";

import { HardhatUserConfig } from "hardhat/types";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-abi-exporter";
import "hardhat-tracer";
import "@nomiclabs/hardhat-etherscan";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  defaultNetwork: "hardhat",
  networks: {
    local: {
      url: "http://127.0.0.1:8545",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
    hardhat: {
      // forking: {
      //   url: "https://matic-mainnet-full-rpc.bwarelabs.com",
      // },
      accounts: [
        {
          privateKey: process.env.DEPLOYER_PRIVATE_KEY!,
          balance: parseEther("100").toString(),
        },
      ],
    },
    baseSepolia: {
      url: `https://sepolia.base.org`,
      chainId: 84532,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
    sepolia: {
      chainId: 11155111,
      url: `https://sepolia.infura.io`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
    base: {
      url: `https://mainnet.base.org`,
      chainId: 8453,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
    polygonTestnet: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-2-s2.binance.org:8545",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
    polygonMainnet: {
      url: "https://polygon-rpc.com/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      gasPrice: "auto",
    },
    bscMainnet: {
      url: "https://bscrpc.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
  },
  mocha: {
    timeout: 200000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
