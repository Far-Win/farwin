import type { Contract } from "ethers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { expect } from "chai";

import ORACLE_MAP from "../networkVariables";

describe("Curve Contract", () => {
  let curve: Contract;
  let nft: Contract;
  let witnetFee: number;
  let witnet: Contract;
  let chaindId: number;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let charity: SignerWithAddress;
  let user: SignerWithAddress;

  const parseEther = (value) => ethers.utils.parseEther(value).toString();

  const waitUntilTimeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const waitForRandomness = async () => {
    const maxAttempts = 20;
    const delayBetweenAttempts = 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const lastBlockSync = await curve.lastBlockSync();
        const isReady = await witnet.isRandomized(lastBlockSync);

        if (isReady) {
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      } catch (error) {
        console.error('Error checking randomness:', error);
        throw error;
      }
    }
  }

  before(async () => {
    [owner, creator, charity, user] = await ethers.getSigners();

    const network = await ethers.provider.getNetwork();
    const addresses = ORACLE_MAP[network.chainId];
    const feeData = await ethers.provider.getFeeData();
    const latestBlock = await ethers.provider.getBlock("latest");

    if (!addresses.lottery) {
      const Curve = await ethers.getContractFactory("Curve");

      curve = await Curve.deploy(addresses?.creator, addresses?.charity, addresses?.oracle);
    } else {
      curve = await ethers.getContractAt("Curve", addresses.lottery);
    }
    if (!addresses.collection) {
      const ERC721Mock = await ethers.getContractFactory("ERC721");

      nft = await ERC721Mock.deploy("TestNFT", "TNFT", "test.com/", curve.address);
    } else {
      nft = await ethers.getContractAt("ERC721", addresses.collection);
    }

    witnet = await ethers.getContractAt("IWitnetRandomness", addresses.oracle);
    witnetFee = await witnet.estimateRandomizeFee(feeData.gasPrice);
  });

  describe("Minting", () => {

    it("should be initialised", async () => {
      const lastBlockSync = await curve.lastBlockSync();

      if (lastBlockSync.toNumber() == 0) {
        await curve.connect(owner).initialise(nft.address, { value: witnetFee })
      }
    });

    it("should prevent minting with insufficient ETH", async () => {
      await waitUntilTimeout(5000);
      await waitForRandomness();

      await expect(
        curve.connect(owner).mint({ value: parseEther("0.01") + witnetFee })
      ).to.be.revertedWith("C: Not enough ETH sent");
    });

    it("should mint without conflict", async () => {
      await waitUntilTimeout(5000);
      await waitForRandomness();

      await curve.connect(owner).mint({ value: parseEther("0.0500") + witnetFee });
      await tx.wait();
    })

  });

  describe("Burning", () => {
    it("should handle rare token burning with prize multiplier", async () => {
      await waitUntilTimeout(5000);
      await waitForRandomness();

      await curve.connect(owner).setPrizeMultipliers(2, 10);

      const rareTokenId = ethers.BigNumber.from(
        "0x0500000000000000000000000000000000000000000000000000000000000000"
      );

      await curve.connect(owner).mint({ value: parseEther("0.05") + witnetFee });

      await waitUntilTimeout(5000);
      await waitForRandomness();

      const initialBalance = await owner.getBalance();

      await curve.connect(owner).burn(rareTokenId);

      const finalBalance = await owner.getBalance();
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should prevent burning with invalid randomness", async () => {
      // Mock scenario to trigger invalid randomness
      await expect(
        curve.connect(user).burn(1)
      ).to.be.revertedWith("C: Randomness not ready");

    });

    it("should reward lottery the intended lottery winner", () => { });

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
