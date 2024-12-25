// scripts/debug-mint.js
const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const CURVE_ADDRESS = "0xf00EDA55265Ae63e570d7d0db17C1D2B99E6880E";

  try {
    const [signer] = await ethers.getSigners();
    const curve = await ethers.getContractAt("Curve", CURVE_ADDRESS, signer);

    // Get mint price
    const mintPrice = ethers.utils.parseEther("0.001");
    const mintPriceWithBuffer = mintPrice.mul(110).div(100);

    console.log("Attempting to mint with detailed debugging...");
    console.log("Mint price:", ethers.utils.formatEther(mintPrice), "ETH");
    console.log(
      "Price with buffer:",
      ethers.utils.formatEther(mintPriceWithBuffer),
      "ETH"
    );

    // Try mint with explicit parameters
    const tx = await curve.mint({
      value: mintPriceWithBuffer,
      gasLimit: 500000,
      gasPrice: await ethers.provider.getGasPrice(),
    });

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("\nTransaction confirmed!");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Check for events
    console.log("\nEvents emitted:");
    for (const event of receipt.events || []) {
      try {
        console.log(`Event: ${event.event}`);
        console.log("Args:", event.args);
      } catch (e) {
        console.log("Raw log:", event);
      }
    }
  } catch (error) {
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      reason: error.reason,
      data: error.data,
      transaction: error.transaction
        ? {
            from: error.transaction.from,
            to: error.transaction.to,
            value: error.transaction.value?.toString(),
            data: error.transaction.data,
          }
        : null,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
