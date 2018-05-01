pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import './Token.sol';

contract TokenCrowdsale is FinalizableCrowdsale {
  using SafeMath for uint256;

  function TokenCrowdsale(
      Token _token,
      address _wallet,
      uint256 _uncappedRate,
      uint256[] _rates,
      uint256[] _capsTo,
      uint256 _openingTime,
      uint256 _closingTime,
      uint256 _uncappedOpeningTime,
      uint256 _icoTotalCap
  ) public
   Crowdsale(1, _wallet, _token)
   TimedCrowdsale(_openingTime, _closingTime) {

  }
}
