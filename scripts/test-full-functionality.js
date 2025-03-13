// scripts/find-white-square.js
const { ethers } = require("hardhat");

async function main() {
  const CURVE_ADDRESS = "0x07CB1cbbcCb8E781D0F439196ea2E7e618B57f64";
  const NFT_ADDRESS = "0x081Baed784b6b4976E41E18d3110874cE26a22E0";

  try {
    const [signer] = await ethers.getSigners();
    const curve = await ethers.getContractAt("Curve", CURVE_ADDRESS);
    const nft = await ethers.getContractAt("ERC721", NFT_ADDRESS);

    console.log(
      "Starting the hunt for an NFT with a white square in the middle (rare NFT)..."
    );
    console.log("Your address:", signer.address);

    let foundRareNFT = false;
    let mintCount = 0;
    let rareTokenId = null;

    // First, check existing NFTs
    const balance = await nft.balanceOf(signer.address);
    console.log("\nYour current NFT balance:", balance.toString());

    if (balance.gt(0)) {
      console.log("Checking your existing NFTs first...");

      for (let i = 0; i < balance; i++) {
        const tokenId = await nft.tokenOfOwnerByIndex(signer.address, i);
        console.log(`Checking token ID ${tokenId.toString()}...`);

        try {
          const isRare = await curve.isRare(tokenId);

          if (isRare) {
            console.log(
              `✅ Token ID ${tokenId.toString()} has a white square in the middle!`
            );
            foundRareNFT = true;
            rareTokenId = tokenId;

            // Get SVG to visualize the NFT
            try {
              const svg = await nft.generateSVGofTokenById(tokenId);
              console.log("\nNFT Visualization:");
              console.log(svg);
            } catch (error) {
              console.log("Couldn't get SVG visualization");
            }

            break;
          }
        } catch (error) {
          console.log("Error checking if NFT is rare:", error.message);
        }
      }
    }

    // If we didn't find one, start minting
    while (!foundRareNFT) {
      mintCount++;
      console.log(`\n💰 Minting NFT #${mintCount}...`);

      const mintPrice = await curve.getCurrentPriceToMint();
      console.log("Mint price:", ethers.utils.formatEther(mintPrice), "ETH");

      // Add a bit extra to cover price increases during transaction
      const mintValue = mintPrice.mul(110).div(100); // Add 10%

      const tx = await curve.mint({
        value: mintValue,
        gasLimit: 500000,
      });

      console.log("Mint transaction:", tx.hash);
      await tx.wait();
      console.log("Minted successfully!");

      // Wait for Gelato to fulfill randomness
      console.log("\nWaiting for Gelato to fulfill randomness...");
      console.log(
        "Press Enter when the NFT has been minted (check your wallet)..."
      );
      await new Promise((resolve) =>
        require("readline").createInterface(process.stdin).question("", resolve)
      );

      // Get the latest token
      const newBalance = await nft.balanceOf(signer.address);
      if (newBalance.gt(balance.add(mintCount - 1))) {
        const tokenId = await nft.tokenOfOwnerByIndex(
          signer.address,
          newBalance.sub(1)
        );
        console.log(`Latest Token ID:`, tokenId.toString());

        // Check if this token has a white square in the middle
        try {
          const isRare = await curve.isRare(tokenId);

          if (isRare) {
            console.log(
              `✅ Success! Token ID ${tokenId.toString()} has a white square in the middle!`
            );
            foundRareNFT = true;
            rareTokenId = tokenId;

            // Get SVG to visualize the NFT
            try {
              const svg = await nft.generateSVGofTokenById(tokenId);
              console.log("\nNFT Visualization:");
              console.log(svg);
            } catch (error) {
              console.log("Couldn't get SVG visualization");
            }

            break;
          } else {
            console.log(
              "This NFT doesn't have a white square in the middle. Continuing..."
            );
          }
        } catch (error) {
          console.error("Error checking if NFT is rare:", error.message);
          console.log("Continuing to mint...");
        }
      } else {
        console.log("Minting appears to have failed. Try again.");
        mintCount--;
      }
    }

    if (foundRareNFT) {
      console.log(
        "\n🎉 Success! Found an NFT with a white square in the middle!"
      );
      console.log("Token ID:", rareTokenId.toString());
      console.log("\nNow hold onto this NFT - don't burn it yet!");

      // Check your total balance
      const finalBalance = await nft.balanceOf(signer.address);
      console.log(`\nYou now have ${finalBalance.toString()} NFTs`);

      // Display the rare prize multiplier
      try {
        const multiplier = await curve.rarePrizeMultiplier();
        console.log(
          `\nThe prize multiplier for white square in the middle is: ${multiplier.toString()}x`
        );

        const currentBurnPrice = await curve.getCurrentPriceToBurn();
        console.log(
          `Current burn price: ${ethers.utils.formatEther(
            currentBurnPrice
          )} ETH`
        );
        console.log(
          `Potential prize if burned: ${ethers.utils.formatEther(
            currentBurnPrice.mul(multiplier)
          )} ETH`
        );
      } catch (error) {
        console.log("Couldn't fetch prize multiplier");
      }
    } else {
      console.log(
        "No NFT with a white square in the middle was found after extensive minting."
      );
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
