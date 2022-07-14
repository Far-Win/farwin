import { HardhatRuntimeEnvironment, Network } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { utils } from "ethers";
import { chainIdToAddresses } from "../networkVariables";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();
  // get current chainId
  const chainId = parseInt(await hre.getChainId());
  const addresses = chainIdToAddresses[chainId];

  const curve = await deploy("Curve", {
    args: [
      addresses.creator,
      addresses.charity,
      addresses.vrfCoordinatorAddress,
      addresses.linkTokenAddress,
      addresses.vrfKeyHash,
      addresses.vrfFee,
    ],
    from: deployer,
    log: true,
  });

  const nft = await deploy("ERC721", {
    args: ["Freedom", "FREE", "test.com/", curve.address], // todo: check naming availability
    from: deployer,
    log: true,
  });

  await execute(
    "Curve",
    {
      from: deployer,
      log: true,
    },
    "initNFT",
    nft.address
  );
};
export default func;
func.tags = ["ERC721", "Curve"];
