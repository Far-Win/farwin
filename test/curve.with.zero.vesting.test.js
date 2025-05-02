const { expect } = require("chai");
const { ethers } = require("hardhat");
const NetworkUtils = require("./helpers/networkUtils");
const getDataWithRound = require("./helpers/gelato");

describe("Curve", async function () {
  let accounts;

  let owner;
  let creator;
  let charity;
  let user;

  let mockERC20;
  let curve;
  let nft;

  const networkUtils = new NetworkUtils();

  const color1 = "#898989"; // Square 1
  const color2 = "#555555"; // Square 2
  const color3 = "#009A49"; // Square 3
  const color4 = "#005BBB"; // Square 4
  const color5 = "#BF0A30"; // Square 5
  // Square 6, 7, and 8 will randomly use these colors too
  // Square 9 (middle) will be white (#ffffff) when it's a rare NFT

  const name = "Freedom";
  const symbol = "FREE";
  const vestingAmountPerUser = ethers.utils.parseEther("0");
  const zeroAddress = ethers.constants.AddressZero;
  const randomness =
        "0x471403f3a8764edd4d39c7748847c07098c05e5a16ed7b083b655dbab9809fae"; // fake randomness

  before("setup", async function () {
    await ethers.provider.send("hardhat_reset");

    accounts = await ethers.getSigners();

    owner = accounts[0];
    creator = accounts[1];
    charity = accounts[2];
    user = accounts[3];

    afterEach('revert', function () { return networkUtils.revert(); });

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.connect(owner).deploy(
      ethers.utils.parseEther("250"), "Test", "TEST"
    );
    let contract = await mockERC20.deployed();

    const Curve = await ethers.getContractFactory("Curve");
    curve = await Curve.connect(owner).deploy(
      creator.address,
      charity.address,
      owner.address, // acts as an operator
      zeroAddress,
      vestingAmountPerUser
    );
    contract = await curve.deployed();

    const Nft = await ethers.getContractFactory("ERC721");
    nft = await Nft.connect(owner).deploy(
      name,
      symbol,
      curve.address,
      color1,
      color2,
      color3,
      color4,
      color5
    );
    contract = await nft.deployed();

    const baseURI = `https://crypty-frame.vercel.app/api/token/${nft.address}/`;
    await nft.setBaseURI(baseURI);

    await curve.initNFT(nft.address);

    await networkUtils.snapshot();
  });

  it("Should request & fulfill randomness", async function () {
    const mintPrice = await curve.getCurrentPriceToMint();
    const mintValue = mintPrice.mul(110).div(100); // Add 10%
    
    await expect(
      curve.connect(user).mint({ value: mintValue })
    ).to.emit(curve, "RequestedRandomness");

    const requestId = 0;

    expect(await curve.requestPending(requestId)).to.be.true;

    const dataWithRound = await getDataWithRound(requestId);

    expect(
      await curve.requestedHash(requestId)
    ).to.be.equal(ethers.utils.keccak256(dataWithRound));

    await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

    expect(await curve.requestPending(requestId)).to.be.false;

    const tokenId = await nft.tokenOfOwnerByIndex(user.address, 0);

    expect(await nft.ownerOf(tokenId)).to.be.equal(user.address);
  });

  it("Should successfully mint an NFT w/o a vesting token", async function () {
    const mintPrice = await curve.getCurrentPriceToMint();
    const mintValue = mintPrice.mul(110).div(100); // Add 10%

    await curve.connect(user).mint({ value: mintValue });

    const requestId = 0;
    const dataWithRound = await getDataWithRound(requestId);

    await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

    expect(await mockERC20.balanceOf(nft.address)).to.be.equal(0);
    expect(await mockERC20.balanceOf(curve.address)).to.be.equal(0);
    expect(await mockERC20.balanceOf(user.address)).to.be.equal(0);

    const tokenId = await nft.tokenOfOwnerByIndex(user.address, 0);
    await expect(nft.connect(user).claimVestedTokens(tokenId)).to.be.revertedWith("FREEDOM: Your vesting amount is 0");
  });
});