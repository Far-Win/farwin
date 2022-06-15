import { ethers } from "ethers";

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

const creator = "0xeb610D4133477f1F4C7DE1787E0fbBD52d38dDe1";
const charity = "0x5C02a2b417EE583D98343d4B25f0b95A4DC780Ff";

export const BSCTestnet: ChainAddresses = {
  vrfCoordinatorAddress: "0xa555fC018435bef5A13C6c6870a9d4C11DEC329C",
  linkTokenAddress: "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06",
  vrfKeyHash:
    "0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186",
  creator,
  charity,
};

export const PolygonTestnet: ChainAddresses = {
  vrfCoordinatorAddress: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
  linkTokenAddress: "0x8C7382F9D8f56b33781fE506E897a4F1e2d17255",
  vrfKeyHash:
    "0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4",
  creator,
  charity,
};

export const BSCMainnet: ChainAddresses = {
  vrfCoordinatorAddress: "0x747973a5A2a4Ae1D3a8fDF5479f1514F65Db9C31",
  linkTokenAddress: "0x404460c6a5ede2d891e8297795264fde62adbb75",
  vrfKeyHash:
    "0xc251acd21ec4fb7f31bb8868288bfdbaeb4fbfec2df3735ddbd4f7dc8d60103c",
  creator,
  charity,
};

export const PolygonMainnet: ChainAddresses = {
  vrfCoordinatorAddress: "0x3d2341ADb2D31f1c5530cDC622016af293177AE0",
  linkTokenAddress: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1",
  vrfKeyHash:
    "0xf86195cf7690c55907b2b611ebb7343a6f649bff128701cc542f0569e2c549da",
  creator,
  charity,
};

export const chainIdToAddresses: {
  [id: number]: { [contractName: string]: string };
} = {
  [chainIds.bscTestnet]: BSCTestnet,
  [chainIds.polygonTestnet]: PolygonTestnet,
  [chainIds.bscMainnet]: BSCMainnet,
  [chainIds.polygonMainnet]: PolygonMainnet,
};
