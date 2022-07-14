// SPDX-License-Identifier: MIT

pragma solidity 0.7.0;

import "./ERC721.sol";
import "./utils/SafeMath.sol";
import "./chainlink/VRFConsumerBase.sol";

contract Curve is VRFConsumerBase {
    using SafeMath for uint256;
    // linear bonding curve
    // 99.5% going into reserve.
    // 0.5% going to creator.

    bytes32 internal keyHash;
    uint256 internal fee;

    struct Request {
        address _address;
        uint256 _mintPrice;
        uint256 _reserve;
    }

    mapping(bytes32 => Request) public requests;
    uint256 public nftsCount;
    bool public gameEnded;

    // this is currently 0.5%
    uint256 public constant initMintPrice = 0.002 ether; // at 0
    uint256 public constant mintPriceMove = 0.002 ether / 16000;
    uint256 constant CREATOR_PERCENT = 15;
    uint256 constant CHARITY_PERCENT = 200;
    uint256 constant DENOMINATOR = 1000;

    // You technically do not need to keep tabs on the reserve
    // because it uses linear pricing
    // but useful to know off-hand. Especially because this.balance might not be the same as the actual reserve
    uint256 public reserve;

    address payable public creator;
    address payable public charity;

    ERC721 public nft;

    event Minted(
        uint256 indexed tokenId,
        uint256 indexed pricePaid,
        uint256 indexed reserveAfterMint
    );
    event Burned(
        uint256 indexed tokenId,
        uint256 indexed priceReceived,
        uint256 indexed reserveAfterBurn
    );
    event Lottery(
        uint256 indexed tokenId,
        uint256 indexed lotteryId,
        bool isWinner,
        uint256 indexed prizeAmount
    );

    constructor(
        address payable _creator,
        address payable _charity,
        address _coordinator,
        address _link,
        bytes32 _keyHash,
        uint256 _vrfFee,
        ERC721 _nft
    )
        VRFConsumerBase(
            _coordinator, // VRF Coordinator
            _link // LINK Token
        )
    {
        require(_creator != address(0));
        require(_charity != address(0));

        creator = _creator;
        charity = _charity;

        nft = _nft;

        keyHash = _keyHash;
        fee = _vrfFee; // (Varies by network)
    }

    /*
        With one mint front-runned, a front-runner will make a loss.
        With linear price increases of 0.001, it's not profitable.
        BECAUSE it costs 0.012 ETH at 50 gwei to mint (storage/smart contract costs) + 0.5% loss from creator fee.

        It becomes more profitable to front-run if there are multiple buys that can be spotted
        from multiple buyers in one block. However, depending on gas price, it depends how profitable it is.
        Because the planned buffer on the front-end is 0.01 ETH, it's not profitable to front-run any normal amounts.
        Unless, someone creates a specific contract to start bulk minting.
        To curb speculation, users can only mint one per transaction (unless you create a separate contract to do this).
        Thus, ultimately, at this stage, while front-running can be profitable,
        it is not generally feasible at this small scale.

        Thus, for the sake of usability, there's no additional locks here for front-running protection.
        A lock would be to have a transaction include the current price:
        But that means, that only one neolastic per block would be minted (unless you can guess price rises).
    */
    function mint() public payable virtual returns (bytes32 _requestId) {
        require(!gameEnded, "C: Game ended");
        // you can only mint one at a time.
        require(LINK.balanceOf(address(this)) >= fee, "C: Not enough LINK");
        require(msg.value > 0, "C: No ETH sent");

        uint256 mintPrice = getCurrentPriceToMint();
        require(msg.value >= mintPrice, "C: Not enough ETH sent");

        _requestId = requestRandomness(keyHash, fee);
        nftsCount++;

        // disburse
        uint256 reserveCut = getReserveCut();
        reserve = reserve.add(reserveCut);

        requests[_requestId]._address = msg.sender;
        requests[_requestId]._mintPrice = mintPrice;
        requests[_requestId]._reserve = reserve;

        bool success;
        (success, ) = creator.call{
            value: mintPrice.mul(CREATOR_PERCENT).div(DENOMINATOR)
        }("");
        require(success, "Unable to send to creator");
        (success, ) = charity.call{
            value: mintPrice.mul(CHARITY_PERCENT).div(DENOMINATOR)
        }("");
        require(success, "Unable to send to charity");

        uint256 buffer = msg.value.sub(mintPrice); // excess/padding/buffer
        if (buffer > 0) {
            (success, ) = msg.sender.call{value: buffer}("");
            require(success, "Unable to send buffer back");
        }

        return _requestId;
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness)
        internal
        override
    {
        // mint first to increase supply
        uint256 tokenId = nft.mint(requests[requestId]._address, randomness);
        emit Minted(
            tokenId,
            requests[requestId]._mintPrice,
            requests[requestId]._reserve
        );
    }

    function burn(uint256 tokenId) public virtual {
        uint256 burnPrice;

        bytes32 hashed = keccak256(
            abi.encodePacked(
                blockhash(block.number - 1),
                block.timestamp,
                msg.sender
            )
        );
        uint256 lotteryId = uint256(hashed);

        if (isRare(tokenId)) {
            burnPrice = getCurrentPriceToBurn().mul(5);
        } else if (isUkrainianFlag(tokenId)) {
            burnPrice = getCurrentPriceToBurn().mul(2);
        } else {
            require(reserve > 0, "Reserve should be > 0");

            string memory lotteryImage = nft.generateSVGofTokenById(lotteryId);
            string memory tokenImage = nft.generateSVGofTokenById(tokenId);
            if (
                keccak256(abi.encodePacked(lotteryImage)) ==
                keccak256(abi.encodePacked(tokenImage))
            ) {
                burnPrice = reserve;
                gameEnded = true;
                emit Lottery(tokenId, lotteryId, true, burnPrice);
            }
        }

        nft.burn(msg.sender, tokenId);
        nftsCount--;
        emit Lottery(tokenId, lotteryId, false, burnPrice);

        reserve = reserve.sub(burnPrice);
        (bool success, ) = msg.sender.call{value: burnPrice}("");
        require(success, "Unable to send burnPrice");

        emit Burned(tokenId, burnPrice, reserve);
    }

    function isRare(uint256 tokenId) public pure returns (bool) {
        bytes memory bhash = abi.encodePacked(bytes32(tokenId));
        for (uint256 i = 0; i < 6; i++) {
            if (toUint8(bhash, i) / 51 == 5) {
                return true;
            }
        }
        return false;
    }

    function isUkrainianFlag(uint256 tokenId) public pure returns (bool) {
        bytes memory bhash = abi.encodePacked(bytes32(tokenId));

        if (toUint8(bhash, 0) / 51 == 1 && toUint8(bhash, 1) / 51 == 3) {
            return true;
        } else if (toUint8(bhash, 2) / 51 == 1 && toUint8(bhash, 3) / 51 == 3) {
            return true;
        } else if (toUint8(bhash, 4) / 51 == 1 && toUint8(bhash, 5) / 51 == 3) {
            return true;
        }

        return false;
    }

    // helper function for generation
    // from: https://github.com/GNSPS/solidity-bytes-utils/blob/master/contracts/BytesLib.sol
    function toUint8(bytes memory _bytes, uint256 _start)
        internal
        pure
        returns (uint8)
    {
        require(_start + 1 >= _start, "toUint8_overflow");
        require(_bytes.length >= _start + 1, "toUint8_outOfBounds");
        uint8 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x1), _start))
        }

        return tempUint;
    }

    // if supply 0, mint price = 0.002
    function getCurrentPriceToMint() public view virtual returns (uint256) {
        uint256 mintPrice = initMintPrice.add(nftsCount.mul(mintPriceMove));
        return mintPrice;
    }

    // helper function for legibility
    function getReserveCut() public view virtual returns (uint256) {
        return getCurrentPriceToBurn();
    }

    // if supply 1, then burn price = 0.000995
    function getCurrentPriceToBurn() public view virtual returns (uint256) {
        uint256 burnPrice = getCurrentPriceToMint();
        burnPrice -= (burnPrice.mul(CREATOR_PERCENT.add(CHARITY_PERCENT))).div(
            DENOMINATOR
        );
        return burnPrice;
    }
}
