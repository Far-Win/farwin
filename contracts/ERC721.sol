// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.19;

// import "../../GSN/Context.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC721Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC721Enumerable.sol";
import "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import "./ERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "erc721a/contracts/ERC721A.sol";
import "./Base64.sol";

/**
 * @title ERC721 Non-Fungible Token Standard basic implementation
 * @dev see https://eips.ethereum.org/EIPS/eip-721
 */
contract ERC721 is
  ERC165,
  IERC721,
  IERC721Metadata,
  IERC721Enumerable,
  Ownable,
  ReentrancyGuard
{
  using SafeMath for uint256;
  using Address for address;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableMap for EnumerableMap.UintToAddressMap;
  using Strings for uint256;

  // Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
  // which can be also obtained as `IERC721Receiver(0).onERC721Received.selector`
  bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;

  // Mapping from holder address to their (enumerable) set of owned tokens
  mapping(address => EnumerableSet.UintSet) private _holderTokens;

  // Enumerable mapping from token ids to their owners
  EnumerableMap.UintToAddressMap private _tokenOwners;

  // Mapping from token ID to approved address
  mapping(uint256 => address) private _tokenApprovals;

  // Mapping from owner to operator approvals
  mapping(address => mapping(address => bool)) private _operatorApprovals;

  // Token name
  string private _name;

  // Token symbol
  string private _symbol;

  // Optional mapping for token URIs
  mapping(uint256 => string) private _tokenURIs;

  // Base URI
  string private _baseURI;

  event NewBaseURI(string baseURI_);

  /*
   *     bytes4(keccak256('balanceOf(address)')) == 0x70a08231
   *     bytes4(keccak256('ownerOf(uint256)')) == 0x6352211e
   *     bytes4(keccak256('approve(address,uint256)')) == 0x095ea7b3
   *     bytes4(keccak256('getApproved(uint256)')) == 0x081812fc
   *     bytes4(keccak256('setApprovalForAll(address,bool)')) == 0xa22cb465
   *     bytes4(keccak256('isApprovedForAll(address,address)')) == 0xe985e9c5
   *     bytes4(keccak256('transferFrom(address,address,uint256)')) == 0x23b872dd
   *     bytes4(keccak256('safeTransferFrom(address,address,uint256)')) == 0x42842e0e
   *     bytes4(keccak256('safeTransferFrom(address,address,uint256,bytes)')) == 0xb88d4fde
   *
   *     => 0x70a08231 ^ 0x6352211e ^ 0x095ea7b3 ^ 0x081812fc ^
   *        0xa22cb465 ^ 0xe985e9c5 ^ 0x23b872dd ^ 0x42842e0e ^ 0xb88d4fde == 0x80ac58cd
   */
  bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

  /*
   *     bytes4(keccak256('name()')) == 0x06fdde03
   *     bytes4(keccak256('symbol()')) == 0x95d89b41
   *     bytes4(keccak256('tokenURI(uint256)')) == 0xc87b56dd
   *
   *     => 0x06fdde03 ^ 0x95d89b41 ^ 0xc87b56dd == 0x5b5e139f
   */
  bytes4 private constant _INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;

  /*
   *     bytes4(keccak256('totalSupply()')) == 0x18160ddd
   *     bytes4(keccak256('tokenOfOwnerByIndex(address,uint256)')) == 0x2f745c59
   *     bytes4(keccak256('tokenByIndex(uint256)')) == 0x4f6ccce7
   *
   *     => 0x18160ddd ^ 0x2f745c59 ^ 0x4f6ccce7 == 0x780e9d63
   */
  bytes4 private constant _INTERFACE_ID_ERC721_ENUMERABLE = 0x780e9d63;

  /* FREEDOM VARS */
  struct Vesting {
    uint256 tokenAmount;
    uint256 vestingStartedAt;
    address vestingToken;
  }

  address public immutable curve;

  uint256 public constant VESTING_DURATION_SECS = 1000000;

  mapping (uint256 => Vesting) vestedTokens;

  // this is practically impossible to overflow.
  // but theoretically possible. Doesn't change that much, unless it overflows in one block (which is practically impossible)
  uint256 public totalEverMinted;
  string[] palette;

  event Minted(
    uint256 indexed tokenId,
    uint256 totalEverMinted,
    uint256 indexed randomness,
    address indexed to,
    uint256 supplyAfterMint,
    uint256 vestingAmount
  );
  event Burned(
    uint256 indexed tokenId,
    address indexed owner,
    uint256 supplyAfterBurn
  );

  event VestingClaimed(
    uint256 indexed tokenId,
    address indexed owner,
    address indexed vestingToken,
    uint256 vestingAmount
  );

  /**
   * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
   */
  constructor(
    string memory name_,
    string memory symbol_,
    address _curve,
    string memory color1,
    string memory color2,
    string memory color3,
    string memory color4,
    string memory color5
  ) public {
    _name = name_;
    _symbol = symbol_;

    // Register interfaces
    _registerInterface(_INTERFACE_ID_ERC721);
    _registerInterface(_INTERFACE_ID_ERC721_METADATA);
    _registerInterface(_INTERFACE_ID_ERC721_ENUMERABLE);

    // _setBaseURI(
    //   string(
    //     abi.encodePacked(
    //       "https://crypty-frame.vercel.app/api/token/",
    //       address(this),
    //       "/"
    //     )
    //   )
    // );
    curve = _curve;

    // Your palette setup remains the same
    // Set up palette with specified colors
    palette.push(color1);
    palette.push(color2);
    palette.push(color3);
    palette.push(color4);
    palette.push(color5);
    // White square is always the sixth square (rare)
    palette.push("#ffffff");
  }

  function mint(address to, uint256 randomness,  uint256 vestingAmount, address vestingToken)
    external
    virtual
    returns (uint256 newTokenId)
  {
    require(msg.sender == curve, "FREEDOM: Minter is not the curve");

    /*
        Neolastic generative art takes first 9 bytes of 32 to calculate colours for the 9 tiles.
        Thus: you *can* get duplicates. But they are rare.
        You can predict totalEverMinted + timestamp to *some* extent
        but hard to do so, unless explicitly manipulated by miners.
        The minter's address is used as additional 'salt'.
        Thus sufficiently "psuedo-random" to ensure that it's unreasonable to manipulate.
        */
    bytes32 hashed = keccak256(
      abi.encodePacked(totalEverMinted, randomness, to)
    );
    uint256 tokenId = uint256(hashed);

    _mint(to, tokenId);

    // this can overflow, and should overflow (since by the time it overflows, timestamp will change)
    // but practically impossible to overflow.
    // could theoretically mint a duplicate if it overflows in one block, but practically impossible with economic constraints.
    totalEverMinted += 1; // for unique hashes per block

    if (vestingAmount != 0) {
      vestedTokens[tokenId] = Vesting({
        tokenAmount: vestingAmount,
        vestingStartedAt: block.timestamp,
        vestingToken: vestingToken
      });
    }

    emit Minted(tokenId, totalEverMinted, randomness, to, totalSupply(), vestingAmount);

    return tokenId;
  }

  function burn(address burner, uint256 tokenId) external virtual {
    require(msg.sender == curve, "FREEDOM: Burner is not the curve"); // only curve can burn it
    require(burner == ownerOf(tokenId), "FREEDOM: Not the correct owner");

    // checking if token exists in the _burn function (don't need to check here)

    _burn(tokenId);

    delete vestedTokens[tokenId];

    emit Burned(tokenId, burner, totalSupply());
  }

  function claimVestedTokens(uint256 tokenId) external nonReentrant {
    require(msg.sender == ownerOf(tokenId), "FREEDOM: Not the correct owner");

    Vesting memory vesting = vestedTokens[tokenId];

    address token = vesting.vestingToken;
    uint256 amount = vesting.tokenAmount;

    require(amount > 0, "FREEDOM: Your vesting amount is 0");
    require(block.timestamp >= vesting.vestingStartedAt + VESTING_DURATION_SECS, "FREEDOM: Vesting period must pass");
    require(IERC20(token).balanceOf(address(this)) >= amount, "FREEDOM: Insufficient balance");

    delete vestedTokens[tokenId];

    require(IERC20(token).transfer(msg.sender, amount), "FREEDOM: Token transfer failed");

    emit VestingClaimed(tokenId, msg.sender, token, amount);
  }

  function getVestingInfo(uint256 tokenId) external view returns (uint256, uint256, address) {
    return (
        vestedTokens[tokenId].tokenAmount,
        vestedTokens[tokenId].vestingStartedAt,
        vestedTokens[tokenId].vestingToken
    );
  }

  function generateSVGofTokenById(uint256 _tokenId)
    external
    view
    virtual
    returns (string memory)
  {
    return _generateSVGFromHash(bytes32(_tokenId));
  }

  function _generateSVGFromHash(bytes32 _hash)
    internal
    view
    virtual
    returns (string memory)
  {
    bytes memory bhash = abi.encodePacked(_hash);

    string memory svg = string(
      abi.encodePacked(
        "<svg width='300' height='300'>",
        string(
          abi.encodePacked(
            "<rect x='0' y='0' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 0) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 1
        string(
          abi.encodePacked(
            "<rect x='0' y='100' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 1) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 2
        string(
          abi.encodePacked(
            "<rect x='0' y='200' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 2) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 3
        string(
          abi.encodePacked(
            "<rect x='100' y='0' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 3) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 4
        string(
          abi.encodePacked(
            "<rect x='100' y='100' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 4) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 5
        string(
          abi.encodePacked(
            "<rect x='100' y='200' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 5) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 6
        string(
          abi.encodePacked(
            "<rect x='200' y='0' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 6) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 7
        string(
          abi.encodePacked(
            "<rect x='200' y='100' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 7) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 8
        string(
          abi.encodePacked(
            "<rect x='200' y='200' width='100' height='100' style='fill:",
            palette[toUint8(bhash, 8) / 51],
            ";stroke-width:3;stroke:black'/>"
          )
        ), // tile 9
        "</svg>"
      )
    );

    return svg;
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

  /*
        ERC721 code
        - Took out safeMint. Not needed since only Curve can mint.
        - Took out beforeTokenTransfer hook.
    */

  /**
   * @dev See {IERC721-balanceOf}.
   */
  function balanceOf(address owner_) external view override returns (uint256) {
    require(owner_ != address(0), "ERC721: balance query for the zero address");

    return _holderTokens[owner_].length();
  }

  /**
   * @dev See {IERC721-ownerOf}.
   */
  function ownerOf(uint256 tokenId) public view override returns (address) {
    return
      _tokenOwners.get(tokenId, "ERC721: owner query for nonexistent token");
  }

  /**
   * @dev See {IERC721Metadata-name}.
   */
  function name() external view override returns (string memory) {
    return _name;
  }

  /**
   * @dev See {IERC721Metadata-symbol}.
   */
  function symbol() external view override returns (string memory) {
    return _symbol;
  }

  /**
   * @dev See {IERC721Metadata-tokenURI}.
   */
  function tokenURI(uint256 tokenId)
    public
    view
    override
    returns (string memory)
  {
    require(
      _exists(tokenId),
      "ERC721Metadata: URI query for nonexistent token"
    );

    string memory _tokenURI = _tokenURIs[tokenId];

    // If there is no base URI, return the token URI.
    if (bytes(_baseURI).length == 0) {
      return _tokenURI;
    }
    // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
    if (bytes(_tokenURI).length > 0) {
      return string(abi.encodePacked(_baseURI, _tokenURI));
    }
    // If there is a baseURI but no tokenURI, concatenate the tokenID to the baseURI.
    return string(abi.encodePacked(_baseURI, tokenId.toString()));
  }

  // Add this function to expose the baseURI (useful for debugging)
  function baseURI() public view returns (string memory) {
    return _baseURI;
  }

  /**
   * @dev See {IERC721Enumerable-tokenOfOwnerByIndex}.
   */
  function tokenOfOwnerByIndex(address owner_, uint256 index)
    external
    view
    override
    returns (uint256)
  {
    return _holderTokens[owner_].at(index);
  }

  /**
   * @dev See {IERC721Enumerable-totalSupply}.
   */
  function totalSupply() public view override returns (uint256) {
    // _tokenOwners are indexed by tokenIds, so .length() returns the number of tokenIds
    return _tokenOwners.length();
  }

  /**
   * @dev See {IERC721Enumerable-tokenByIndex}.
   */
  function tokenByIndex(uint256 index)
    external
    view
    override
    returns (uint256)
  {
    (uint256 tokenId, ) = _tokenOwners.at(index);
    return tokenId;
  }

  /**
   * @dev See {IERC721-approve}.
   */
  function approve(address to, uint256 tokenId) external virtual override {
    address owner_ = ownerOf(tokenId);
    require(to != owner_, "ERC721: approval to current owner");

    require(
      msg.sender == owner_ || isApprovedForAll(owner_, msg.sender),
      "ERC721: approve caller is not owner nor approved for all"
    );

    _approve(to, tokenId);
  }

  /**
   * @dev See {IERC721-getApproved}.
   */
  function getApproved(uint256 tokenId) public view override returns (address) {
    require(_exists(tokenId), "ERC721: approved query for nonexistent token");

    return _tokenApprovals[tokenId];
  }

  /**
   * @dev See {IERC721-setApprovalForAll}.
   */
  function setApprovalForAll(address operator, bool approved)
    external
    virtual
    override
  {
    require(operator != msg.sender, "ERC721: approve to caller");

    _operatorApprovals[msg.sender][operator] = approved;
    emit ApprovalForAll(msg.sender, operator, approved);
  }

  /**
   * @dev See {IERC721-isApprovedForAll}.
   */
  function isApprovedForAll(address owner_, address operator)
    public
    view
    override
    returns (bool)
  {
    return _operatorApprovals[owner_][operator];
  }

  /**
   * @dev See {IERC721-transferFrom}.
   */
  function transferFrom(
    address from,
    address to,
    uint256 tokenId
  ) external virtual override {
    //solhint-disable-next-line max-line-length
    require(
      _isApprovedOrOwner(msg.sender, tokenId),
      "ERC721: transfer caller is not owner nor approved"
    );

    _transfer(from, to, tokenId);
  }

  /**
   * @dev See {IERC721-safeTransferFrom}.
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) external virtual override {
    safeTransferFrom(from, to, tokenId, "");
  }

  /**
   * @dev See {IERC721-safeTransferFrom}.
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes memory _data
  ) public virtual override {
    require(
      _isApprovedOrOwner(msg.sender, tokenId),
      "ERC721: transfer caller is not owner nor approved"
    );
    _safeTransfer(from, to, tokenId, _data);
  }

  function setBaseURI(string memory baseURI_) external onlyOwner {
    _setBaseURI(baseURI_);
  }

  /**
   * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
   * are aware of the ERC721 protocol to prevent tokens from being forever locked.
   *
   * `_data` is additional data, it has no specified format and it is sent in call to `to`.
   *
   * This internal function is equivalent to {safeTransferFrom}, and can be used to e.g.
   * implement alternative mechanisms to perform token transfer, such as signature-based.
   *
   * Requirements:
   *
   * - `from` cannot be the zero address.
   * - `to` cannot be the zero address.
   * - `tokenId` token must exist and be owned by `from`.
   * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
   *
   * Emits a {Transfer} event.
   */
  function _safeTransfer(
    address from,
    address to,
    uint256 tokenId,
    bytes memory _data
  ) internal virtual {
    _transfer(from, to, tokenId);
    require(
      _checkOnERC721Received(from, to, tokenId, _data),
      "ERC721: transfer to non ERC721Receiver implementer"
    );
  }

  /**
   * @dev Returns whether `tokenId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
   *
   * Tokens start existing when they are minted (`_mint`),
   * and stop existing when they are burned (`_burn`).
   */
  function _exists(uint256 tokenId) internal view returns (bool) {
    return _tokenOwners.contains(tokenId);
  }

  /**
   * @dev Returns whether `spender` is allowed to manage `tokenId`.
   *
   * Requirements:
   *
   * - `tokenId` must exist.
   */
  function _isApprovedOrOwner(address spender, uint256 tokenId)
    internal
    view
    returns (bool)
  {
    require(_exists(tokenId), "ERC721: operator query for nonexistent token");
    address owner_ = ownerOf(tokenId);
    return (spender == owner_ ||
      getApproved(tokenId) == spender ||
      isApprovedForAll(owner_, spender));
  }

  /**
   * @dev Mints `tokenId` and transfers it to `to`.
   *
   * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
   *
   * Requirements:
   *
   * - `tokenId` must not exist.
   * - `to` cannot be the zero address.
   *
   * Emits a {Transfer} event.
   */
  function _mint(address to, uint256 tokenId) internal virtual {
    require(to != address(0), "ERC721: mint to the zero address");
    require(!_exists(tokenId), "ERC721: token already minted");

    _holderTokens[to].add(tokenId);

    _tokenOwners.set(tokenId, to);

    emit Transfer(address(0), to, tokenId);
  }

  /**
   * @dev Destroys `tokenId`.
   * The approval is cleared when the token is burned.
   *
   * Requirements:
   *
   * - `tokenId` must exist.
   *
   * Emits a {Transfer} event.
   */
  function _burn(uint256 tokenId) internal virtual {
    address owner_ = ownerOf(tokenId);

    // Clear approvals
    _approve(address(0), tokenId);

    // Clear metadata (if any)
    if (bytes(_tokenURIs[tokenId]).length != 0) {
      delete _tokenURIs[tokenId];
    }

    _holderTokens[owner_].remove(tokenId);

    _tokenOwners.remove(tokenId);

    emit Transfer(owner_, address(0), tokenId);
  }

  /**
   * @dev Transfers `tokenId` from `from` to `to`.
   *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
   *
   * Requirements:
   *
   * - `to` cannot be the zero address.
   * - `tokenId` token must be owned by `from`.
   *
   * Emits a {Transfer} event.
   */
  function _transfer(
    address from,
    address to,
    uint256 tokenId
  ) internal virtual {
    require(
      ownerOf(tokenId) == from,
      "ERC721: transfer of token that is not own"
    );
    require(to != address(0), "ERC721: transfer to the zero address");

    // Clear approvals from the previous owner
    _approve(address(0), tokenId);

    _holderTokens[from].remove(tokenId);
    _holderTokens[to].add(tokenId);

    _tokenOwners.set(tokenId, to);

    emit Transfer(from, to, tokenId);
  }

  /**
   * @dev Internal function to set the base URI for all token IDs. It is
   * automatically added as a prefix to the value returned in {tokenURI},
   * or to the token ID if {tokenURI} is empty.
   */
  function _setBaseURI(string memory baseURI_) internal virtual {
    _baseURI = baseURI_;
    emit NewBaseURI(baseURI_);
  }

  /**
   * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
   * The call is not executed if the target address is not a contract.
   *
   * @param from address representing the previous owner of the given token ID
   * @param to target address that will receive the tokens
   * @param tokenId uint256 ID of the token to be transferred
   * @param _data bytes optional data to send along with the call
   * @return bool whether the call correctly returned the expected magic value
   */
  function _checkOnERC721Received(
    address from,
    address to,
    uint256 tokenId,
    bytes memory _data
  ) private returns (bool) {
    if (!to.isContract()) {
      return true;
    }
    bytes memory returndata = to.functionCall(
      abi.encodeWithSelector(
        IERC721Receiver(to).onERC721Received.selector,
        msg.sender,
        from,
        tokenId,
        _data
      ),
      "ERC721: transfer to non ERC721Receiver implementer"
    );
    bytes4 retval = abi.decode(returndata, (bytes4));
    return (retval == _ERC721_RECEIVED);
  }

  function _approve(address to, uint256 tokenId) private {
    _tokenApprovals[tokenId] = to;
    emit Approval(ownerOf(tokenId), to, tokenId);
  }
}
