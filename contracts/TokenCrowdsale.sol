pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/PostDeliveryCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "./Token.sol";
import "./Vault.sol";

contract TokenCrowdsale is MintedCrowdsale, FinalizableCrowdsale, PostDeliveryCrowdsale {
  using SafeMath for uint256;

  uint256 public constant PRIVATE_SALE_CAP = 140 * 10**24;
  uint256 public constant ICO_SALE_CAP = 488 * 10**24;

  // Should not be able to buy more tokens in presale than this amount
  uint256 public presaleCap;

  // While tokens are sold in the presale their rate is calculated based on these
  uint256[] public presaleRates;
  uint256[] public presaleCaps;

  // Date when sale starts
  uint256 public saleOpeningTime;

  // Saving wei that is returned for last phase purchasers
  uint256 public overflowWei;

  // Calculating how much tokens were already issued
  uint256 public tokensIssued;

  // refund vault used to hold funds while crowdsale is running
  Vault public vault;

  // list of all the investors
  address[] public investors;

  // wallets that will hold team tokens
  address[] public teamWallets;

    // percentages that will go to team wallets
  address[] public teamWaletsDistributionPercentage;

  // percetage of tokens to be forwarded to fundation wallet
  uint256 public teamPercentage;

  // wallet for the leftover tokens to be locked up
  address public lockupWallet;

  constructor(
      Token _token,
      address _wallet,
      uint256 _saleRate,
      uint256 _openingTime,
      uint256 _closingTime,
      Vault vaultAddress
  )
      public
      Crowdsale(_saleRate, _wallet, _token)
      TimedCrowdsale(_openingTime, _closingTime)
  {
     tokensIssued = token.totalSupply();
     vault = vaultAddress;
  }

  function initialize (
    uint256[] _presaleRates,
    uint256[] _presaleCaps,
    uint256 _saleOpeningTime,
    uint256 _teamPercentage,
    uint256[] _teamWallets,
    uint256[] _teamWaletsDistributionPercentage,
    address _lockupWallet
  ) onlyOwner
  {
    require(saleOpeningTime == 0);
    require(_lockupWallet != address(0));
    require(_foundationWallet != address(0));

    require(_presaleRates.length > 0);
    require(_presaleRates.length == _presaleCaps.length);
    require(_teamWallets.length == _teamWaletsDistributionPercentage.length);
    require(_saleOpeningTime <= closingTime);
    require(_saleOpeningTime >= openingTime);

    require(_teamPercentage <= 100);
    require(ICO_SALE_CAP.add(PRIVATE_SALE_CAP).mul(100).div(Token(token).cap()) == uint256(100).sub(_teamPercentage));


    presaleRates = _presaleRates;
    presaleCaps = _presaleCaps;
    saleOpeningTime = _saleOpeningTime;
    foundationWallet = _foundationWallet;
    teamPercentage = _teamPercentage;
    lockupWallet = _lockupWallet;
    presaleCap = _presaleCaps[_presaleCaps.length.sub(1)];
  }

  /*
    OpenZeppelin method override for additional pre purchase validation.
    Checks wheather sale/presale stages are running and if not all tokens
    are sold
  */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(tokensIssued < ICO_SALE_CAP);
    if (block.timestamp <= saleOpeningTime) {
      require(presaleCap > tokensIssued);
    }
  }

  /*
    Pruchasing happens in two stages presale and sale.
    Presale stage happens first and price is calculated based on already sold
    tokens amount. Sale stage starts at certain date and lasts till the end
    of ico. Sale stage has stable token price and is basically standard openzeppelin
    token sale
  */
  function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
    if (block.timestamp >= saleOpeningTime) {
      _processSalePurchase(_beneficiary, _tokenAmount);
    } else {
      _processPresalePurchase(_beneficiary);
    }
  }

  /*
    Method handles presale purchase. Token amount is calculated depending
    on amount of tokens already sold.
  */
  function _processPresalePurchase(address _beneficiary) internal {
    require(block.timestamp < saleOpeningTime);

    uint256 _tokenAmount = 0;
    uint256 _weiSpent = 0;
    uint256 _weiAmount = msg.value;

    uint256 _currentSupply = tokensIssued;
    uint256 _tokensForRate = 0;
    uint256 _weiReq = 0;

    uint256 _rateIndex = _getRateIndex(_currentSupply);

    // while we can purchase all tokens in current cap-rate step, move to other step
    while (_weiAmount > 0 && _rateIndex < presaleRates.length) {
      _tokensForRate = presaleCaps[_rateIndex].sub(_currentSupply);
      _weiReq = _tokensForRate.div(presaleRates[_rateIndex]);
      if (_weiReq > _weiAmount) {
        // if wei required is more or equal than we have - we can purchase only part of the cap-rate step tokens
         _tokensForRate = _weiAmount.mul(presaleRates[_rateIndex]);
         _weiReq = _weiAmount;
      }

      _weiSpent = _weiSpent.add(_weiReq);
      _weiAmount = _weiAmount.sub(_weiReq);
      _tokenAmount = _tokenAmount.add(_tokensForRate);
      _currentSupply = tokensIssued.add(_tokenAmount);
      _rateIndex = _rateIndex.add(1);
    }

    super._processPurchase(_beneficiary, _tokenAmount);
    tokensIssued = tokensIssued.add(_tokenAmount);
    _processFundsOverflow(_beneficiary, _weiSpent);
  }

  /*
    Method handles sale purchases. It is needed to check if beneficiary
    sent more ethers than there are tokens to purchase.
  */
  function _processSalePurchase(address _beneficiary, uint256 _tokenAmount) internal {
    uint256 _currentSupply = tokensIssued;
    if (_currentSupply.add(_tokenAmount) > ICO_SALE_CAP) {
      _tokenAmount = ICO_SALE_CAP.sub(_currentSupply);
    }
    super._processPurchase(_beneficiary, _tokenAmount);
    tokensIssued = tokensIssued.add(_tokenAmount);
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
    Method for retrieving rate and capTo for provided supply. It is used in presale
    were rate depends on sold tokens amount
  */
  function _getRateIndex(uint256 _supply) internal view returns(uint256) {
    require(presaleCap > _supply);
    uint256 _i = 0;
    while(_i < presaleCaps.length) {
      if (presaleCaps[_i] > _supply) {
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
    uint256 valueToDeposit = msg.value.sub(overflowWei);
    vault.deposit.value(valueToDeposit)(msg.sender);
    investors.push(msg.sender);
    overflowWei = 0;
  }

  /*
    OpenZeppelin PostDeliveryCrowdsale override - forbid users to withdraw
    tokens themselves
  */
  function withdrawTokens() public {
    revert();
  }

  /*
    Method for forwarding tokens for investors that are provided only
  */
  function forwardTokens(address[] _investors) public onlyOwner {
    require(hasClosed());
    for (uint i = 0; i < _investors.length; i = i.add(1)) {
      address _investor = _investors[i];
      uint256 _amount = balances[_investor];
      if (_amount > 0) {
        balances[_investor] = 0;
        _deliverTokens(_investor, _amount);
      }
    }
  }

  /*
   OpenZeppelin FinalizableCrowdsale method override - token distribution
   and finishing routines. Also refund all the none whitelisted _investors
   and close the vault
  */
  function finalization() internal {
    Token _token = Token(token);

    vault.enableRefunds();
    for (uint i = 0; i < investors.length; i = i.add(1)) {
      address _investor = investors[i];
      uint256 _amount = balances[_investor];
      if (_amount > 0) {
        vault.refund(_investor);
        balances[_investor] = 0;
      }
    }
    vault.disableRefunds();
    vault.close();

    uint256 _teamTokens = _token.cap().mul(teamPercentage).div(100);

    for (uint i = 0; i < teamWallets.length; i = i.add(1)) {
      address _teamWallet = teamWallets[i];
      uint256 _percentage = _teamWaletsDistributionPercentage[i];
      require(_token.mint(_teamWallet, _teamTokens.mul(_percentage).div(100)));
    }

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
    bool _soldOut = tokensIssued >= ICO_SALE_CAP;
    return super.hasClosed() || _soldOut;
  }
}