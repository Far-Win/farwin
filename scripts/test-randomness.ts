// scripts/test-randomness.ts
import { ethers } from "hardhat";
import { Curve } from "../typechain-types";

async function main() {
  // Get the deployed contract
  const curve = await ethers.getContract<Curve>("Curve");

  try {
    // Get current mint price
    const mintPrice = await curve.getCurrentPriceToMint();
    console.log(
      "Current mint price:",
      ethers.utils.formatEther(mintPrice),
      "ETH"
    );

    // Add 10% buffer to ensure enough ETH is sent
    const mintPriceWithBuffer = mintPrice.mul(110).div(100);
    console.log(
      "Mint price with buffer:",
      ethers.utils.formatEther(mintPriceWithBuffer),
      "ETH"
    );

    // Attempt to mint
    console.log("\nAttempting to mint...");
    const tx = await curve.mint({
      value: mintPriceWithBuffer,
    });

    // Wait for transaction to be mined
    console.log("Waiting for transaction to be mined...");
    const receipt = await tx.wait();

    // Look for RequestedRandomness event
    const requestEvent = receipt.events?.find(
      (e) => e.event === "RequestedRandomness"
    );
    if (requestEvent) {
      console.log("\nRandomness requested!");
      console.log("Round:", requestEvent.args?.[0].toString());
      console.log("Data:", requestEvent.args?.[1]);
    }

    // Get updated NFT count
    const nftsCount = await curve.nftsCount();
    console.log("\nCurrent NFT count:", nftsCount.toString());

    console.log("\nTransaction hash:", tx.hash);
    console.log("View on Base Sepolia Explorer:");
    console.log(`https://sepolia.basescan.org/tx/${tx.hash}`);

    console.log(
      "\nNote: Gelato will fulfill the randomness request automatically."
    );
    console.log(
      "Check the transaction hash on Base Sepolia Explorer to see the fulfillment."
    );
  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
