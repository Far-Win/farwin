import { ethers, utils } from "ethers";

interface ChainAddresses {
  [contractName: string]: string;
}

const chainIds = {
  ganache: 5777,
  base: 8453,
  sepolia: 11155111,
  optimism: 10,
  arbitrum: 42161,
  hardhat: 31337,
  mainnet: 1
};

const creator = "0x90dc58FA850541C854Bee547Db2eC9A8a626A037";
const charity = "0xB1071D46989a3401dEE0Ba1D4157E0143B7c7a0f";

export const EthereumMainnet: ChainAddresses = {
  address: '0xC0FFEE98AD1434aCbDB894BbB752e138c1006fAB',
  creator,
  charity
}

const HardhatLocal: ChainAddresses = {
  address: ethers.constants.AddressZero,
  creator,
  charity
};

export default {
  [chainIds.mainnet]: EthereumMainnet,
  [chainIds.hardhat]: HardhatLocal,
  [chainIds.base]: EthereumMainnet,
  [chainIds.sepolia]: EthereumMainnet,
  [chainIds.optimism]: EthereumMainnet,
  [chainIds.arbitrum]: EthereumMainnet,
};
