import { HardhatRuntimeEnvironment, Network } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { utils } from "ethers";
import { chainIdToAddresses } from "../networkVariables";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  // get current chainId
  const chainId = parseInt(await hre.getChainId());
  const addresses = chainIdToAddresses[chainId];

  const nft = await deploy("ERC721", {
    args: ["Freedom", "FREE"], // todo: check naming availability
    from: deployer,
    log: true,
  });

  const curve = await deploy("Curve", {
    args: [
      addresses.creator,
      addresses.charity,
      addresses.vrfCoordinatorAddress,
      addresses.linkTokenAddress,
      addresses.vrfKeyHash,
      nft.address,
    ],
    from: deployer,
    log: true,
  });
};
export default func;
func.tags = ["ERC721", "Curve"];
