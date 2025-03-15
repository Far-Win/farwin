// scripts/burn-verify.js
const { ethers } = require("hardhat");

async function main() {
  // Hardcoded token ID
  const tokenId =
    "115550112501006712013555907676295363415862272219975641195439489797771593490359";

  // Contract addresses
  const CURVE_ADDRESS = "0xF0c4d074045a7847271257E752f9F5941D2DDa3e";
  const NFT_ADDRESS = "0x8c5376606f9730121E12F6f4cCC745EfB2F81279";

  const [signer] = await ethers.getSigners();
  const curve = await ethers.getContractAt("Curve", CURVE_ADDRESS);
  const nft = await ethers.getContractAt("ERC721", NFT_ADDRESS);

  // Check ownership before burning
  try {
    const owner = await nft.ownerOf(tokenId);
    console.log(`Current owner of token ${tokenId}: ${owner}`);

    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.log("You don't own this NFT. Cannot burn.");
      return;
    }
  } catch (error) {
    console.log(
      "Error checking ownership. The NFT might not exist:",
      error.message
    );
    return;
  }

  // Get NFT count from curve contract, not from NFT contract
  const nftCounter = await curve.getNftCount();
  console.log(`Total NFTs minted: ${nftCounter.toString()}`);

  // Check NFT details
  const isRare = await curve.isRare(tokenId);
  const hasFourSquares = await curve.hasFourSameSquares(tokenId);
  const burnPrice = await curve.getCurrentPriceToBurn();
  const fourSquaresMultiplier = await curve.fourSquaresMultiplier();
  const reserve = await curve.reserve();

  // Calculate reward
  let reward;
  if (isRare) {
    console.log("NFT type: White Square (RARE)");
    reward = reserve;
  } else if (hasFourSquares) {
    console.log("NFT type: Four Same-Colored Squares");
    reward = burnPrice.mul(fourSquaresMultiplier);
  } else {
    console.log("NFT type: Regular");
    reward = burnPrice;
  }

  console.log(`You will receive: ${ethers.utils.formatEther(reward)} ETH`);

  // Remember ETH balance before burning
  const ethBalanceBefore = await ethers.provider.getBalance(signer.address);
  console.log(
    `ETH balance before: ${ethers.utils.formatEther(ethBalanceBefore)} ETH`
  );

  // Approve if needed
  const isApproved = await nft.getApproved(tokenId);
  if (isApproved.toLowerCase() !== CURVE_ADDRESS.toLowerCase()) {
    console.log("Approving...");
    await (await nft.approve(CURVE_ADDRESS, tokenId)).wait();
  }

  // Burn NFT
  console.log("Burning NFT (requesting randomness from Gelato)...");
  const tx = await curve.burn(tokenId, { gasLimit: 500000 });
  const receipt = await tx.wait();
  console.log(`Burn request transaction hash: ${receipt.transactionHash}`);

  // Wait longer for Gelato to fulfill randomness
  const waitTimeSeconds = 15;
  console.log(
    `Waiting for Gelato to fulfill randomness (${waitTimeSeconds} seconds)...`
  );
  for (let i = waitTimeSeconds; i > 0; i--) {
    process.stdout.write(`${i}... `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\nWait complete!");

  // Try to check NFT ownership after burn
  try {
    const ownerAfter = await nft.ownerOf(tokenId);
    console.log(`WARNING: NFT is still owned by ${ownerAfter}`);
    console.log("The burn may not have been processed by Gelato yet.");
  } catch (error) {
    if (error.message.includes("nonexistent token")) {
      console.log("✅ NFT has been successfully burned!");
    } else {
      console.log("Error checking NFT status:", error.message);
    }
  }

  // Check ETH balance after
  const ethBalanceAfter = await ethers.provider.getBalance(signer.address);
  const ethDifference = ethBalanceAfter.sub(ethBalanceBefore);
  console.log(
    `ETH balance after: ${ethers.utils.formatEther(ethBalanceAfter)} ETH`
  );
  console.log(`ETH difference: ${ethers.utils.formatEther(ethDifference)} ETH`);

  // This might be negative due to gas costs, but should be close to the reward
  // minus gas costs if the burn was successful

  console.log(
    "\nNOTE: If the NFT is still in your wallet, please wait a bit longer."
  );
  console.log("Gelato's randomness fulfillment can sometimes take minutes.");
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
