const { ethers } = require("hardhat");
const NetworkUtils = require("./helpers/networkUtils");
const { expect } = require("chai");

describe("FarWin", async function () {
  let accounts;

  let owner;
  let tokenHolder;

  let farwinToken;

  const networkUtils = new NetworkUtils();

  const totalSupply = ethers.utils.parseEther("10000000");

  before("setup", async function () {
    await ethers.provider.send("hardhat_reset");

    accounts = await ethers.getSigners();

    owner = accounts[0];
    tokenHolder = accounts[1];

    afterEach("revert", function () { return networkUtils.revert() });

    const FarWinToken = await ethers.getContractFactory("FarWinToken");
    farwinToken = await FarWinToken.connect(owner).deploy(tokenHolder.address);
    await farwinToken.deployed();
  });

  it("Should check all the necessary token conditions", async function () {
    expect(await farwinToken.balanceOf(tokenHolder.address)).to.be.equal(totalSupply);
    expect(await farwinToken.decimals()).to.be.equal(18);
    expect(await farwinToken.name()).to.be.equal("FarWin");
    expect(await farwinToken.symbol()).to.be.equal("FWIN");
    expect(await farwinToken.totalSupply()).to.be.equal(totalSupply);
  });

  it("Should burn X tokens from self", async function () {
    const amount = ethers.utils.parseEther("100");
    
    await farwinToken.connect(tokenHolder).burn(amount);

    expect(await farwinToken.balanceOf(tokenHolder.address)).to.be.equal(totalSupply.sub(amount));
    expect(await farwinToken.totalSupply()).to.be.equal(totalSupply.sub(amount));
  });
});