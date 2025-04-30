const { ethers } = require("hardhat");

async function main() {
  const CURVE_ADDRESS = "0xeB7bA50F91da8cd0Bc33B5593a91e356c91FA5de";
  const NFT_ADDRESS = "0x986d2f8f581248C0525986be782DC07b1d1977DE";
  const MOCK_ERC20_ADDRESS = "0x468ff61d90b022B283A9aeFAb84ed66F79286d11";

  try {
    const [signer] = await ethers.getSigners();
    const curve = await ethers.getContractAt("Curve", CURVE_ADDRESS);
    const nft = await ethers.getContractAt("ERC721", NFT_ADDRESS);
    const mockToken = await ethers.getContractAt("MockERC20", MOCK_ERC20_ADDRESS);

    console.log("Connected to contracts:");
    console.log("- Curve:", CURVE_ADDRESS);
    console.log("- NFT:", NFT_ADDRESS);
    console.log("- Mock ERC20:", MOCK_ERC20_ADDRESS);
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

    // Check if user has NFTs and list them
    const balance = await nft.balanceOf(signer.address);
    console.log(`\nYou have ${balance.toString()} NFTs`);

    console.log("\nDo you want to:");
    console.log("1. Mint a new NFT");
    console.log("2. Check your vesting info");
    console.log("3. Claim vested tokens");
    console.log("4. Recover ERC20 vesting tokens from the Curve");
    console.log("5. Top up the Curve contract with ERC20 vesting tokens");
    console.log("6. Exit");

    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const choice = await new Promise((resolve) => {
      readline.question("Enter your choice (1-4): ", resolve);
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
      const tokenIndexStr = await new Promise((resolve) => {
        readline.question(
          "\nEnter the INDEX of the NFT: ",
          resolve
        );
      });
  
      const tokenIndex = parseInt(tokenIndexStr);
      const tokenId = await nft.tokenOfOwnerByIndex(signer.address, tokenIndex);
  
      const vestingInfo = await nft.getVestingInfo(tokenId);
      const vestingDuration = await nft.VESTING_DURATION_SECS();
  
      console.log("- Vesting Info:");
      console.log("ERC20 token amount:", vestingInfo[0].toString());
      console.log("Vesting started at:", vestingInfo[1].toString());
      console.log("Vesting duration (seconds)", vestingDuration.toString());
      console.log("Vesting token address:", vestingInfo[2]);
    } else if (choice === "3") {
      console.log("\nWaiting for the vesting period to end (60 seconds)");
      await new Promise((resolve) => setTimeout(resolve, 60000));

      const tokenIndexStr = await new Promise((resolve) => {
        readline.question(
          "\nEnter the INDEX of the NFT: ",
          resolve
        );
      });
  
      const tokenIndex = parseInt(tokenIndexStr);
      const tokenId = await nft.tokenOfOwnerByIndex(signer.address, tokenIndex);

      const selfBalance = await mockToken.balanceOf(signer.address);
      console.log(`- ERC20 balance before claim ${ethers.utils.formatEther(selfBalance)}`);
      
      // if the vesting amount is 0, transaction must revert
      const claim = await nft.claimVestedTokens(tokenId);
      console.log("Claim transaction:", claim.hash);
      claim.wait();
      console.log("Claim transaction confirmed!");

      const selfBalanceAfter = await mockToken.balanceOf(signer.address);
      console.log(`- ERC20 balance after claim ${ethers.utils.formatEther(selfBalanceAfter)}`);
    } else if (choice === "4") {
      const recoverAmount = await mockToken.balanceOf(CURVE_ADDRESS);

      const recover = await curve.recoverVestingTokens(recoverAmount);
      console.log("Recover Vesting Tokens transaction:", recover.hash);
      recover.wait();
      console.log("Recover transaction confirmed!");
    } else if (choice === "5") {
      const amount = ethers.utils.parseEther("5");
      const transfer = await mockToken.transfer(CURVE_ADDRESS, amount);
      
      console.log("Transfer transaction:", transfer.hash);
      await transfer.wait();
      console.log("Transfer transaction confirmed!");
    }
    else {
      console.log("Exiting...");
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