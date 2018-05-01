pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import './Token.sol';

contract TokenCrowdsale is MintedCrowdsale, FinalizableCrowdsale {
  using SafeMath for uint256;

  // Should not be able to send more tokens than this amount
  uint256 icoTotalCap;

  // While tokens are sold in the capped state their rate is calculated based on these
  uint256[] rates;
  uint256[] capsTo;

  // Date when uncapped  starts
  uint256 uncappedOpeningTime;

  address foundationWallet;
  uint256 foundationPercentage;

  address lockupWallet;

  uint256 public finalizedTime;

  function TokenCrowdsale(
      Token _token,
      address _wallet,
      uint256 _uncappedRate,
      uint256[] _rates,
      uint256[] _capsTo,
      uint256 _openingTime,
      uint256 _closingTime,
      uint256 _uncappedOpeningTime,
      uint256 _icoTotalCap,
      address _foundationWallet,
      uint256 _foundationPercentage,
      address _lockupWallet
  )
      public
      Crowdsale(_uncappedRate, _wallet, _token)
      TimedCrowdsale(_openingTime, _closingTime)
  {
     require(_rates.length > 0);
     require(_rates.length == _capsTo.length);

     require(_uncappedOpeningTime <= _closingTime);
     require(_uncappedOpeningTime >= _openingTime);

     require(_icoTotalCap > 0);

     rates = _rates;
     capsTo = _capsTo;
     uncappedOpeningTime = _uncappedOpeningTime;
     icoTotalCap = _icoTotalCap;
     foundationWallet = _foundationWallet;
     foundationPercentage = _foundationPercentage;
     lockupWallet = _lockupWallet;
  }

  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(token.totalSupply() < icoTotalCap);
    if (block.timestamp <= uncappedOpeningTime) {
      require(capsTo[capsTo.length.sub(1)] > token.totalSupply());
    }
  }

  /*
    pruchasing happens in two stages capped and uncapped.
    Capped stage happens first and price is calculated based on already sold
    tokens amount. Uncapped stage starts at certain date and lasts till the end
    of sale. Uncapped stage has stable token price and is basically standard openzeppelin
    token sale
  */
  function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
    if (block.timestamp >= uncappedOpeningTime) {
      _processUncappedPurchase(_beneficiary, _tokenAmount);
    } else {
      _processCappedPurchase(_beneficiary);
    }
  }

  /*
    Method handles capped sale purchase. Token amount is calculated depending
    on amount of tokens already sold.
  */
  function _processCappedPurchase(address _beneficiary) internal {
    require(block.timestamp < uncappedOpeningTime);

    uint256 _tokenAmount = 0;
    uint256 _weiSpent = 0;
    uint256 _weiAmount = msg.value;

    uint256 _currentSupply = token.totalSupply();
    uint256 _tokensForRate = 0;
    uint256 _weiReq = 0;
    var (_capTo, _rate) = _getRateFor(_currentSupply);

    // while we can purchase all tokens in current cap-rate step, move to other step
    while (_weiAmount > 0 && _currentSupply < capsTo[capsTo.length.sub(1)]) {
      _tokensForRate = _capTo.sub(_currentSupply);
      _weiReq = _tokensForRate.div(_rate);
      if (_weiReq < _weiAmount) {
        // if wei required for tokens is less than we have - all tokens from the step can be pruchased
         _tokenAmount = _tokenAmount.add(_tokensForRate);
      } else {
        // if wei required is more or equal than we have - we can purchase only part of the cap-rate step tokens
         _tokenAmount = _tokenAmount.add(_weiAmount.mul(_rate));
         _weiReq = _weiAmount;
      }

      _weiSpent = _weiSpent.add(_weiReq);
      _weiAmount = _weiAmount.sub(_weiReq);
      _currentSupply = token.totalSupply().add(_tokenAmount);
      (_capTo, _rate) = _getRateFor(_currentSupply);
    }

    super._processPurchase(_beneficiary, _tokenAmount);
    _processFundsOverflow(_beneficiary, _weiSpent);
  }

  /*
    Method handles uncapped state purchase. It is needed to check if beneficiary
    sent more ethers than there are tokens to purchase.
  */
  function _processUncappedPurchase(address _beneficiary, uint256 _tokenAmount) internal {
    uint256 _currentSupply = token.totalSupply();
    if (_currentSupply.add(_tokenAmount) > icoTotalCap) {
      _tokenAmount = icoTotalCap.sub(_currentSupply);
    }
    super._processPurchase(_beneficiary, _tokenAmount);
    uint256 _weiAmount = _tokenAmount.div(rate);
    _processFundsOverflow(_beneficiary, _weiAmount);
  }

  /*
    In either stage last beneficiary can send more ethers than there are tokens
    to purchase - in this case overflow ethers are returned to beneficiary
  */
  function _processFundsOverflow(address _beneficiary, uint256 _weiAmount) internal {
    require(_weiAmount <= msg.value);
    if (msg.value > _weiAmount) {
      uint256 _weiToReturn = msg.value.sub(_weiAmount);
      weiRaised = weiRaised.sub(_weiAmount);
      _beneficiary.transfer(_weiAmount);
    }
  }

  /*
    Method for retrieving rate and capTo for provided supply. It is used in capped
    state were rate depends on sold tokens amount
  */
  function _getRateFor(uint256 _supply) internal view returns(uint256, uint256) {
    require(capsTo[capsTo.length - 1] > _supply);
    uint256 _i = 0;
    while(_i < capsTo.length) {
      if (capsTo[_i] > _supply) {
        return (capsTo[_i], rates[_i]);
      }
      _i = _i.add(1);
    }
  }

  // OpenZeppelin FinalizableCrowdsale method override
  function finalization() internal {
    // allow finalize only once
    require(finalizedTime == 0);

    Token _token = Token(token);

    require(_token.mint(foundationWallet, _token.cap().mul(foundationPercentage).div(100)));

    uint256 _leftoverTokens = icoTotalCap.sub(_token.totalSupply());
    require(_token.mint(lockupWallet, _leftoverTokens));

    require(_token.finishMinting());
    _token.transferOwnership(wallet);

    finalizedTime = block.timestamp;
  }
}
