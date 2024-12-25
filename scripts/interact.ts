// scripts/interact.ts
import { ethers } from "hardhat";
async function main() {
  const curve = await ethers.getContract("Curve");

  // Get mint price
  const mintPrice = await curve.getCurrentPriceToMint();
  console.log("Mint price:", ethers.utils.formatEther(mintPrice));

  // Mint a token
  const tx = await curve.mint({ value: mintPrice });
  const receipt = await tx.wait();

  // Look for RequestedRandomness event
  const requestEvent = receipt.events?.find(
    (e) => e.event === "RequestedRandomness"
  );
  console.log("Randomness requested:", requestEvent?.args);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
