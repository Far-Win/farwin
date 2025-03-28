// scripts/find-black-square.js
const { ethers } = require("hardhat");

async function main() {
  const CURVE_ADDRESS = "0xd7a41D7768797FcA838EA572aB96fCbdD629fbce";
  const NFT_ADDRESS = "0x2Adc62B5A6100eea7804eD7eE9C2F1c5ea056944";

  try {
    const [signer] = await ethers.getSigners();
    const curve = await ethers.getContractAt("Curve", CURVE_ADDRESS);
    const nft = await ethers.getContractAt("ERC721", NFT_ADDRESS);

    console.log(
      "Starting the hunt for an NFT with any black square (rare NFT)..."
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
              `✅ Token ID ${tokenId.toString()} has a black square!`
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

      // Wait for Gelato to fulfill randomness (automatic 1.5 second wait)
      console.log(
        "\nWaiting for Gelato to fulfill randomness... (1.5 seconds)"
      );
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait 1.5 seconds

      // Get the latest token
      const newBalance = await nft.balanceOf(signer.address);
      if (newBalance.gt(balance.add(mintCount - 1))) {
        const tokenId = await nft.tokenOfOwnerByIndex(
          signer.address,
          newBalance.sub(1)
        );
        console.log(`Latest Token ID:`, tokenId.toString());

        // Check if this token has any black square
        try {
          const isRare = await curve.isRare(tokenId);

          if (isRare) {
            console.log(
              `✅ Success! Token ID ${tokenId.toString()} has a black square!`
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
              "This NFT doesn't have any black squares. Continuing..."
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
      console.log("\n🎉 Success! Found an NFT with a black square!");
      console.log("Token ID:", rareTokenId.toString());
      console.log("\nNow hold onto this NFT - don't burn it yet!");

      // Check your total balance
      const finalBalance = await nft.balanceOf(signer.address);
      console.log(`\nYou now have ${finalBalance.toString()} NFTs`);

      // Display the current reserve and potential prize
      try {
        // Get the current reserve - this is what the black square winner gets
        const currentReserve = await curve.reserve();
        console.log(
          `\nCurrent contract reserve: ${ethers.utils.formatEther(
            currentReserve
          )} ETH`
        );
        console.log(
          `When burned, this black square NFT will win the ENTIRE RESERVE and reset the game!`
        );

        // Also show four squares multiplier for comparison
        const fourSquaresMultiplier = await curve.fourSquaresMultiplier();
        console.log(
          `\nFor comparison, NFTs with four same-colored squares get a ${fourSquaresMultiplier}x multiplier of the burn price.`
        );

        const currentBurnPrice = await curve.getCurrentPriceToBurn();
        console.log(
          `Current burn price: ${ethers.utils.formatEther(
            currentBurnPrice
          )} ETH`
        );
        console.log(
          `Four-squares prize if burned: ${ethers.utils.formatEther(
            currentBurnPrice.mul(fourSquaresMultiplier)
          )} ETH`
        );
      } catch (error) {
        console.log("Couldn't fetch prize information:", error.message);
      }
    } else {
      console.log(
        "No NFT with a black square was found after extensive minting."
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
