const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  try {
    // 1. Deploy Curve first
    console.log("\n1. Deploying Curve contract...");
    const Curve = await ethers.getContractFactory("Curve");
    const curve = await Curve.deploy(
      deployer.address, // creator
      deployer.address, // charity
      "0x1F919E17bB2f322bd1ed5Bf822988C37162CF46c" // gelato operator
    );
    await curve.deployed();
    console.log("Curve deployed to:", curve.address);

    // Verify Curve deployment
    const curveCode = await ethers.provider.getCode(curve.address);
    if (curveCode === "0x") {
      throw new Error("Curve contract deployment failed - no code at address");
    }
    console.log("Curve deployment verified ✓");

    // 2. Deploy ERC721
    console.log("\n2. Deploying ERC721 contract...");
    const ERC721 = await ethers.getContractFactory("ERC721");
    const nft = await ERC721.deploy(
      "Freedom NFT", // name
      "FREE", // symbol
      curve.address // curve address
    );
    await nft.deployed();
    console.log("ERC721 deployed to:", nft.address);

    const baseURI = `https://crypty-frame.vercel.app/api/token/${nft.address}/`;
    await nft.setBaseURI(baseURI);
    console.log("BaseURI set to:", baseURI);

    // Verify NFT deployment
    const nftCode = await ethers.provider.getCode(nft.address);
    if (nftCode === "0x") {
      throw new Error("NFT contract deployment failed - no code at address");
    }
    console.log("NFT deployment verified ✓");

    // 3. Initialize NFT in Curve contract
    console.log("\n3. Initializing NFT in Curve contract...");
    const initTx = await curve.initNFT(nft.address);
    await initTx.wait();
    console.log("NFT initialized in Curve contract ✓");

    // 4. Set prize multipliers
    console.log("\n4. Setting prize multipliers...");
    const multiplierTx = await curve.setPrizeMultipliers(2, 5);
    await multiplierTx.wait();
    console.log("Prize multipliers set ✓");

    // 5. Final verification
    console.log("\n5. Performing final verification...");

    const curveNFT = await curve.nft();
    console.log("NFT address in Curve:", curveNFT);
    console.log("Expected NFT address:", nft.address);
    console.log(
      "NFT reference correct:",
      curveNFT.toLowerCase() === nft.address.toLowerCase()
    );

    const nftName = await nft.name();
    const nftSymbol = await nft.symbol();
    console.log("NFT Name:", nftName);
    console.log("NFT Symbol:", nftSymbol);

    const flagMultiplier = await curve.ukrainianFlagPrizeMultiplier();
    const rareMultiplier = await curve.rarePrizeMultiplier();
    console.log("Flag Multiplier:", flagMultiplier.toString());
    console.log("Rare Multiplier:", rareMultiplier.toString());

    console.log("\nDeployment completed successfully! ✓");

    // Print summary for future reference
    console.log("\nDEPLOYMENT SUMMARY");
    console.log("==================");
    console.log("Curve Contract:", curve.address);
    console.log("NFT Contract:", nft.address);
    console.log("Owner:", deployer.address);

    return { curve, nft };
  } catch (error) {
    console.error("\nError during deployment:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
