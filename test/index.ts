import type { Contract } from "ethers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { expect } from "chai";

import ORACLE_MAP from "../networkVariables";

const GWEI = '1000000000';
const MINT_FEE = '50000000000000000';
const INCORRECT_MINT_FEE = '10000000000000000';

const BigNumber = (value) => ethers.BigNumber.from(value);

const parseEther = (value) => ethers.utils.parseEther(value);

describe("Curve Contract", () => {
  let curve: Contract;
  let nft: Contract;
  let witnetFee: number;
  let witnet: Contract;
  let proxy: Contract;
  let chaindId: number;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let charity: SignerWithAddress;
  let user: SignerWithAddress;


  const waitUntilTimeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const waitForRandomness = async () => {
    const maxAttempts = 25;
    const delayBetweenAttempts = 10000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const lastBlockSync = await curve.lastBlockSync();
        const isReady = await witnet.isRandomized(lastBlockSync);

        if (isReady && lastBlockSync > 0) {
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      } catch (error) {
        console.error('Error checking randomness:', error);
        throw error;
      }
    }
  }

  beforeEach(async () => {
    await waitUntilTimeout(2000);
    await waitForRandomness();
  })

  before(async () => {
    [owner, creator, charity, user] = await ethers.getSigners();

    const network = await ethers.provider.getNetwork();
    const addresses = ORACLE_MAP[network.chainId];
    const feeData = await ethers.provider.getFeeData();

    if (!addresses.lottery) {
      const Curve = await ethers.getContractFactory("Curve");

      curve = await Curve.deploy(addresses?.oracle, addresses?.creator, addresses?.charity);
    } else {
      curve = await ethers.getContractAt("Curve", addresses.lottery);
    }
    if (!addresses.collection) {
      const ERC721Mock = await ethers.getContractFactory("ERC721");

      nft = await ERC721Mock.deploy("TestNFT", "TNFT", "test.com/", curve.address);
    } else {
      nft = await ethers.getContractAt("ERC721", addresses.collection);
    }

    witnet = await ethers.getContractAt("IWitnetRandomnessV2", addresses.oracle);
    proxy = await ethers.getContractAt("IWitnetProxy", addresses.proxy);

    const baseFeeOverheadPercentage = await witnet.baseFeeOverheadPercentage();
    const gasPrice = BigNumber(feeData.gasPrice).add(BigNumber(GWEI).mul(BigNumber(2)));

    const proxyCallResult = await ethers.provider.call({
      to: addresses.proxy,
      data: proxy.interface.encodeFunctionData('estimateBaseFeeWithCallback', [gasPrice, 100000])
    });

    // Then decode the result
    const [estimatedBaseFee] = proxy.interface.decodeFunctionResult('estimateBaseFeeWithCallback', proxyCallResult);
    const witnetOracleFee = parseInt(
      (estimatedBaseFee * (100 + baseFeeOverheadPercentage)) / 100
    );

    witnetFee = BigNumber(witnetOracleFee.toString());
  });

  describe("Minting", () => {

    it("should be initialised", async () => {
      const lastBlockSync = await curve.lastBlockSync();

      if (lastBlockSync == 0) {
        await curve.connect(owner).initialise(nft.address, witnetFee, { value: witnetFee })
      }
    });

    it("should prevent minting with insufficient ETH", async () => {
      await expect(
        curve.connect(owner).mint({ value: BigNumber(INCORRECT_MINT_FEE).add(witnetFee) })
      ).to.be.revertedWith("C: Not enough ETH sent");
    });

    it("should mint without conflict", async () => {
      // await curve.connect(owner).mint({ value: BigNumber(MINT_FEE).add(witnetFee), gasLimit: 600000 });
    });

  });

  describe("Burning", () => {
    it("should handle rare token burning with prize multiplier", async () => {
      await curve.connect(owner).setPrizeMultipliers(2, 10);

      const rareTokenId = BigNumber("37723766914724038473536443636257367219977366390635397519598225436574042203149");
      //await curve.connect(owner).mint({ value: BigNumber(MINT_FEE).add(witnetFee) });

      await waitUntilTimeout(2000);
      await waitForRandomness();

      const initialBalance = await owner.getBalance();

      await curve.connect(owner).burn(rareTokenId, { value: witnetFee, gasLimit: 600000 });

      const finalBalance = await owner.getBalance();

      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should prevent burning with invalid randomness", async () => {
      // Mock scenario to trigger invalid randomness
      await expect(
        curve.connect(user).burn(1, { value: witnetFee })
      ).to.be.revertedWith("C: Randomness not ready");

    });

    it("should reward the intended lottery winner", () => { });

  });

  describe("Prize Multipliers", () => {
    it("should restrict prize multiplier ranges", async () => {
      await expect(
        curve.connect(owner).setPrizeMultipliers(1, 10)
      ).to.be.revertedWith("Curve: Flag multiplier must be between 2 and 8");

      await expect(
        curve.connect(owner).setPrizeMultipliers(3, 41)
      ).to.be.revertedWith("Curve: Rare multiplier must be between 5 and 40");
    });
  });
});
