// scripts/test-mint.ts
import { ethers } from "hardhat";
import { Curve } from "../typechain-types";

async function main() {
  // Contract addresses from your deployment
  const CURVE_ADDRESS = "0x10536eB5519cf6991D84d43B443f9ca2E916073b";
  const NFT_ADDRESS = "0xD50D6Dc2E7764D53E021BFd905a0823B7C7c6E83";

  try {
    // Get contract instance
    const curve = await ethers.getContractAt("Curve", CURVE_ADDRESS);

    // Get current mint price
    // const mintPrice = ethers.utils.parseEther("0.001"); // 0.001 ETH
    // console.log("Mint price:", ethers.utils.formatEther(mintPrice), "ETH");

    const mintPrice = await curve.getCurrentPriceToMint();
    console.log(
      "Current Mint Price:",
      ethers.utils.formatEther(mintPrice),
      "ETH"
    );

    // Add 10% buffer for gas
    const mintPriceWithBuffer = mintPrice.mul(110).div(100);
    console.log(
      "Price with buffer:",
      ethers.utils.formatEther(mintPriceWithBuffer),
      "ETH"
    );

    // Get current NFT count before mint
    const nftCountBefore = await curve.nftsCount();
    console.log("\nNFT count before mint:", nftCountBefore.toString());

    // Attempt to mint
    console.log("\nAttempting to mint...");
    const tx = await curve.mint({
      value: mintPriceWithBuffer,
      gasLimit: 500000, // Set explicit gas limit to avoid estimation issues
    });

    console.log("Waiting for transaction to be mined...");
    const receipt = await tx.wait();

    // Look for RequestedRandomness event
    const requestEvent = receipt.events?.find(
      (e) => e.event === "RequestedRandomness"
    );
    if (requestEvent) {
      console.log("\nRandomness requested successfully!");
      console.log("Round:", requestEvent.args?.[0].toString());
      console.log("Data:", requestEvent.args?.[1]);
    }

    // Get updated NFT count
    const nftCountAfter = await curve.nftsCount();
    console.log("\nNFT count after mint:", nftCountAfter.toString());

    console.log("\nTransaction hash:", tx.hash);
    console.log("\nView transaction on Base Sepolia Explorer:");
    console.log(`https://sepolia.basescan.org/tx/${tx.hash}`);

    console.log("\nWaiting for Gelato to fulfill randomness...");
    console.log(
      "Check the transaction hash on Base Sepolia Explorer to monitor the fulfillment."
    );
  } catch (error) {
    console.error("Error:", error);
    // More detailed error logging
    if (error.error) {
      console.error("Error details:", error.error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
