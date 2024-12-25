// deploy/01_deploy_curve.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { chainIdToAddresses } from "../networkVariables";

const GELATO_OPERATOR = "0x1F919E17bB2f322bd1ed5Bf822988C37162CF46c";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  // get current chainId
  const chainId = parseInt(await hre.getChainId());
  const addresses = chainIdToAddresses[chainId];

  // Deploy Curve first with Gelato operator
  const curve = await deploy("Curve", {
    args: [
      deployer, // creator (using deployer address)
      deployer, // charity (using deployer address)
      GELATO_OPERATOR, // Gelato operator address
    ],
    from: deployer,
    log: true,
  });

  // Deploy NFT
  const nft = await deploy("ERC721", {
    args: ["Freedom", "FREE", "test.com/", curve.address],
    from: deployer,
    log: true,
  });

  // Initialize NFT in Curve contract
  await execute(
    "Curve",
    {
      from: deployer,
      log: true,
    },
    "initNFT",
    nft.address
  );

  // Set initial prize multipliers
  await execute(
    "Curve",
    {
      from: deployer,
      log: true,
    },
    "setPrizeMultipliers",
    2, // flag multiplier
    5 // rare multiplier
  );

  console.log("Deployment completed:");
  console.log("Curve deployed to:", curve.address);
  console.log("NFT deployed to:", nft.address);
  console.log("Deployer address:", deployer);
};

export default func;
func.tags = ["ERC721", "Curve"];
