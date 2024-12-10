import type { Contract } from "ethers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { expect } from "chai";

import ORACLE_MAP from "../networkVariables";

describe("Curve Contract", () => {
  let curve: Contract;
  let nft: Contract;
  let chaindId: number;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let charity: SignerWithAddress;
  let user: SignerWithAddress;

  before(async () => {
    [owner, creator, charity, user] = await ethers.getSigners();

    const network = await ethers.getDefaultProvider().getNetwork();

    // Mock dependencies
    const ERC721Mock = await ethers.getContractFactory("ERC721");

    const Curve = await ethers.getContractFactory("Curve");
    const addresses = ORACLE_MAP[network.chainId];

    curve = await Curve.deploy(addresses?.creator, addresses?.charity, addresses?.address);
    nft = await ERC721Mock.deploy("TestNFT", "TNFT", "test.com/", curve.address);
  });

  describe("Minting", () => {

    it("should prevent minting when game has not started", async () => {
      await expect(
        curve.connect(owner).mint({ value: ethers.utils.parseEther("0.001") })
      ).to.be.revertedWith("NFT not initialized");
    });

    it("should prevent minting with insufficient ETH", async () => {
      await curve.connect(owner).initialise(nft.address, { value: ethers.utils.parseEther('0.001') });
      await expect(
        curve.connect(owner).mint({ value: ethers.utils.parseEther("0.015") })
      ).to.be.revertedWith("C: Not enough ETH sent");
    });

    it("should mint without conflict", async () => {
      await curve.connect(owner).mint({ value: ethers.utils.parseEther("0.06") })
    })

  });

  describe("Burning", () => {
    it("should handle rare token burning with prize multiplier", async () => {
      // Set prize multipliers
      await curve.connect(owner).setPrizeMultipliers(2, 10);

      // Mock a rare token (assuming isRare logic)
      const rareTokenId = ethers.BigNumber.from(
        "0x0500000000000000000000000000000000000000000000000000000000000000"
      );

      // Mint token first
      await curve.connect(owner).mint({ value: ethers.utils.parseEther("0.105") });

      const initialBalance = await owner.getBalance();
      await curve.connect(owner).burn(rareTokenId);

      const finalBalance = await owner.getBalance();
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should prevent burning with invalid randomness", async () => {
      // Mock scenario to trigger invalid randomness
      await expect(
        curve.connect(user).burn(1)
      ).to.be.revertedWith("C: Invalid randomness");
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
