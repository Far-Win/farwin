// scripts/test-full-functionality.js
const { ethers } = require("hardhat");

async function main() {
  const CURVE_ADDRESS = "0x13D59843A4e44BE25d1F1471FA6FFadBEe5EcE28";
  const NFT_ADDRESS = "0x2254e1406C26727eAdE8A4e92C035721467B6554";

  async function getBalanceChange(address, action) {
    const balanceBefore = await ethers.provider.getBalance(address);
    await action();
    const balanceAfter = await ethers.provider.getBalance(address);
    return balanceAfter.sub(balanceBefore);
  }

  try {
    const [signer] = await ethers.getSigners();
    const curve = await ethers.getContractAt("Curve", CURVE_ADDRESS);
    const nft = await ethers.getContractAt("ERC721", NFT_ADDRESS);

    console.log("\n1. First let's mint an NFT to test with:");
    const mintPrice = await curve.getCurrentPriceToMint();
    console.log("Mint price:", ethers.utils.formatEther(mintPrice), "ETH");

    const tx = await curve.mint({
      value: mintPrice,
      gasLimit: 500000,
    });

    console.log("Mint transaction:", tx.hash);
    const receipt = await tx.wait();
    console.log("Minted successfully!");

    // Wait for Gelato to fulfill randomness
    console.log("\nWaiting for Gelato to fulfill randomness...");
    console.log(
      "Please wait for the randomness to be fulfilled before continuing."
    );
    console.log(
      "Press Enter when the NFT has been minted (check your wallet)..."
    );
    await new Promise((resolve) =>
      require("readline").createInterface(process.stdin).question("", resolve)
    );

    // Get NFT ID
    const balance = await nft.balanceOf(signer.address);
    console.log("\nYour NFT balance:", balance.toString());

    let tokenId;
    for (let i = 0; i < balance; i++) {
      tokenId = await nft.tokenOfOwnerByIndex(signer.address, i);
      console.log(`Token ID ${i}:`, tokenId.toString());
    }

    if (!tokenId) {
      console.log(
        "No NFT found. Make sure minting was successful before continuing."
      );
      return;
    }

    // Test different burn scenarios
    console.log("\n2. Testing burn functionality:");
    console.log("TokenId:", tokenId.toString());

    // Check if it's a Ukrainian flag
    const isUkrFlag = await curve.isUkrainianFlag(tokenId);
    console.log("Is Ukrainian Flag:", isUkrFlag);

    // Check if it's rare
    const isRare = await curve.isRare(tokenId);
    console.log("Is Rare:", isRare);

    // Get current balance before burn
    const balanceBefore = await ethers.provider.getBalance(signer.address);
    console.log(
      "\nBalance before burn:",
      ethers.utils.formatEther(balanceBefore),
      "ETH"
    );

    // Burn the NFT
    console.log("\nBurning NFT...");
    const burnTx = await curve.burn(tokenId, {
      gasLimit: 500000,
    });

    console.log("Burn transaction:", burnTx.hash);
    const burnReceipt = await burnTx.wait();

    // Wait for Gelato to fulfill randomness again
    console.log("\nWaiting for Gelato to fulfill randomness...");
    console.log("Please wait a moment and check your wallet for any prize...");
    console.log("Press Enter after the burn transaction is complete...");
    await new Promise((resolve) =>
      require("readline").createInterface(process.stdin).question("", resolve)
    );

    // Check final balance
    const balanceAfter = await ethers.provider.getBalance(signer.address);
    console.log(
      "\nBalance after burn:",
      ethers.utils.formatEther(balanceAfter),
      "ETH"
    );

    // Calculate rough balance change (not accounting for gas)
    const balanceChange = balanceAfter.sub(balanceBefore);
    console.log(
      "Balance change:",
      ethers.utils.formatEther(balanceChange),
      "ETH"
    );

    // Check if game ended (lottery win)
    const gameEnded = await curve.gameEnded();
    console.log("\nGame ended (lottery win):", gameEnded);

    // Final NFT balance
    const finalNftBalance = await nft.balanceOf(signer.address);
    console.log("Final NFT balance:", finalNftBalance.toString());

    console.log("\nResults Summary:");
    console.log(
      "- NFT was",
      finalNftBalance.eq(0) ? "successfully burned" : "not burned"
    );
    console.log(
      "- Prize received:",
      ethers.utils.formatEther(balanceChange),
      "ETH"
    );
    if (isUkrFlag) {
      console.log("- Was Ukrainian Flag NFT");
    }
    if (isRare) {
      console.log("- Was Rare NFT");
    }
    if (gameEnded) {
      console.log("- Won the lottery!");
    }
  } catch (error) {
    console.error("Error:", error);
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
