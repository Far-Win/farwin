import { ethers, utils } from "ethers";

interface ChainAddresses {
  [contractName: string]: string;
}

const chainIds = {
  ganache: 5777,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  bscTestnet: 97,
  bscMainnet: 56,
  polygonTestnet: 80001,
  polygonMainnet: 137,
  ropsten: 3,
  bobaTestnet: 28,
};

const creator = "0x90dc58FA850541C854Bee547Db2eC9A8a626A037";
const charity = "0xB1071D46989a3401dEE0Ba1D4157E0143B7c7a0f";

export const BSCTestnet: ChainAddresses = {
  address: "0xa555fC018435bef5A13C6c6870a9d4C11DEC329C",
  keyHash: "0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186",
  creator,
  charity
};

const PolygonTestnet: ChainAddresses = {
  address: "0x8C7382F9D8f56b33781fE506E897a4F1e2d17255",
  keyHash: "0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4",
  creator,
  charity,
};

const BSCMainnet: ChainAddresses = {
  address: "0x747973a5A2a4Ae1D3a8fDF5479f1514F65Db9C31",
  keyHash: "0xc251acd21ec4fb7f31bb8868288bfdbaeb4fbfec2df3735ddbd4f7dc8d60103c",
  creator,
  charity,
};

const PolygonMainnet: ChainAddresses = {
  address: "0x3d2341ADb2D31f1c5530cDC622016af293177AE0",
  keyHash: "0xf86195cf7690c55907b2b611ebb7343a6f649bff128701cc542f0569e2c549da",
  creator,
  charity,
};

export default {
  [chainIds.bscTestnet]: BSCTestnet,
  [chainIds.polygonTestnet]: PolygonTestnet,
  [chainIds.bscMainnet]: BSCMainnet,
  [chainIds.polygonMainnet]: PolygonMainnet,
};
