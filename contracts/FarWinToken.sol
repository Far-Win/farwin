// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract FarWinToken is ERC20, ERC20Burnable {
  string public constant TOKEN_NAME = "FarWin";
  string public constant TOKEN_SYMBOL = "FWIN";
  uint256 public constant TOKEN_INITIAL_SUPPLY = 10_000_000;

  constructor(address to) ERC20(TOKEN_NAME, TOKEN_SYMBOL) {
        _mint(to, TOKEN_INITIAL_SUPPLY * 10 ** decimals());
    }
}