pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import './Token.sol';

contract TokenCrowdsale is FinalizableCrowdsale {
  using SafeMath for uint256;

  function TokenCrowdsale(Token _token, address _wallet) public
   Crowdsale(1, _wallet, _token)
   TimedCrowdsale(block.timestamp+1, block.timestamp+2){

  }
}
