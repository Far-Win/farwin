const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    console.log("\nWallet address:", deployer.address);

    const balance = await deployer.getBalance();
    console.log(
      "Current wallet balance:",
      ethers.utils.formatEther(balance),
      "ETH"
    );

    // Get contract instances with new addresses
    const curve = await ethers.getContractAt(
      "Curve",
      "0xD1bb25447b75E540cACC3272A3ee54caD5C82Bc6"
    );
    const nft = await ethers.getContractAt(
      "ERC721",
      "0x4caEE863fA45fF37b12dF276531D4892Be34E75a"
    );

    // Verify contract setup
    console.log("\nVerifying contract setup:");

    const nftName = await nft.name();
    const nftSymbol = await nft.symbol();
    console.log("NFT Name:", nftName);
    console.log("NFT Symbol:", nftSymbol);

    const curveNFTAddress = await curve.nft();
    console.log("NFT Address in Curve:", curveNFTAddress);

    const flagMultiplier = await curve.ukrainianFlagPrizeMultiplier();
    const rareMultiplier = await curve.rarePrizeMultiplier();
    console.log("Flag Multiplier:", flagMultiplier.toString());
    console.log("Rare Multiplier:", rareMultiplier.toString());

    // Get current NFT count
    const nftCount = await curve.nftsCount();
    console.log("\nCurrent NFT count:", nftCount.toString());

    // Get the current price to mint
    const mintPrice = await curve.getCurrentPriceToMint();
    console.log(
      "Current mint price:",
      ethers.utils.formatEther(mintPrice),
      "ETH"
    );

    // Calculate reserve cut
    const reserveCut = await curve.getReserveCut();
    console.log(
      "Amount going to reserve:",
      ethers.utils.formatEther(reserveCut),
      "ETH"
    );

    // Add 10% buffer
    const buffer = mintPrice.div(10);
    const totalAmount = mintPrice.add(buffer);

    console.log("\nTransaction details:");
    console.log("Base mint price:", ethers.utils.formatEther(mintPrice), "ETH");
    console.log("Buffer amount:", ethers.utils.formatEther(buffer), "ETH");
    console.log(
      "Total amount needed:",
      ethers.utils.formatEther(totalAmount),
      "ETH"
    );

    if (balance.lt(totalAmount)) {
      console.log("\nERROR: Insufficient balance for minting!");
      console.log("Need:", ethers.utils.formatEther(totalAmount), "ETH");
      console.log("Have:", ethers.utils.formatEther(balance), "ETH");
      return;
    }

    // Mint NFT
    console.log("\nMinting NFT...");
    const mintTx = await curve.mint({
      value: totalAmount,
      gasLimit: 500000,
    });

    console.log("Mint transaction submitted:", mintTx.hash);
    console.log(
      "View on BaseScan:",
      `https://sepolia.basescan.org/tx/${mintTx.hash}`
    );

    const receipt = await mintTx.wait();
    console.log("Transaction mined!");

    // Check for Minted event
    const mintedEvent = receipt.events?.find(
      (event) => event.event === "Minted"
    );
    if (mintedEvent) {
      const [tokenId, pricePaid, reserveAfter] = mintedEvent.args;
      console.log("\nMinting successful!");
      console.log("Token ID:", tokenId.toString());
      console.log("Price paid:", ethers.utils.formatEther(pricePaid), "ETH");
      console.log(
        "Reserve after mint:",
        ethers.utils.formatEther(reserveAfter),
        "ETH"
      );
    }
  } catch (error) {
    console.error("\nError occurred:");
    console.error("Message:", error.message);
    if (error.error) {
      console.error("Additional error details:", error.error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
