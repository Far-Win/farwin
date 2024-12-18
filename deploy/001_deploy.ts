const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy contracts
  const ERC721 = await hre.ethers.getContractFactory("ERC721");
  const Curve = await hre.ethers.getContractFactory("Curve");

  // Deploy Curve first with placeholder addresses
  const curve = await Curve.deploy(
    deployer.address, // creator
    deployer.address, // charity
    "0x1F919E17bB2f322bd1ed5Bf822988C37162CF46c" // gelato operator
  );
  await curve.deployed();
  console.log("Curve deployed to:", curve.address);

  // Deploy ERC721 with curve address
  const nft = await ERC721.deploy(
    "Freedom NFT", // name
    "FREE", // symbol
    "baseURI/", // baseURI
    curve.address // curve address
  );
  await nft.deployed();
  console.log("ERC721 deployed to:", nft.address);

  // Initialize NFT in Curve contract
  await curve.initNFT(nft.address);
  console.log("NFT initialized in Curve contract");

  // Set prize multipliers
  await curve.setPrizeMultipliers(2, 5); // flag multiplier: 2, rare multiplier: 5
  console.log("Prize multipliers set");

  return { curve, nft };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
