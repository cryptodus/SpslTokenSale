pragma solidity ^0.4.23;

import 'openzeppelin-solidity/contracts/token/ERC20/CappedToken.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol';

/*
  Token is PausableToken and on the creation it is paused.
  It is made so because you don't want token to be transferable etc,
  while your ico is not over.
*/
contract Token is CappedToken, PausableToken {

  uint256 private constant TOKEN_CAP = 980 * 10**24;
  
  uint256 public constant PRIVATE_SALE_CAP = 140 * 10**24;
  uint256 public constant ICO_SALE_CAP = 448 * 10**24;

  string public constant name = "SPSL token";
  string public constant symbol = "SPSL";
  uint8 public constant decimals = 18;

  function Token() public CappedToken(TOKEN_CAP) {
    paused = true;
  }
}
