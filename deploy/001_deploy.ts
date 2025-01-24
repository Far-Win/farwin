import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { chainIdToAddresses } from "../networkVariables";
import { AutomateSDK, TriggerType } from "@gelatonetwork/automate-sdk";
import { ethers } from "hardhat";

const GELATO_OPERATOR = "0x1F919E17bB2f322bd1ed5Bf822988C37162CF46c";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = parseInt(await hre.getChainId());
  const addresses = chainIdToAddresses[chainId];
  const [deployer1] = await ethers.getSigners();
  //@ts-ignore
  const automate = new AutomateSDK(chainId, deployer1);

  const curve = await deploy("Curve", {
    skipIfAlreadyDeployed: false,
    args: [deployer, deployer, GELATO_OPERATOR],
    from: deployer,
    log: true,
  });

  const nft = await deploy("ERC721", {
    skipIfAlreadyDeployed: false,
    args: ["Freedom", "FREE", "test.com/", curve.address],
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

  await execute(
    "Curve",
    {
      from: deployer,
      log: true,
    },
    "setPrizeMultipliers",
    2,
    5
  );

  // Create Gelato Automate task for VRF
  const curveContract = await hre.ethers.getContract("Curve");

  console.log("Creating VRF automate task...");
  const { taskId, tx } = await automate.createBatchExecTask({
    name: "Curve VRF",
    web3FunctionHash: "QmWm8Uq2UYRAVwFyzWop2Hghj56WhJk7K8hGGC2Jy7rzDo", // Replace with your Web3 Function hash
    web3FunctionArgs: { consumerAddress: curve.address },
    trigger: {
      type: TriggerType.EVENT,
      filter: {
        topics: [
          [curveContract.interface.getEventTopic("RequestedRandomness")],
        ],
        address: curve.address,
      },
      blockConfirmations: chainId === 1 ? 1 : 0,
    },
  });

  await tx.wait();
  console.log(`Task created, taskId: ${taskId} (tx hash: ${tx.hash})`);
  console.log(
    `> https://vrf.app.gelato.network/task/${taskId}?chainId=${chainId}`
  );

  console.log("Deployment completed:");
  console.log("Curve deployed to:", curve.address);
  console.log("NFT deployed to:", nft.address);
  console.log("Deployer address:", deployer);
};

export default func;
func.tags = ["ERC721", "Curve"];
