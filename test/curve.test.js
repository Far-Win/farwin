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
  const vestingAmountPerUser = ethers.utils.parseEther("1");
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
      mockERC20.address,
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

  it("Should successfully mint the NFT with a vesting token and claim the tokens after vesting period", async function () {
    const vestingTokenAmount = ethers.utils.parseEther("5");
    
    await mockERC20.transfer(curve.address, vestingTokenAmount);

    expect(await mockERC20.balanceOf(curve.address)).to.be.equal(vestingTokenAmount);

    const mintPrice = await curve.getCurrentPriceToMint();
    const mintValue = mintPrice.mul(110).div(100); // Add 10%

    await curve.connect(user).mint({ value: mintValue });

    const requestId = 0;
    const dataWithRound = await getDataWithRound(requestId);

    await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

    expect(
      await mockERC20.balanceOf(curve.address)
    ).to.be.equal(vestingTokenAmount.sub(vestingAmountPerUser)); 
    expect(await mockERC20.balanceOf(nft.address)).to.be.equal(vestingAmountPerUser);

    const tokenId = await nft.tokenOfOwnerByIndex(user.address, 0);
    const vestingInfo = await nft.getVestingInfo(tokenId);

    expect(vestingInfo[0]).to.be.equal(vestingAmountPerUser);
    expect(vestingInfo[2]).to.be.equal(mockERC20.address);

    await expect(nft.connect(user).claimVestedTokens(tokenId)).to.be.revertedWith("FREEDOM: Vesting period must pass");

    await networkUtils.setTime((Date.now() + 1000000));

    expect(await mockERC20.balanceOf(user.address)).to.be.equal(0);

    await nft.connect(user).claimVestedTokens(tokenId);

    expect(await mockERC20.balanceOf(user.address)).to.be.equal(vestingAmountPerUser);
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

  it("Should burn the regular minted NFT", async function () {
    const mintPrice = await curve.getCurrentPriceToMint();
    const mintValue = mintPrice.mul(110).div(100); // Add 10%

    await curve.connect(user).mint({ value: mintValue });

    const requestId = 0;
    const dataWithRound = await getDataWithRound(requestId);

    await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

    const tokenId = await nft.tokenOfOwnerByIndex(user.address, 0);

    await expect(curve.burn(tokenId)).to.be.revertedWith("FREEDOM: Not the correct owner");

    await curve.connect(user).burn(tokenId);
  });

  it("Should burn the five same square minted NFT with a small reserve", async function () {
    let tokenId;

    for (let i = 0; i < 100; i++) {
      const mintPrice = await curve.getCurrentPriceToMint();
      const mintValue = mintPrice.mul(110).div(100); // Add 10%

      await curve.connect(user).mint({ value: mintValue });

      const requestId = i;
      const dataWithRound = await getDataWithRound(requestId);

      await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

      const balance = await nft.balanceOf(user.address);
      tokenId = await nft.tokenOfOwnerByIndex(user.address, balance.sub(1));

      const hasFive = await curve.hasFiveSameSquares(tokenId);
      if (hasFive) {
        break;
      }
    }

    await expect(curve.connect(user).burn(tokenId)).to.be.revertedWith("Cannot burn five squares when only 2 NFT remains");

    // mint an extra NFT to meet the burning condition
    const mintPrice = await curve.getCurrentPriceToMint();
    const mintValue = mintPrice.mul(110).div(100); // Add 10%

    await curve.connect(user).mint({ value: mintValue });

    const requestId = 2;
    const dataWithRound = await getDataWithRound(requestId);

    await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

    expect(await curve.hasFiveSameSquares(tokenId)).to.be.true;

    const burnPrice = (await curve.getCurrentPriceToMint()).mul(2);
    const balanceBeforeBurn = await ethers.provider.getBalance(user.address);
    
    const burn = await curve.connect(user).burn(tokenId);
    const receipt = await burn.wait();

    const burnedEvent = receipt.events?.filter((event) => event.event === "Burned");

    expect(burnedEvent[0].args.priceReceived).to.be.equal(burnPrice);

    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const balanceAfterBurn = await ethers.provider.getBalance(user.address);

    expect(balanceAfterBurn).to.be.equal(balanceBeforeBurn.add(burnPrice).sub(gasCost));
  });

  it("Should burn the five same square minted NFT with a large reserve", async function () {
    let tokenId;
    let found = false;
    let fiveSqTokenId;

    for (let i = 0; i < 50; i++) {
      const mintPrice = await curve.getCurrentPriceToMint();
      const mintValue = mintPrice.mul(110).div(100); // Add 10%

      await curve.connect(user).mint({ value: mintValue });

      const requestId = i;
      const dataWithRound = await getDataWithRound(requestId);

      await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

      const balance = await nft.balanceOf(user.address);
      tokenId = await nft.tokenOfOwnerByIndex(user.address, balance.sub(1));

      const hasFive = await curve.hasFiveSameSquares(tokenId);
      if (!found && hasFive) {
        fiveSqTokenId = tokenId;
        found = true;
      }
    }

    expect(await curve.hasFiveSameSquares(fiveSqTokenId)).to.be.true;

    const burnPrice = (await curve.getCurrentPriceToMint()).mul(2);
    const balanceBeforeBurn = await ethers.provider.getBalance(user.address);
    
    const burn = await curve.connect(user).burn(fiveSqTokenId);
    const receipt = await burn.wait();

    const burnedEvent = receipt.events?.filter((event) => event.event === "Burned");

    expect(burnedEvent[0].args.priceReceived).to.be.equal(burnPrice);

    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const balanceAfterBurn = await ethers.provider.getBalance(user.address);

    expect(balanceAfterBurn).to.be.equal(balanceBeforeBurn.add(burnPrice).sub(gasCost));
  });

  it("Should be able to mint a rare NFT, burn it and get the whole reserve", async function () {
    let tokenId;

    for (let i = 0; i < 150; i++) {
      const mintPrice = await curve.getCurrentPriceToMint();
      const mintValue = mintPrice.mul(110).div(100); // Add 10%

      await curve.connect(user).mint({ value: mintValue });

      const requestId = i;
      const dataWithRound = await getDataWithRound(requestId);

      await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

      const balance = await nft.balanceOf(user.address);
      tokenId = await nft.tokenOfOwnerByIndex(user.address, balance.sub(1));

      const isRare = await curve.isRare(tokenId);
      if (isRare) {
        break;
      }
    }

    expect(await curve.isRare(tokenId)).to.be.true;

    const burnPrice = await ethers.provider.getBalance(curve.address);
    const balanceBeforeBurn = await ethers.provider.getBalance(user.address);

    const burn = await curve.connect(user).burn(tokenId);
    const receipt = await burn.wait();

    const burnedEvent = receipt.events?.filter((event) => event.event === "Burned");
    const lotteryEvent = receipt.events?.filter((event) => event.event === "Lottery")

    expect(burnedEvent[0].args.priceReceived).to.be.equal(burnPrice);
    expect(lotteryEvent[0].args.isWinner).to.be.true;

    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const balanceAfterBurn = await ethers.provider.getBalance(user.address);

    expect(balanceAfterBurn).to.be.equal(balanceBeforeBurn.add(burnPrice).sub(gasCost));
    expect(await ethers.provider.getBalance(curve.address)).to.be.equal(0);
  });

  it("Should check out charity funding", async function () {
    expect(await ethers.provider.getBalance(charity.address)).to.be.equal(ethers.utils.parseEther("10000"));

    for (let i = 0; i < 10; i++) {
      const charityBalanceBefore = await ethers.provider.getBalance(charity.address);
      const mintPrice = await curve.getCurrentPriceToMint();
      const mintValue = mintPrice.mul(110).div(100); // Add 10%
      const charityAmount = mintPrice.mul(150).div(1000);

      await curve.connect(user).mint({ value: mintValue });

      const charityBalanceAfter = await ethers.provider.getBalance(charity.address);
      const charityFundsFromContract = await curve.charityFunds();

      const requestId = i;
      const dataWithRound = await getDataWithRound(requestId);

      await curve.connect(owner).fulfillRandomness(randomness, dataWithRound);

      expect(charityBalanceAfter).to.be.equal(charityBalanceBefore.add(charityAmount));
      expect(charityBalanceAfter.sub(ethers.utils.parseEther("10000"))).to.be.equal(charityFundsFromContract);
    }
  });

  it("Should be able to set vesting amount per user only by the Curve owner", async function () {
    const newVestingAmountPerUser = ethers.utils.parseEther("10");

    await expect(curve.connect(user).setVestingDistributionAmount(newVestingAmountPerUser)).to.be.revertedWith("Ownable: caller is not the owner");

    await curve.connect(owner).setVestingDistributionAmount(newVestingAmountPerUser);

    expect(await curve.vestingAmountPerUser()).to.be.equal(newVestingAmountPerUser);
  });
});