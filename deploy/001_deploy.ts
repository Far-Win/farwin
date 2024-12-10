import { HardhatRuntimeEnvironment, Network } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { utils } from "ethers";
import ORACLE_MAP from "../networkVariables";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();
  // get current chainId
  const chainId = parseInt(await hre.getChainId());
  const addresses = ORACLE_MAP[chainId];

  const curve = await deploy("Curve", {
    args: [
      addresses.creator,
      addresses.charity,
      addresses.oracle
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
      value: utils.parseEther('0.001'),
      from: deployer,
      log: true,
    },
    "initialise",
    nft.address
  );
};
export default func;
func.tags = ["ERC721", "Curve"];
