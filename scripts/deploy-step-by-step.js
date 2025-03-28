const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Define colors - can be customized here or via env variables
  const color1 = process.env.COLOR1 || "#898989"; // Square 1
  const color2 = process.env.COLOR2 || "#555555"; // Square 2
  const color3 = process.env.COLOR3 || "#009A49"; // Square 3
  const color4 = process.env.COLOR4 || "#005BBB"; // Square 4
  const color5 = process.env.COLOR5 || "#BF0A30"; // Square 5
  // Square 6, 7, and 8 will randomly use these colors too
  // Square 9 (middle) will be white (#ffffff) when it's a rare NFT

  console.log("Using custom colors:");
  console.log(`Color 1: ${color1}`);
  console.log(`Color 2: ${color2}`);
  console.log(`Color 3: ${color3}`);
  console.log(`Color 4: ${color4}`);
  console.log(`Color 5: ${color5}`);
  console.log("White (#ffffff) will be used for rare NFTs\n");

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

    // 2. Deploy ERC721 with custom colors
    console.log("\n2. Deploying ERC721 contract with custom colors...");
    const ERC721 = await ethers.getContractFactory("ERC721");
    const nft = await ERC721.deploy(
      "Freedom NFT", // name
      "FREE", // symbol
      curve.address, // curve address
      color1,
      color2,
      color3,
      color4,
      color5
    );
    await nft.deployed();
    console.log("ERC721 deployed to:", nft.address);

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

    // // 4. Set prize multipliers
    // console.log("\n4. Setting prize multipliers...");
    // const multiplierTx = await curve.setPrizeMultipliers(2, 5);
    // await multiplierTx.wait();
    // console.log("Prize multipliers set ✓");

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

    console.log("\nDeployment completed successfully! ✓");

    // Print summary for future reference
    console.log("\nDEPLOYMENT SUMMARY");
    console.log("==================");
    console.log("Curve Contract:", curve.address);
    console.log("NFT Contract:", nft.address);
    console.log("Owner:", deployer.address);
    console.log("Colors Used:");
    console.log(`  Color 1: ${color1}`);
    console.log(`  Color 2: ${color2}`);
    console.log(`  Color 3: ${color3}`);
    console.log(`  Color 4: ${color4}`);
    console.log(`  Color 5: ${color5}`);
    console.log(`  Rare Color: #ffffff (white)`);

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
