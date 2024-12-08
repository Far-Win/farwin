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

  beforeEach(async () => {
    [owner, creator, charity, user] = await ethers.getSigners();

    const { chainId } = await ethers.getDefaultProvider().getNetwork();

    // Mock dependencies
    const WitnetMock = await ethers.getContractFactory("IWitnetRandomness");
    const ERC721Mock = await ethers.getContractFactory("ERC721");

    nft = await ERC721Mock.deploy("TestNFT", "TNFT");

    const Curve = await ethers.getContractFactory("Curve");

    curve = await Curve.deploy(
      creator.address,
      charity.address,
      ethers.constants.AddressZero,
      ORACLE_MAP[chainId].address,
      ethers.utils.formatBytes32String("testKeyHash")
    );

    // Initialize NFT
    await curve.initialise(nft.address);
  });

  describe("Minting", () => {
    it("should prevent minting when game has ended", async () => {
      // Simulate game ending
      await curve.connect(owner).burn(1);

      await expect(
        curve.connect(user).mint({ value: ethers.utils.parseEther("0.1") })
      ).to.be.revertedWith("C: Game ended");
    });

    it("should prevent minting with insufficient ETH", async () => {
      await expect(
        curve.connect(user).mint({ value: ethers.utils.parseEther("0.001") })
      ).to.be.revertedWith("C: Not enough ETH sent");
    });
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
      await curve.connect(user).mint({ value: ethers.utils.parseEther("0.1") });

      const initialBalance = await user.getBalance();
      await curve.connect(user).burn(rareTokenId);

      const finalBalance = await user.getBalance();
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should prevent burning with invalid randomness", async () => {
      // Mock scenario to trigger invalid randomness
      await expect(
        curve.connect(user).burn(1)
      ).to.be.revertedWith("C: Invalid randomness");
    });
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
