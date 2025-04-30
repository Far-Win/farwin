async function getDataWithRound(requestId) {
    const timeNow = (await ethers.provider.getBlock("latest")).timestamp;
    const round = Math.floor((timeNow - 1692803367) / 3) + 2;

    const data = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "bytes"],
        [requestId, []]
    );

    const dataWithRound = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "bytes"],
        [round, data]
    );

    return dataWithRound;
}

module.exports = getDataWithRound;