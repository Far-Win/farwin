// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import 'abdk-libraries-solidity/ABDKMathQuad.sol';
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IWitnetRandomnessV2.sol";
import "./ERC721.sol";

contract Curve is Ownable {
    using SafeMath for uint256;
    using ABDKMathQuad for bytes16;

    enum Epoch { Init, Open, Pending, Closed };

    mapping (uint16 => uint256) public tokenIds;
    // linear bonding curve
    // 99.5% going into reserve.
    // 0.5% going to creator.
    uint256 constant OPEN_EPOCH = 5 days;
    uint256 constant PENDING_EPOCH = 1 days;
    uint256 constant REDEEM_EPOCH = 1 days;
    uint256 constant WEEKLY_CYCLE = OPEN_PERIOD + PENDING_PERIOD + CLOSED_PERIOD;

    bytes16 internal constant LMIN = 0x40010000000000000000000000000000;
    bytes16 internal constant LMAX = 0x3fff0000000000000000000000000000;
    bytes16 internal constant T = 0x401124f8000000000000000000000000;
    bytes16 internal constant b = 0x3ffb2a5cd80b02065168267ecaae600a;
    bytes16 internal constant ONE_TOKEN_BYTES = 0x403abc16d674ec800000000000000000;

    uint256 public constant initMintPrice = 0.05 ether; 
    uint256 constant CREATOR_PERCENT = 50;
    uint256 constant CHARITY_PERCENT = 150;
    uint256 constant DENOMINATOR = 1000;

    uint256 public reserve;
    uint256 public winningTokenId;
    uint256 public totalSupply;
    uint256 public lastBlockSync;
    uint256 public rarePrizeMultiplier;
    uint256 public ukrainianFlagPrizeMultiplier;

    address payable public immutable creator;
    address payable public immutable charity;

    IWitnetRandomnessV2 immutable public witnet;

    ERC721 public nft;

    bool public hasRolled;
    bool public hasStarted;

    event Roll(
      uint256 indexed totalNfts,
      uint256 indexed reserveAtRoll
    );

    event Reveal(
      uint256 indexed tokenId,
      uint256 indexed entropyValue 
    );

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
        bool isWinner,
        uint256 indexed tokenId,
        uint256 indexed lotteryId,
        uint256 indexed prizeAmount
    );

    constructor(
        address oracle,
        address payable _creator,
        address payable _charity,
    ) public {
        require(_creator != address(0));
        require(_charity != address(0));
        require(_oracle != address(0));

        creator = _creator;
        charity = _charity;
        admin = msg.sender;

        witnet = IWitnetRandomnessV2(_oracle);
    }

    modifier isPhase(Epoch memory e) {
        require(currentEpoch() == e, "C: Invalid epoch");
        _;
    }

    modifier isInitialised() {
        require(address(nft) != address(0), "C: Not initialised");
        _;
    }

    modifier isRandomnessReady() {
        require(witnet.isRandomized(lastBlockSync), "C: Randomness not ready");
        _;
    }

    function random(uint256 range) public view returns (uint256) {
        bytes32 randomness = witnet.fetchRandomnessAfter(lastBlockSync);
        bytes32 entropy = keccak256(abi.encodePacked(block.prevrandao, randomness));
        
        return uint256(entropy) % range;
    }

    function currentEpoch() public view returns (Epoch) {
        uint256 timeInCycle = block.timestamp % WEEKLY_CYCLE;

        if (!hasStarted) {
          return Epoch.Init;
        } else if (timeInCycle < OPEN_EPOCH) {
          return Epoch.Open;
        } else if (timeInCycle < OPEN_EPOCH + PENDING_EPOCH) {
          return Epoch.Pending;
        } else {
          return Epoch.Closed;
        }
    }

    function roll() isPhase(Epoch.Pending) public {
        require(!isRolled, "C: Already rolled, must reveal");
        require(winningTokenId == 0, "C: Winner already chosen");
    
        requestRandomness(msg.value);

        isRolled = true;

        emit Roll(totalSupply, reserve);
    }

    function reveal() isRandomnessReady isPhase(Epoch.Pending) public payable {
        require(isRolled, "C: Not rolled, must roll");
        require(winningTokenId == 0, "C: Winner already chosen");

        uint256 index = random(totalSupply);

        isRolled = false;
        winningTokenId = index;

        requestRandomness(msg.value);

        emit Reveal(tokenIds[winningTokenId], index);
    }

    /*
      Front-running is unprofitable with one mint due to 0.012 ETH cost (50 gwei gas + creator fee loss).
      A 0.001 ETH linear price increase doesn't make it worthwhile. 
      Front-running becomes profitable with multiple mints from different buyers in a block, but this depends on gas prices. 
      A 0.01 ETH front-end buffer reduces profitability for normal mints unless using a custom contract for bulk minting. 
      Users can only mint one per transaction, preventing speculation unless using a separate contract. 
      While front-running can be profitable, it's not feasible at small scales. 
      No front-running protection locks are added to avoid limiting usability, as including current prices would restrict mints to one per block.
    */

    function mint()
        external
        payable
        virtual
        isIntialised
        isRandomnessReady
        isPhase(Epoch.Open)
        returns (uint256 _tokenId)
    {
        if (winningTokenId > 0) winningTokenId = 0;

        uint256 mintPrice = getCurrentPriceToMint();

        require(msg.value > 0, "C: No ETH sent");
        require(msg.value >= mintPrice, "C: Not enough ETH sent");

        uint256 creatorCut = mintPrice.mul(CREATOR_PERCENT).div(DENOMINATOR);
        uint256 charityCut = mintPrice.mul(CHARITY_PERCENT).div(DENOMINATOR);
        uint256 reserveCut = getReserveCut();

        reserve = reserve.add(reserveCut);

        bool success;

        (success, ) = creator.call{ value: creatorCut }("");
        require(success, "Unable to send to creator");
        (success, ) = charity.call{ value: charityCut }("");
        require(success, "Unable to send to charity");

        uint256 remainder = msg.value.sub(mintPrice); 
        uint256 entropy = random(2 ** 256 - 1);

        _tokenId = nft.mint(msg.sender, entropy);

        requestRandomness(remainder);

        tokenIds[nftsCount] = _tokenId;
        totalSupply = totalSupply + 1;
        
        emit Minted(_tokenId, mintPrice, reserve);
    }

    function burn(uint256 tokenId) payable external 
        isInitialised 
        isEpoch(Epoch.Closed) 
    {
        require(tokenIds[winningTokenId] == tokenId, "C: Invalid winning token"); 

        uint256 burnPrice;

        if (isRare(tokenId)) {
          burnPrice = reserve;

          emit Lottery(true, tokenId, burnPrice);
        } else {
          if (isUkrainianFlag(tokenId)) {
            burnPrice = getCurrentPriceToBurn().mul(ukrainianFlagPrizeMultiplier);
          } else {
            burnPrice = getCurrentPriceToBurn().mul(rarePrizeMultiplier);
          }

          emit Lottery(false, tokenId, burnPrice);
        }

        uint256 lastId = tokenIds[totalSupply];
        uint256 winningId = tokenIds[winningTokenId];

        delete tokenIds[totalSupply];
        delete winningTokenId;

        totalSupply = totalSupply - 1;
        tokenIds[winningId] = lastId;

        nft.burn(msg.sender, tokenId); 

        reserve = reserve.sub(burnPrice);
        
        if (burnPrice > 0) {
          (bool success, ) = msg.sender.call{ value: burnPrice }("");
        
          require(success, "Unable to send burnPrice");
        }

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
        return ABDKMathQuad.toUInt(ABDKMathQuad.mul(ABDKMathQuad.fromUInt(initMintPrice), ABDKMathQuad.add(
                LMIN, 
                ABDKMathQuad.mul(
                    ABDKMathQuad.sub(LMAX, LMIN), 
                    ABDKMathQuad.exp(
                        ABDKMathQuad.neg(
                            ABDKMathQuad.div(
                                ABDKMathQuad.mul(ABDKMathQuad.fromUInt(totalSupply), ABDKMathQuad.fromUInt(totalSupply)),
                                ABDKMathQuad.mul(b, T)
                            )
                        )
                    )
                )
            )
        ));
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

    function setPrizeMultipliers(
        uint256 _flagMultiplier, 
        uint256 _rareMultiplier
    ) public isPhase(Epoch.Open) onlyOwner {
        require(_flagMultiplier != 0 && _rareMultiplier !=0, "C: Multipliers cannot be zero.");
        require(2 <= _flagMultiplier && _flagMultiplier <= 8, "C: Flag multiplier must be between 2 and 8");
        require(5 <= _rareMultiplier && _rareMultiplier <= 40, "C: Rare multiplier must be between 5 and 40");

        ukrainianFlagPrizeMultiplier = _flagMultiplier;
        rarePrizeMultiplier = _rareMultiplier;
    }

    function initialise(ERC721 _nft) external payable isPhase(Epoch.Init) onlyOwner {
        require(lastBlockSync == 0, "C: Already synced");
        require(address(nft) == address(0), "C: Already initiated");

        requestRandomness(msg.value);

        nft = _nft;
        hasStarted = true;
    }

    function requestRandomness(uint256 value) internal payable {
        require(msg.value >= value, "C: Insufficient randomness fee");

        uint256 cost = witnet.randomize{ value: value }();

        if (value > cost) {
            msg.sender.call{ value: value - cost }("");
        }

        lastBlockSync = block.number;
    }

}
