pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol";
import './Token.sol';

contract TokenCrowdsale is Crowdsale {
  using SafeMath for uint256;

  function TokenCrowdsale(Token _token, address _wallet) public
   Crowdsale(1, _wallet, _token){

  }
}
