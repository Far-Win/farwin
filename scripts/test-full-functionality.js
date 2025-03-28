// scripts/test-full-functionality.js
const { ethers } = require("hardhat");

async function main() {
  // 50 Cent Testnet Mints
  // const CURVE_ADDRESS = "0x5097A420aa29F317097ed51DA26D29fAeD1fACD3";
  // const NFT_ADDRESS = "0x6324ec1fc17fCA9Ea5998e48F055f1f9d75AcaCC";

  // Update these addresses with your deployed contracts
  const CURVE_ADDRESS = "0x0038251665CEe91bec97eb2AE6a1C2a0ab1f3B42";
  const NFT_ADDRESS = "0x5d319f0d557F0c6C890407661b7D23Ebb8574199";

  try {
    const [signer] = await ethers.getSigners();
    const curve = await ethers.getContractAt("Curve", CURVE_ADDRESS);
    const nft = await ethers.getContractAt("ERC721", NFT_ADDRESS);

    console.log("Connected to contracts:");
    console.log("- Curve:", CURVE_ADDRESS);
    console.log("- NFT:", NFT_ADDRESS);
    console.log("- Your address:", signer.address);

    // Check contract data
    const nftCount = await curve.getNftCount();
    const whiteSquareCount = await curve.whiteSquareCount();

    const reserve = await curve.reserve();
    const contractBalance = await ethers.provider.getBalance(CURVE_ADDRESS);

    console.log("\nContract Status:");
    console.log(`- NFT Count: ${nftCount.toString()}`);
    console.log(`- White Square Count: ${whiteSquareCount.toString()}`);
    console.log(`- Reserve: ${ethers.utils.formatEther(reserve)} ETH`);
    console.log(
      `- Contract Balance: ${ethers.utils.formatEther(contractBalance)} ETH`
    );

    if (contractBalance.lt(reserve)) {
      console.log(
        "\n⚠️ WARNING: Contract balance is less than recorded reserve!"
      );
      console.log("This may cause issues when trying to burn rare NFTs.");
    }

    // Check if user has NFTs and list them
    const balance = await nft.balanceOf(signer.address);
    console.log(`\nYou have ${balance.toString()} NFTs`);

    if (balance.gt(0)) {
      console.log("\nYour NFTs:");
      console.log(
        "INDEX | TOKEN ID                                                     | WHITE SQUARE | FOUR SAME SQUARES"
      );
      console.log(
        "--------------------------------------------------------------------------------"
      );

      for (let i = 0; i < balance; i++) {
        const tokenId = await nft.tokenOfOwnerByIndex(signer.address, i);
        const isRare = await curve.isRare(tokenId);
        const hasFourSquares = await curve.hasFourSameSquares(tokenId);

        console.log(
          `${i.toString().padEnd(5)} | ${tokenId.toString().padEnd(60)} | ${
            isRare ? "YES" : "NO".padEnd(11)
          } | ${hasFourSquares ? "YES" : "NO"}`
        );
      }

      // Get reward info for each type
      const burnPrice = await curve.getCurrentPriceToBurn();
      const mintPrice = await curve.getCurrentPriceToMint();

      console.log("\nReward Information:");
      console.log(`- Regular NFT Reward: ${ethers.utils.formatEther(0)} ETH`);
      console.log(
        `- Mint Price: ${ethers.utils.formatEther(
          mintPrice
        )} ETH (2× mint price)`
      );
      console.log(
        `- Four Squares Reward: ${ethers.utils.formatEther(
          mintPrice.mul(2)
        )} ETH (2× mint price)`
      );
      console.log(
        `- White Square Reward: ${ethers.utils.formatEther(
          reserve
        )} ETH (entire reserve)`
      );
    }

    // Mint option
    console.log("\nDo you want to:");
    console.log("1. Mint a new NFT");
    console.log("2. Burn an existing NFT");
    console.log("3. Exit");

    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const choice = await new Promise((resolve) => {
      readline.question("Enter your choice (1-3): ", resolve);
    });

    if (choice === "1") {
      // Mint a new NFT
      const mintPrice = await curve.getCurrentPriceToMint();
      console.log(
        `\nMinting a new NFT for ${ethers.utils.formatEther(mintPrice)} ETH...`
      );

      // Add buffer to account for price changes
      const mintValue = mintPrice.mul(110).div(100); // Add 10%

      const tx = await curve.mint({
        value: mintValue,
        gasLimit: 500000,
      });

      console.log("Mint transaction:", tx.hash);
      await tx.wait();
      console.log("Mint transaction confirmed!");

      console.log("\nWaiting for Gelato to fulfill randomness (15 seconds)...");
      let countdown = 15;
      const timer = setInterval(() => {
        process.stdout.write(`${countdown}... `);
        countdown--;
        if (countdown === 0) {
          clearInterval(timer);
          console.log("\nCheck your wallet for the new NFT!");
        }
      }, 1000);

      await new Promise((resolve) => setTimeout(resolve, 15000));
      clearInterval(timer);
    } else if (choice === "2") {
      // Burn an existing NFT
      if (balance.eq(0)) {
        console.log("You don't have any NFTs to burn!");
        readline.close();
        return;
      }

      const tokenIndexStr = await new Promise((resolve) => {
        readline.question(
          "\nEnter the INDEX of the NFT you want to burn: ",
          resolve
        );
      });

      const tokenIndex = parseInt(tokenIndexStr);
      if (isNaN(tokenIndex) || tokenIndex < 0 || tokenIndex >= balance) {
        console.log("Invalid index!");
        readline.close();
        return;
      }

      const tokenId = await nft.tokenOfOwnerByIndex(signer.address, tokenIndex);
      console.log(`\nPreparing to burn token ID: ${tokenId.toString()}`);

      // Approve if needed
      const isApproved = await nft.getApproved(tokenId);
      if (isApproved.toLowerCase() !== CURVE_ADDRESS.toLowerCase()) {
        console.log("Approving NFT for burning...");
        const approveTx = await nft.approve(CURVE_ADDRESS, tokenId);
        await approveTx.wait();
        console.log("Approval complete");
      }

      // Check what type of NFT it is
      const isRare = await curve.isRare(tokenId);
      const hasFourSquares = await curve.hasFourSameSquares(tokenId);
      const mintPrice = await curve.getCurrentPriceToMint();

      let expectedReward;
      if (isRare) {
        console.log("This is a WHITE SQUARE NFT!");
        expectedReward = reserve;
      } else if (hasFourSquares) {
        console.log("This is a FOUR SAME-COLORED SQUARES NFT!");
        expectedReward = mintPrice.mul(2); // 2× the mint price
      } else {
        console.log("This is a REGULAR NFT");
        expectedReward = ethers.BigNumber.from(0); // Regular NFTs get 0
      }

      console.log(
        `Expected reward: ${ethers.utils.formatEther(expectedReward)} ETH`
      );

      // Check if contract has enough balance
      if (contractBalance.lt(expectedReward)) {
        console.log(
          "\n⚠️ WARNING: Contract doesn't have enough ETH to pay the reward!"
        );
        console.log("The burn transaction may fail.");

        const proceed = await new Promise((resolve) => {
          readline.question(
            "Do you want to proceed anyway? (yes/no): ",
            resolve
          );
        });

        if (proceed.toLowerCase() !== "yes") {
          console.log("Burn cancelled");
          readline.close();
          return;
        }
      }

      // Get ETH balance before burn for comparison
      const ethBalanceBefore = await ethers.provider.getBalance(signer.address);

      // Execute burn
      console.log("\nBurning NFT...");
      const burnTx = await curve.burn(tokenId, {
        gasLimit: 500000,
      });

      console.log("Burn transaction:", burnTx.hash);
      const burnReceipt = await burnTx.wait();
      console.log("Burn transaction confirmed!");

      // Wait for Gelato
      console.log("\nWaiting for Gelato to fulfill randomness (15 seconds)...");
      let countdown = 15;
      const timer = setInterval(() => {
        process.stdout.write(`${countdown}... `);
        countdown--;
        if (countdown === 0) {
          clearInterval(timer);
          console.log("\nCheck if the NFT has been removed from your wallet!");
        }
      }, 1000);

      await new Promise((resolve) => setTimeout(resolve, 15000));
      clearInterval(timer);

      // Calculate actual reward
      const ethBalanceAfter = await ethers.provider.getBalance(signer.address);
      const gasCost = burnReceipt.gasUsed.mul(burnReceipt.effectiveGasPrice);
      const ethChange = ethBalanceAfter.sub(ethBalanceBefore).add(gasCost);

      console.log("\nBurn Results:");
      console.log(`- Gas used: ${ethers.utils.formatEther(gasCost)} ETH`);
      console.log(
        `- Balance change (including gas): ${ethers.utils.formatEther(
          ethChange
        )} ETH`
      );

      // Check if the NFT still exists
      try {
        const owner = await nft.ownerOf(tokenId);
        console.log("\n⚠️ NFT is still owned by", owner);
        console.log(
          "Burn was not successful. Gelato may not have fulfilled the randomness yet."
        );
      } catch (error) {
        if (error.message.includes("nonexistent token")) {
          console.log("\n✅ NFT has been successfully burned!");
        } else {
          console.log("Error checking NFT status:", error.message);
        }
      }

      // Check NFT count after burn
      const nftCountAfter = await curve.getNftCount();
      const whiteSquareCountAfter = await curve.whiteSquareCount();

      console.log(`\nNFT Count After: ${nftCountAfter.toString()}`);
      console.log(
        `White Square Count After: ${whiteSquareCountAfter.toString()}`
      );

      if (isRare && nftCountAfter.eq(0)) {
        console.log("\n🎊 GAME RESET! 🎊");
        console.log("You burned a white square NFT and reset the game!");
      }
    } else {
      console.log("Exiting...");
    }

    readline.close();
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
