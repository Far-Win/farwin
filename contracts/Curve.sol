// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "abdk-libraries-solidity/ABDKMathQuad.sol";
import "./gelato/GelatoVRFConsumerBase.sol";

contract Curve is GelatoVRFConsumerBase, Ownable {
  using SafeMath for uint256;
  using ABDKMathQuad for bytes16;

  // linear bonding curve
  // 99.5% going into reserve.
  // 0.5% going to creator.

  bytes16 internal LMIN;
  bytes16 internal LMAX;
  bytes16 internal T;
  bytes16 internal b;
  bytes16 internal constant ONE_TOKEN_BYTES =
    0x403abc16d674ec800000000000000000;

  struct Request {
    bool isMint;
    address _address;
    uint256 _price;
    uint256 _reserve;
    uint256 _tokenId;
  }

  mapping(uint256 => Request) public requests;
  uint256 public nftsCount;

  // uint256 public FiveSquaresMultiplier;
  // uint256 public rarePrizeMultiplier;
  uint256 public whiteSquareCount;
  uint256 public fiveSquaresCount;

  uint256 public vestingAmountPerUser;

  // this is currently 0.5% of the mint price
  uint256 public constant initMintPrice = 0.00005 ether; // at 0
  // uint256 public constant mintPriceMove = 0.002 ether / 16000;
  uint256 constant CREATOR_PERCENT = 50;
  uint256 constant CHARITY_PERCENT = 150;
  uint256 constant DENOMINATOR = 1000;

  // You technically do not need to keep tabs on the reserve
  // because it uses linear pricing
  // but useful to know off-hand. Especially because this.balance might not be the same as the actual reserve
  uint256 public reserve;

  address public immutable vestingToken;

  address payable public immutable creator;
  address payable public immutable charity;
  address private immutable operator;

  function convert(uint256 value) public pure returns (bytes16) {
    return ABDKMathQuad.fromUInt(value);
  }

  ERC721 public nft;

  event CurveCreated(
    address indexed creator
  );

  event Minted(
    uint256 indexed tokenId,
    uint256 indexed pricePaid,
    uint256 indexed reserveAfterMint,
    bool isWhiteSquare,
    bool isFiveSquares
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
  event MintRequested(address indexed requester, uint256 indexed requestId);

  constructor(
    address payable _creator,
    address payable _charity,
    address _operator,
    address _vestingToken,
    uint256 _vestingAmountPerUser
  ) {
    require(_creator != address(0), "Invalid creator address"); // Gelato operator address
    require(_charity != address(0), "Invalid charity address");
    require(_operator != address(0), "Invalid operator address");

    creator = _creator;
    charity = _charity;
    operator = _operator; // Gelato operator address
    vestingToken = _vestingToken; // we're not checking for zero address, because vesting token is optional
    vestingAmountPerUser = _vestingAmountPerUser;

    LMIN = ABDKMathQuad.fromUInt(10); // Price approaches 0.15 ETH ($150)
    LMAX = ABDKMathQuad.fromUInt(1); // First mint is 0.001 ETH ($1)
    T = ABDKMathQuad.fromUInt(50); // Controls curve shape
    b = ABDKMathQuad.fromUInt(100);

    emit CurveCreated(creator);
  }

  modifier NftInitialized() {
    require(address(nft) != address(0), "NFT not initialized");
    _;
  }

  function _operator() internal view override returns (address) {
    return operator;
  }

  // function setPrizeMultipliers(
  //   uint256 _fiveSquaresMultiplier,
  //   uint256 _rareMultiplier
  // ) public onlyOwner {
  //   require(
  //     _fiveSquaresMultiplier != 0 && _rareMultiplier != 0,
  //     "Curve: Multipliers cannot be zero."
  //   );
  //   require(
  //     2 <= _fiveSquaresMultiplier && _fiveSquaresMultiplier <= 8,
  //     "Curve: Five squares multiplier must be between 2 and 8"
  //   );
  //   require(
  //     5 <= _rareMultiplier && _rareMultiplier <= 40,
  //     "Curve: Rare multiplier must be between 5 and 40"
  //   );

  //   fiveSquaresMultiplier = _fiveSquaresMultiplier;
  //   rarePrizeMultiplier = _rareMultiplier;
  // }

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

  function mint() external payable virtual NftInitialized {
    // require(!gameEnded, "C: Game ended");
    // you can only mint one at a time.
    require(msg.value > 0, "C: No ETH sent");

    uint256 mintPrice = getCurrentPriceToMint();
    require(msg.value >= mintPrice, "C: Not enough ETH sent");

    // Store request details before requesting randomness
    uint256 requestId = _requestRandomness("");
    emit MintRequested(msg.sender, requestId);
    nftsCount++;

    // Calculate exact amounts for each recipient
    uint256 creatorAmount = mintPrice.mul(CREATOR_PERCENT).div(DENOMINATOR);
    uint256 charityAmount = mintPrice.mul(CHARITY_PERCENT).div(DENOMINATOR);

    // Calculate reserve amount (ensures accurate accounting)
    uint256 reserveCut = mintPrice.sub(creatorAmount).sub(charityAmount);
    reserve = reserve.add(reserveCut);

    requests[requestId].isMint = true;
    requests[requestId]._address = msg.sender;
    requests[requestId]._price = mintPrice;
    requests[requestId]._reserve = reserve;

    bool success;
    (success, ) = creator.call{ value: creatorAmount }("");
    require(success, "Unable to send to creator");

    (success, ) = charity.call{ value: charityAmount }("");
    require(success, "Unable to send to charity");

    uint256 buffer = msg.value.sub(mintPrice); // excess/padding/buffer
    if (buffer > 0) {
      (success, ) = msg.sender.call{ value: buffer }("");
      require(success, "Unable to send buffer back");
    }
  }

  function _fulfillRandomness(
    uint256 randomness,
    uint256 requestId,
    bytes memory /* extraData */
  ) internal override {
    if (requests[requestId].isMint) {
      uint256 tokenId;
      if (vestingToken != address(0) && IERC20(vestingToken).balanceOf(address(this)) >= vestingAmountPerUser) {
        // mint first to increase supply
        tokenId = nft.mint(requests[requestId]._address, randomness, vestingAmountPerUser, vestingToken);
        require(
          IERC20(vestingToken).transfer(address(nft), vestingAmountPerUser),
          "ERC20 transfer failed"
        );
      } else {
        // mint first to increase supply
        tokenId = nft.mint(requests[requestId]._address, randomness, 0, address(0));
      }
      if (hasFiveSameSquares(tokenId)) {
        fiveSquaresCount++;
      }

      emit Minted(
        tokenId,
        requests[requestId]._price,
        requests[requestId]._reserve,
        isRare(tokenId),
        hasFiveSameSquares(tokenId)
      );
    } else {
      // Burn
      uint256 burnPrice;
      uint256 tokenId = requests[requestId]._tokenId;

      if (isRare(tokenId)) {
        // White square in the middle wins the entire reserve and resets the game
        burnPrice = reserve; // Reset the reserve to 0 since we're paying everything out
        nftsCount = 0; // Reset NFT count to 0
        whiteSquareCount++;

        emit Lottery(tokenId, randomness, true, burnPrice);
      } else if (hasFiveSameSquares(tokenId)) {
        // 4 squares of the same color wins the fiveSquaresMultiplier
        burnPrice = getCurrentPriceToMint().mul(2);
        nftsCount--; // Only decrement for non-rare NFTs
        fiveSquaresCount--;
      } else {
        // Regular burn - just return the burn price
        burnPrice = 0;
        nftsCount--; // Only decrement for non-rare NFTs
      }

      nft.burn(requests[requestId]._address, tokenId);

      if (!isRare(tokenId)) {
        emit Lottery(tokenId, randomness, false, burnPrice);
      }

      reserve = reserve.sub(burnPrice);
      (bool success, ) = requests[requestId]._address.call{ value: burnPrice }(
        ""
      );
      require(success, "Unable to send burnPrice");

      emit Burned(tokenId, burnPrice, reserve);
    }
  }

  function burn(uint256 tokenId) external virtual NftInitialized {
    if (hasFiveSameSquares(tokenId)) {
      require(
        nftsCount > 1,
        "Cannot burn five squares when only 1 NFT remains"
      );
    }
    uint256 requestId = _requestRandomness("");

    requests[requestId]._address = msg.sender;
    requests[requestId]._tokenId = tokenId;
  }

  // Rest of your helper functions remain the same
  function isRare(uint256 tokenId) public view returns (bool) {
    // Get the SVG representation of the token to check if white is in the middle
    string memory svgImage = nft.generateSVGofTokenById(tokenId);

    // Check if the middle square (index 4) is white
    bytes memory bhash = abi.encodePacked(bytes32(tokenId));

    // The white color is at index 5 in the palette (palette[5])
    // Each color is determined by dividing the byte value by 51
    return toUint8(bhash, 4) / 51 == 5; // Check if middle square is white
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

  function hasFiveSameSquares(uint256 tokenId) public pure returns (bool) {
    bytes memory bhash = abi.encodePacked(bytes32(tokenId));

    // Count occurrences of each color (0-5 in the palette)
    uint8[6] memory colorCounts;

    for (uint256 i = 0; i < 9; i++) {
      uint8 colorIndex = toUint8(bhash, i) / 51;
      if (colorIndex < 6) {
        // Make sure it's within our palette range
        colorCounts[colorIndex]++;

        // If we found 5 of any color, return true
        if (colorCounts[colorIndex] >= 5) {
          return true;
        }
      }
    }

    return false;
  }

  // if supply 0, mint price = 0.002
  function getCurrentPriceToMint() public view virtual returns (uint256) {
    return
      ABDKMathQuad.toUInt(
        ABDKMathQuad.mul(
          ABDKMathQuad.fromUInt(initMintPrice),
          ABDKMathQuad.add(
            LMIN,
            ABDKMathQuad.mul(
              ABDKMathQuad.sub(LMAX, LMIN),
              ABDKMathQuad.exp(
                ABDKMathQuad.neg(
                  ABDKMathQuad.div(
                    ABDKMathQuad.mul(
                      ABDKMathQuad.fromUInt(nftsCount),
                      ABDKMathQuad.fromUInt(nftsCount)
                    ),
                    ABDKMathQuad.mul(b, T)
                  )
                )
              )
            )
          )
        )
      );
  }

  // helper function for legibility
  function getReserveCut() public view virtual returns (uint256) {
    return getCurrentPriceToBurn();
  }

  function getNftCount() public view virtual returns (uint256) {
    return nftsCount;
  }

  function getWhiteSquareCount() public view virtual returns (uint256) {
    return whiteSquareCount;
  }

  // if supply 1, then burn price = 0.000995
  function getCurrentPriceToBurn() public view virtual returns (uint256) {
    uint256 burnPrice = getCurrentPriceToMint();
    burnPrice -= (burnPrice.mul(CREATOR_PERCENT.add(CHARITY_PERCENT))).div(
      DENOMINATOR
    );
    return burnPrice;
  }

  function initNFT(ERC721 _nft) external onlyOwner {
    require(address(nft) == address(0), "Already initiated");
    nft = _nft;
  }

  function setVestingDistributionAmount(uint256 _vestingAmountPerUser) external onlyOwner {
    require(_vestingAmountPerUser > 0, "Vesting amount must be greater than 0");

    vestingAmountPerUser = _vestingAmountPerUser;
  }

  function recoverVestingTokens(uint256 amount) external onlyOwner {
    require(IERC20(vestingToken).balanceOf(address(this)) >= amount, "Insufficient balance");

    IERC20(vestingToken).transfer(msg.sender, amount);
  }
}
