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
  oracle: '0xC0FFEE98AD1434aCbDB894BbB752e138c1006fAB',
  creator,
  charity
}

export const SepoliaTestnet: ChainAddress = {
  oracle: '0xC0FFEE98AD1434aCbDB894BbB752e138c1006fAB',
  lottery: '0x4e0F0CEB066cd6B3fdfA18cbBC4EdbBc2b9DB887',
  collection: '0x6f43C3842D9CeC5E959E285Ae7BaBe7073b5bb62',
  proxy: '0x77703aE126B971c9946d562F41Dd47071dA00777',
  creator,
  charity
}

const HardhatLocal: ChainAddresses = {
  oracle: ethers.constants.AddressZero,
  creator,
  charity
};

export default {
  [chainIds.mainnet]: EthereumMainnet,
  [chainIds.hardhat]: HardhatLocal,
  [chainIds.base]: EthereumMainnet,
  [chainIds.sepolia]: SepoliaTestnet,
  [chainIds.optimism]: EthereumMainnet,
  [chainIds.arbitrum]: EthereumMainnet,
};
