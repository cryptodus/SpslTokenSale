pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import './Token.sol';

contract TokenCrowdsale is MintedCrowdsale, FinalizableCrowdsale {
  using SafeMath for uint256;

  uint256 public constant PRIVATE_SALE_CAP = 140 * 10**24;
  uint256 public constant ICO_SALE_CAP = 448 * 10**24;

  // Should not be able to buy more tokens in capped stage than this amount
  uint256 public capedStageFinalCap;

  // While tokens are sold in the capped state their rate is calculated based on these
  uint256[] public rates;
  uint256[] public capsTo;

  // Date when uncapped  starts
  uint256 public uncappedOpeningTime;

  // Saving wei that is returned for last phase purchasers
  uint256 public overflowWei;

  address foundationWallet;
  uint256 foundationPercentage;

  address lockupWallet;

  address privatePresaleWallet;

  constructor(
      Token _token,
      address _wallet,
      uint256 _uncappedRate,
      uint256[] _rates,
      uint256[] _capsTo,
      uint256 _openingTime,
      uint256 _closingTime,
      uint256 _uncappedOpeningTime,
      address _foundationWallet,
      uint256 _foundationPercentage,
      address _lockupWallet,
      address _privatePresaleWallet
  )
      public
      Crowdsale(_uncappedRate, _wallet, _token)
      TimedCrowdsale(_openingTime, _closingTime)
  {
     require(_rates.length > 0);
     require(_rates.length == _capsTo.length);

     require(_uncappedOpeningTime <= _closingTime);
     require(_uncappedOpeningTime >= _openingTime);

     require((((ICO_SALE_CAP + PRIVATE_SALE_CAP)*100/_token.cap()) == 60));

     rates = _rates;
     capsTo = _capsTo;
     uncappedOpeningTime = _uncappedOpeningTime;
     foundationWallet = _foundationWallet;
     foundationPercentage = _foundationPercentage;
     lockupWallet = _lockupWallet;
     capedStageFinalCap = _capsTo[_capsTo.length.sub(1)];
     privatePresaleWallet = _privatePresaleWallet;
  }

  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(token.totalSupply() < ICO_SALE_CAP);
    if (block.timestamp <= uncappedOpeningTime) {
      require(capedStageFinalCap > token.totalSupply());
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

    uint256 _rateIndex = _getRateIndex(_currentSupply);

    // while we can purchase all tokens in current cap-rate step, move to other step
    while (_weiAmount > 0 && _rateIndex < rates.length) {
      _tokensForRate = capsTo[_rateIndex].sub(_currentSupply);
      _weiReq = _tokensForRate.div(rates[_rateIndex]);
      if (_weiReq > _weiAmount) {
        // if wei required is more or equal than we have - we can purchase only part of the cap-rate step tokens
         _tokensForRate = _weiAmount.mul(rates[_rateIndex]);
         _weiReq = _weiAmount;
      }

      _weiSpent = _weiSpent.add(_weiReq);
      _weiAmount = _weiAmount.sub(_weiReq);
      _tokenAmount = _tokenAmount.add(_tokensForRate);
      _currentSupply = token.totalSupply().add(_tokenAmount);
      _rateIndex = _rateIndex.add(1);
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
    if (_currentSupply.add(_tokenAmount) > ICO_SALE_CAP) {
      _tokenAmount = ICO_SALE_CAP.sub(_currentSupply);
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
      weiRaised = weiRaised.sub(_weiToReturn);
      overflowWei = _weiToReturn;
      _beneficiary.transfer(_weiToReturn);
    }
  }

  /*
    Method for retrieving rate and capTo for provided supply. It is used in capped
    state were rate depends on sold tokens amount
  */
  function _getRateIndex(uint256 _supply) internal view returns(uint256) {
    require(capedStageFinalCap > _supply);
    uint256 _i = 0;
    while(_i < capsTo.length) {
      if (capsTo[_i] > _supply) {
        return _i;
      }
      _i = _i.add(1);
    }
    return _i;
  }

  /*
    Method open-zeppelin override, we need to sub if any wei was returned
  */
  function _forwardFunds() internal {
    wallet.transfer(msg.value.sub(overflowWei));
    overflowWei = 0;
  }

  /*
   OpenZeppelin FinalizableCrowdsale method override - token distribution
   and finishing routines
  */
  function finalization() internal {
    Token _token = Token(token);

    require(_token.mint(privatePresaleWallet, PRIVATE_SALE_CAP));

    uint256 _foundationTokens = _token.cap().mul(foundationPercentage).div(100);
    require(_token.mint(foundationWallet, _foundationTokens));

    uint256 _leftoverTokens = _token.cap().sub(_token.totalSupply());
    require(_token.mint(lockupWallet, _leftoverTokens));

    require(_token.finishMinting());
    _token.transferOwnership(wallet);

    super.finalization();
  }

  /**
    OpenZeppelin TimedCrowdsale method override - checks whether the crowdsale is over
  */
  function hasClosed() public view returns (bool) {
    bool _soldOut = token.totalSupply() >= ICO_SALE_CAP;
    return super.hasClosed() || _soldOut;
  }
}
