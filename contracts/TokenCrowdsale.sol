pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/PostDeliveryCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "./Token.sol";

contract TokenCrowdsale is MintedCrowdsale, FinalizableCrowdsale, PostDeliveryCrowdsale {
  using SafeMath for uint256;

  uint256 public constant ICO_CAP = 588 * 10**24;

  // Should not be able to buy more tokens in presale than this amount
  uint256 public constant PRESALE_CAP = 338000 * 10**21;

  // percetage of tokens to be forwarded to team wallet
  uint256 public constant TEAM_PERCENTAGE = 40;

  // address that can distribute tokens for whitelisted investors
  address public distributor = 0x9e1ef1ec212f5dffb41d35d9e5c14054f26c6560;

  // While tokens are sold in the presale their rate is calculated based on these
  uint256[] public presaleRates = [13000, 12000, 11000];
  uint256[] public presaleCaps = [211500 * 10**21, 277500 * 10**21, 338000 * 10**21];

  // wallets that will hold team tokens
  address[] public teamWallets = [
  //  Wallet 2.0 - Founders 0xC32c7CE9632604b891eb1AFa94Ed1042a0221A77 39,200,000 SPSL 10%
        0xC32c7CE9632604b891eb1AFa94Ed1042a0221A77,
  //  Wallet 2.1 - Core Team 0xe2021bCBc9DDE43f71d59CA8b3c8F8B589D1FfAA 39,200,000 SPSL 10%
        0xe2021bCBc9DDE43f71d59CA8b3c8F8B589D1FfAA,
  //  Wallet 2.2 - Advisors & Ambassadors  0xc613A2CFe1A29c7B88256a7E181ed89793FF352b 47,040,000 SPSL 12%
        0xc613A2CFe1A29c7B88256a7E181ed89793FF352b,
  //  Wallet 2.3 - Marketing 0x18FeCFBe15706214296a26510F07A7ACD520adEC 23,520,000 SPSL 6%
        0x18FeCFBe15706214296a26510F07A7ACD520adEC,
  //  Wallet 2.4 - Partnership Incentives 0x89b75E56b14db03EC216Add30B0d44C99e48B80E 39,200,000 SPSL 10%
        0x89b75E56b14db03EC216Add30B0d44C99e48B80E,
  //  Wallet 2.5 - Foundation (1) 0x9dE1118829f4eb2E1e3904353C122fc8890fA3ab 40,768,000 SPSL 10,4%
        0x9dE1118829f4eb2E1e3904353C122fc8890fA3ab,
  //  Wallet 2.6 - Foundation (2) 0x9eB840BE16C42790E8e8751ADA684a750A411038 40,768,000 SPSL 10,4%
        0x9eB840BE16C42790E8e8751ADA684a750A411038,
  //  Wallet 2.7 - Foundation (3) 0x6B7753Cf2Ce37E53372d22E670D3CF9bA192e541 40,768,000 SPSL 10,4%
        0x6B7753Cf2Ce37E53372d22E670D3CF9bA192e541,
  //  Wallet 2.8 - Foundation (4) 0x9384fE95E7485FB62Bad8cA47C8ae7072507bdE0 40,768,000 SPSL 10,4%
        0x9384fE95E7485FB62Bad8cA47C8ae7072507bdE0,
  //  Wallet 2.9 - Foundation (5) 0xF7cB8Ca088D4007E14cA09B1ED1Bd0BC2f3CbCA3 40,768,000 SPSL 10,4%
        0xF7cB8Ca088D4007E14cA09B1ED1Bd0BC2f3CbCA3];

  // percentages that will go to team wallets
  uint256[] public teamWalletsDistributionPercentage = [
  //  Wallet 2.0 - Founders 0xC32c7CE9632604b891eb1AFa94Ed1042a0221A77 39,200,000 SPSL 10%
      100,
  //  Wallet 2.1 - Core Team 0xe2021bCBc9DDE43f71d59CA8b3c8F8B589D1FfAA 39,200,000 SPSL 10%
      100,
  //  Wallet 2.2 - Advisors & Ambassadors  0xc613A2CFe1A29c7B88256a7E181ed89793FF352b 47,040,000 SPSL 12%
      120,
  //  Wallet 2.3 - Marketing 0x18FeCFBe15706214296a26510F07A7ACD520adEC 23,520,000 SPSL 6%
      60,
  //  Wallet 2.4 - Partnership Incentives 0x89b75E56b14db03EC216Add30B0d44C99e48B80E 39,200,000 SPSL 10%
      100,
  //  Wallet 2.5 - Foundation (1) 0x9dE1118829f4eb2E1e3904353C122fc8890fA3ab 40,768,000 SPSL 10,4%
      104,
  //  Wallet 2.6 - Foundation (2) 0x9eB840BE16C42790E8e8751ADA684a750A411038 40,768,000 SPSL 10,4%
      104,
  //  Wallet 2.7 - Foundation (3) 0x6B7753Cf2Ce37E53372d22E670D3CF9bA192e541 40,768,000 SPSL 10,4%
      104,
  //  Wallet 2.8 - Foundation (4) 0x9384fE95E7485FB62Bad8cA47C8ae7072507bdE0 40,768,000 SPSL 10,4%
      104,
  //  Wallet 2.9 - Foundation (5) 0xF7cB8Ca088D4007E14cA09B1ED1Bd0BC2f3CbCA3 40,768,000 SPSL 10,4%
      104];

  // Date when sale starts
  uint256 public saleOpeningTime;

  // Saving wei that is returned for last phase purchasers
  uint256 public overflowWei;

  // Calculating how much tokens were already issued
  uint256 public tokensIssued;

  // wallet for the leftover tokens to be locked up
  address public lockupWallet;

  // modifier for allowing only distributor call the method
  modifier onlyDistributor {
      require(msg.sender == distributor || msg.sender == owner);
      _;
  }

  constructor(
      Token _token,
      address _wallet,
      uint256 _saleRate,
      uint256 _openingTime,
      uint256 _closingTime,
      uint256 _saleOpeningTime,
      address _lockupWallet
  )
      public
      Crowdsale(_saleRate, _wallet, _token)
      TimedCrowdsale(_openingTime, _closingTime)
  {
     require(ICO_CAP.mul(100).div(Token(token).cap()) == uint256(100).sub(TEAM_PERCENTAGE));
     require(teamWallets.length == teamWalletsDistributionPercentage.length);

     uint256 _totalTeamPerentage;
     for (uint256 i = 0; i < teamWalletsDistributionPercentage.length; i = i.add(1)) {
       _totalTeamPerentage = _totalTeamPerentage.add(teamWalletsDistributionPercentage[i]);
     }
     // 1000 is used because we want to have percentage like 10.4
     require(_totalTeamPerentage == 1000);
     require(saleOpeningTime == 0);
     require(_lockupWallet != address(0));

     require(_saleOpeningTime <= closingTime);
     require(_saleOpeningTime >= openingTime);

     saleOpeningTime = _saleOpeningTime;
     lockupWallet = _lockupWallet;

     tokensIssued = token.totalSupply();
  }

  /*
    OpenZeppelin method override for additional pre purchase validation.
    Checks wheather sale/presale stages are running and if not all tokens
    are sold
  */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(tokensIssued < ICO_CAP);
    if (block.timestamp <= saleOpeningTime) {
      require(PRESALE_CAP > tokensIssued);
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
    if (_currentSupply.add(_tokenAmount) > ICO_CAP) {
      _tokenAmount = ICO_CAP.sub(_currentSupply);
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
    require(PRESALE_CAP > _supply);
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
    require(msg.value > 0);
    require(msg.value >= overflowWei);

    uint256 _amountToForward = msg.value.sub(overflowWei);
    overflowWei = 0;
    wallet.transfer(_amountToForward);
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
  function forwardTokens(address[] _investors) public onlyDistributor {
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
   and finishing routines.
  */
  function finalization() internal {
    Token _token = Token(token);

    uint256 _teamTokens = _token.cap().mul(TEAM_PERCENTAGE).div(100);

    for (uint i = 0; i < teamWallets.length; i = i.add(1)) {
      address _teamWallet = teamWallets[i];
      uint256 _percentage = teamWalletsDistributionPercentage[i];
      // 1000 is used because we want to have percentage like 10.4
      require(_token.mint(_teamWallet, _teamTokens.mul(_percentage).div(1000)));
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
    bool _soldOut = tokensIssued >= ICO_CAP;
    return super.hasClosed() || _soldOut;
  }
}
