import ether from 'openzeppelin-solidity/test/helpers/ether';
import { advanceBlock } from 'openzeppelin-solidity/test/helpers/advanceToBlock';
import { increaseTimeTo, duration } from 'openzeppelin-solidity/test/helpers/increaseTime';
import latestTime from 'openzeppelin-solidity/test/helpers/latestTime';
import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert';

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const Token = artifacts.require("./Token")
const TokenCrowdsale = artifacts.require("./TokenCrowdsale");
const TeamTokenHolder = artifacts.require("./TeamTokenHolder");

contract('TokenCrowdsaleTest', function (accounts) {
  let investor1 = accounts[0];
  let wallet = accounts[1];
  // should create tokenVesting wallet for the lockup
  let lockupWallet = accounts[2];
  let foundation = accounts[3];
  let investor2 = accounts[5];
  let founder = accounts[6];
  let presaleWallet = accounts[7];

  let uncappedPhaseRate = 10000;
  let caps = [71500e21, 137500e21, 198000e21];
  let rates = [13000, 12000, 11000];
  let totalIcoCap = 448e24;
  let foundationPercentage = 40;
  let icoPercentage = 60;
  let presaleCap = 140e24;

  let vestingCliff = duration.years(1);
  let vestingDuration = duration.years(5);

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock();
  });

  // For capped 16500 ether to buy all phase
  // For uncapped 25000 ether to buy all phase
  // Total 41500 ether
  beforeEach(async function () {
    this.openingTime = latestTime() + duration.weeks(1);
    this.closingTime = this.openingTime + duration.days(60);
    this.uncappedOpeningTime = this.openingTime + duration.days(15);
    this.token = await Token.new();
    this.crowdsale = await TokenCrowdsale.new(this.token.address, wallet, uncappedPhaseRate,
      rates, caps, this.openingTime, this.closingTime, this.uncappedOpeningTime,
      foundation, foundationPercentage, lockupWallet, presaleWallet);
    await this.token.transferOwnership(this.crowdsale.address);
  });

  describe('purchasing tokens', function() {
    it('should not accept payments before opening time', async function() {
      await increaseTimeTo(latestTime());
      await this.crowdsale.buyTokens(investor1, { value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should accept payments during crowdsale', async function() {
       await increaseTimeTo(this.openingTime + duration.weeks(1));
       await this.crowdsale.buyTokens(investor1, { value: ether(1) }).should.be.fulfilled;
    });
    it('should not allow buy tokens if all capped are bought and uncapped phase not started yet', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(20000) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(founder, { value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should allow buy tokens if all capped are bought and uncapped phase started', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(20000) }).should.be.fulfilled;
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(founder, { value: ether(1) }).should.be.fulfilled;
    });
    it('should allow buy tokens if no tokens bought and uncapped phase started', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(founder, { value: ether(1) }).should.be.fulfilled;
    });
    it('should not accept payments after closing time', async function() {
       await increaseTimeTo(this.closingTime + duration.weeks(1));
       await this.crowdsale.buyTokens(investor1, { value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should buy correct amount of tokens in the capped first phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(rates[0]*1e18);
    });
    it('should buy correct amount of tokens in the capped second phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor2, { value: ether(5500) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, { value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(rates[1]*1e18);
    });
    it('should buy correct amount of tokens in the capped third phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor2, { value: ether(11000) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, { value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(rates[2]*1e18);
    });
    it('should buy correct amount of tokens in the uncapped phase', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(uncappedPhaseRate* 1e18);
    });
    it('should forward funds to wallet after purchase in the capped phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      
      var amount = ether(1);
      const prePurchaseBalance = web3.eth.getBalance(wallet);
      await this.crowdsale.buyTokens(investor1, { value: amount }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(wallet);
      postPurchaseBalance.minus(prePurchaseBalance).should.be.bignumber.equal(amount);
    });
    it('should forward funds to wallet after purchase in the uncapped phase', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      
      var amount = ether(1);
      const prePurchaseBalance = web3.eth.getBalance(wallet);
      await this.crowdsale.buyTokens(investor1, { value: amount }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(wallet);
      postPurchaseBalance.minus(prePurchaseBalance).should.be.bignumber.equal(amount);
    });
    it('should return funds to investor when too much eth was sent in the last capped phase', async function() {
      //buy out first 2 capped phases
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(11000) }).should.be.fulfilled;
      
      const prePurchaseInvestorBalance = web3.eth.getBalance(investor1);      
      //send 100eth more than the cap of 3rd phase
      await this.crowdsale.buyTokens(investor1, { value: ether(5600), gasPrice: 0 }).should.be.fulfilled;
      const postPurchaseInvestorBalance = web3.eth.getBalance(investor1);
      //should return 100eth to investor
      web3.fromWei(prePurchaseInvestorBalance.minus(postPurchaseInvestorBalance)).should.be.bignumber.equal(5500);
    });
    it('should return funds to investor when too much eth was sent in the uncapped phase', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      
      const prePurchaseInvestorBalance = web3.eth.getBalance(investor1);      
      //send 100eth more than the total ico cap
      await this.crowdsale.buyTokens(investor1, { value: ether(44900), gasPrice: 0 }).should.be.fulfilled;
      const postPurchaseInvestorBalance = web3.eth.getBalance(investor1);
      //should return 100eth to investor
      web3.fromWei(prePurchaseInvestorBalance.minus(postPurchaseInvestorBalance)).should.be.bignumber.equal(44800);
    });
  });

  //TODO: add if any prepwork needed
  describe('finalization and tokens distribution', function() {
    it('should not allow finalize before closing time and tokens not sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.finalize().should.be.rejectedWith(EVMRevert);
    });
    it('should allow finalize after closing time and tokens not sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize().should.be.fulfilled;
    });
    it('should allow finalize before closing time and tokens are sold', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(44800) }).should.be.fulfilled;
      await this.crowdsale.finalize().should.be.fulfilled;
    });
    it('should transfer ownership when finallized', async function () {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize().should.be.fulfilled;
      const owner = await this.token.owner();
      owner.should.be.equal(wallet);
    });
    it('should finish minting when finalized', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize().should.be.fulfilled;
      let mintingFinished = await this.token.mintingFinished();
      mintingFinished.should.be.equal(true);
    });
    it('should assign correct ammount of tokens to foundation when no tokens where sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let foundationBalance = await this.token.balanceOf(foundation);
      let tokenCap = await this.token.cap();
      let expectedfoundationBalance = new BigNumber(tokenCap).times(foundationPercentage/100);
      foundationBalance.should.be.bignumber.equal(expectedfoundationBalance);
    });
    it('should assign correct ammount of tokens to foundation when all tokens where sold', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(50000) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let foundationBalance = await this.token.balanceOf(foundation);
      let tokenCap = await this.token.cap();
      let expectedfoundationBalance = new BigNumber(tokenCap).times(foundationPercentage/100);
      foundationBalance.should.be.bignumber.equal(expectedfoundationBalance);
    });
    it('should assign correct ammount of tokens to private presale wallet when no tokens where sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let presaleWalletBalance = await this.token.balanceOf(presaleWallet);
      let tokenCap = await this.token.cap();
      let expectedPresaleWalletBalance = presaleCap;
      presaleWalletBalance.should.be.bignumber.equal(expectedPresaleWalletBalance);
    });
    it('should assign correct ammount of tokens to private presale wallet when all tokens where sold', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(50000) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let presaleWalletBalance = await this.token.balanceOf(presaleWallet);
      let tokenCap = await this.token.cap();
      let expectedPresaleWalletBalance = presaleCap;
      presaleWalletBalance.should.be.bignumber.equal(expectedPresaleWalletBalance);
    });
    it('should not assign any tokens to lockup when all tokens where sold', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(70000) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let lockupBalance = await this.token.balanceOf(lockupWallet);
      lockupBalance.should.be.bignumber.equal(0);
    });
    it('should assign leftover tokens to lockup when some tokens where sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, { value: ether(10) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let investorBalance = await this.token.balanceOf(investor1);
      let lockupBalance = await this.token.balanceOf(lockupWallet);
      let totalBalance = investorBalance.plus(lockupBalance);
      totalBalance.should.be.bignumber.equal(totalIcoCap);
    });
    it('should assign all ico tokens to lockup when no tokens where sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let lockupBalance = await this.token.balanceOf(lockupWallet);
      lockupBalance.should.be.bignumber.equal(totalIcoCap);
    });
    it('should not allow finalize when finalized', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize().should.be.fulfilled;
      await this.crowdsale.finalize().should.be.rejectedWith(EVMRevert);
    });
  });
});
