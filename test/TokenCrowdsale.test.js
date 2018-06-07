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
  let foundation = accounts[3];
  let investor2 = accounts[5];
  let founder = accounts[6];
  let presaleWallet = accounts[7];
  let investor3 = accounts[8];
  let investor4 = accounts[9];

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
    this.vestingToken = await TeamTokenHolder.new(foundation, this.closingTime, vestingCliff, vestingDuration);
    this.crowdsale = await TokenCrowdsale.new(this.token.address, wallet, uncappedPhaseRate,
      rates, caps, this.openingTime, this.closingTime, this.uncappedOpeningTime,
      foundation, foundationPercentage, this.vestingToken.address, presaleWallet);
    await this.token.transferOwnership(this.crowdsale.address);
  });

  describe('purchasing tokens', function() {
    it('should not accept payments before opening time', async function() {
      await increaseTimeTo(latestTime());
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should accept payments during crowdsale', async function() {
       await increaseTimeTo(this.openingTime + duration.weeks(1));
       await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
    });
    it('should not allow buy tokens if all capped are bought and uncapped phase not started yet', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(20000) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(founder, {from: founder, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should allow buy tokens if all capped are bought and uncapped phase started', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(20000) }).should.be.fulfilled;
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(founder, {from: founder, value: ether(1) }).should.be.fulfilled;
    });
    it('should allow buy tokens if no tokens bought and uncapped phase started', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(founder, {from: investor1, value: ether(1) }).should.be.fulfilled;
    });
    it('should not accept payments after closing time', async function() {
       await increaseTimeTo(this.closingTime + duration.weeks(1));
       await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should assign correct amount of tokens in the capped first phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let assignedBalance = await this.crowdsale.balances(investor1);
      let balance = await this.token.balanceOf(investor1);
      assignedBalance.should.be.bignumber.equal(rates[0]*1e18);
      balance.should.be.bignumber.equal(0);
    });
    it('should buy correct amount of tokens in the capped second phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor2, {from: investor2, value: ether(5500) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let assignedBalance = await this.crowdsale.balances(investor1);
      let balance = await this.token.balanceOf(investor1);
      assignedBalance.should.be.bignumber.equal(rates[1]*1e18);
      balance.should.be.bignumber.equal(0);
    });
    it('should buy correct amount of tokens in the capped third phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor2, {from: investor2, value: ether(11000) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let assignedBalance = await this.crowdsale.balances(investor1);
      let balance = await this.token.balanceOf(investor1);
      assignedBalance.should.be.bignumber.equal(rates[2]*1e18);
      balance.should.be.bignumber.equal(0);
    });
    it('should buy correct amount of tokens in the uncapped phase', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      let assignedBalance = await this.crowdsale.balances(investor1);
      let balance = await this.token.balanceOf(investor1);
      assignedBalance.should.be.bignumber.equal(uncappedPhaseRate* 1e18);
      balance.should.be.bignumber.equal(0);
    });
    it('should not forward funds to wallet after purchase in the capped phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));

      var amount = ether(1);
      const prePurchaseBalance = web3.eth.getBalance(wallet);
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: amount }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(wallet);
      postPurchaseBalance.should.be.bignumber.equal(prePurchaseBalance);
    });
    it('should not forward funds to wallet after purchase in the uncapped phase', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));

      var amount = ether(1);
      const prePurchaseBalance = web3.eth.getBalance(wallet);
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: amount }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(wallet);
      postPurchaseBalance.should.be.bignumber.equal(prePurchaseBalance);
    });
    it('should return funds to investor when too much eth was sent in the last capped phase', async function() {
      //buy out first 2 capped phases
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(11000) }).should.be.fulfilled;

      const prePurchaseInvestorBalance = web3.eth.getBalance(investor1);
      //send 100eth more than the cap of 3rd phase
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(5600), gasPrice: 0 }).should.be.fulfilled;
      const postPurchaseInvestorBalance = web3.eth.getBalance(investor1);
      //should return 100eth to investor
      web3.fromWei(prePurchaseInvestorBalance.minus(postPurchaseInvestorBalance)).should.be.bignumber.equal(5500);
    });
    it('should return funds to investor when too much eth was sent in the uncapped phase', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));

      const prePurchaseInvestorBalance = web3.eth.getBalance(investor1);
      //send 100eth more than the total ico cap
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(44900), gasPrice: 0 }).should.be.fulfilled;
      const postPurchaseInvestorBalance = web3.eth.getBalance(investor1);
      //should return 100eth to investor
      web3.fromWei(prePurchaseInvestorBalance.minus(postPurchaseInvestorBalance)).should.be.bignumber.equal(44800);
    });
    it('should not mint any tokens while purchasing in capped phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(44900), gasPrice: 0 }).should.be.fulfilled;
      let totalSupply = await this.token.totalSupply();
      totalSupply.should.be.bignumber.equal(0);
    });
    it('should not mint any tokens while purchasing in uncapped phase', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(44900), gasPrice: 0 }).should.be.fulfilled;
      let totalSupply = await this.token.totalSupply();
      totalSupply.should.be.bignumber.equal(0);
    });
  });

  describe('forwarding tokens', function() {
    it('should not allow withdraw tokens ever', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.withdrawTokens().should.be.rejectedWith(EVMRevert);
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.withdrawTokens().should.be.rejectedWith(EVMRevert);
    });
    it('should not allow forward tokens before closing time and tokens not sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor1]).should.be.rejectedWith(EVMRevert);
    });
    it('should allow forward tokens after closing time and tokens not sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor1]).should.be.fulfilled;
    });
    it('should allow forward tokens before closing time and tokens are sold', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(44800) }).should.be.fulfilled;
      await this.crowdsale.forwardTokens([investor1]).should.be.fulfilled;
    });
    it('should forward tokens when bought and whitelisted', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor1]).should.be.fulfilled;
      let assignedBalance = await this.crowdsale.balances(investor1);
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(uncappedPhaseRate* 1e18);
      assignedBalance.should.be.bignumber.equal(0);
    });
    it('should not forward same tokens twice when bought and whitelisted', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(1) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor1]).should.be.fulfilled;
      let assignedBalance = await this.crowdsale.balances(investor1);
      let balance = await this.token.balanceOf(investor1);
      balance.should.be.bignumber.equal(uncappedPhaseRate* 1e18);
      assignedBalance.should.be.bignumber.equal(0);
      await this.crowdsale.forwardTokens([investor1]).should.be.fulfilled;
      let assignedBalance1 = await this.crowdsale.balances(investor1);
      let balance1 = await this.token.balanceOf(investor1);
      balance1.should.be.bignumber.equal(uncappedPhaseRate* 1e18);
      assignedBalance1.should.be.bignumber.equal(0);
    });
    it('should not forward tokens when bought and not whitelisted', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor2, {from: investor2, value: ether(1) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor1]).should.be.fulfilled;
      let assignedBalance = await this.crowdsale.balances(investor2);
      let balance = await this.token.balanceOf(investor2);
      assignedBalance.should.be.bignumber.equal(uncappedPhaseRate* 1e18);
      balance.should.be.bignumber.equal(0);
    });
  });

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
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(44800) }).should.be.fulfilled;
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
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(50000) }).should.be.fulfilled;
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
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(50000) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let presaleWalletBalance = await this.token.balanceOf(presaleWallet);
      let tokenCap = await this.token.cap();
      let expectedPresaleWalletBalance = presaleCap;
      presaleWalletBalance.should.be.bignumber.equal(expectedPresaleWalletBalance);
    });
    it('should not assign any tokens to lockup when all tokens where sold', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(70000) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor1]);
      await this.crowdsale.finalize();
      let lockupBalance = await this.token.balanceOf(this.vestingToken.address);
      lockupBalance.should.be.bignumber.equal(0);
    });
    it('should assign leftover tokens to lockup when some tokens where sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(10) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let investorBalance = await this.token.balanceOf(investor1);
      let lockupBalance = await this.token.balanceOf(this.vestingToken.address);
      let totalBalance = investorBalance.plus(lockupBalance);
      totalBalance.should.be.bignumber.equal(totalIcoCap);
    });
    it('should assign all ico tokens to lockup when no tokens where sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let lockupBalance = await this.token.balanceOf(this.vestingToken.address);
      lockupBalance.should.be.bignumber.equal(totalIcoCap);
    });
    it('should not allow finalize when finalized', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize().should.be.fulfilled;
      await this.crowdsale.finalize().should.be.rejectedWith(EVMRevert);
    });
    it('should forward funds to wallet when whitelisted and finalized', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      const prePurchaseBalance = web3.eth.getBalance(wallet);
      await this.crowdsale.buyTokens(investor1, {from: investor1, value:  ether(1) }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(wallet);
      postPurchaseBalance.should.be.bignumber.equal(prePurchaseBalance);
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor1]).should.be.fulfilled;
      await this.crowdsale.finalize().should.be.fulfilled;
      const postFinalizeBalance = web3.eth.getBalance(wallet);
      postFinalizeBalance.minus(postPurchaseBalance).should.be.bignumber.equal(ether(1));
    });
    it('should not receive any funds to wallet when not whitelisted and finalized', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      const prePurchaseBalance = web3.eth.getBalance(wallet);
      await this.crowdsale.buyTokens(investor1, {from: investor1, value:  ether(1) }).should.be.fulfilled;
      const postPurchaseBalance = web3.eth.getBalance(wallet);
      postPurchaseBalance.should.be.bignumber.equal(prePurchaseBalance);
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor2]).should.be.fulfilled;
      await this.crowdsale.finalize().should.be.fulfilled;
      const postFinalizeBalance = web3.eth.getBalance(wallet);
      postFinalizeBalance.minus(postPurchaseBalance).should.be.bignumber.equal(ether(0));
    });
    it('should return funds to investor when not whitelisted and finalized', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      const prePurchaseBalance = await web3.eth.getBalance(investor3);
      await this.crowdsale.buyTokens(investor3, {from: investor3, value:  ether(1) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor4, {from: investor4, value:  ether(1) }).should.be.fulfilled;
      const postPurchaseBalance = await web3.eth.getBalance(investor3);
      postPurchaseBalance.should.be.bignumber.gt(prePurchaseBalance.minus(ether(1.1)));
      postPurchaseBalance.should.be.bignumber.lt(prePurchaseBalance.minus(ether(1.0)));
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor4]).should.be.fulfilled;
      await this.crowdsale.finalize().should.be.fulfilled;
      const postFinalizeBalance = await web3.eth.getBalance(investor3);
      postFinalizeBalance.should.be.bignumber.gt(prePurchaseBalance.minus(ether(0.1)));
      postFinalizeBalance.should.be.bignumber.lt(prePurchaseBalance);
    });
    it('should not return funds to investor when whitelisted and finalized', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      const prePurchaseBalance = await web3.eth.getBalance(investor3);
      await this.crowdsale.buyTokens(investor3, {from: investor3, value:  ether(1) }).should.be.fulfilled;
      const postPurchaseBalance = await web3.eth.getBalance(investor3);
      postPurchaseBalance.should.be.bignumber.gt(prePurchaseBalance.minus(ether(1.1)));
      postPurchaseBalance.should.be.bignumber.lt(prePurchaseBalance.minus(ether(1.0)));
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.forwardTokens([investor3]).should.be.fulfilled;
      await this.crowdsale.finalize().should.be.fulfilled;
      const postFinalizeBalance = await web3.eth.getBalance(investor3);
      postPurchaseBalance.should.be.bignumber.gt(prePurchaseBalance.minus(ether(1.1)));
      postPurchaseBalance.should.be.bignumber.lt(prePurchaseBalance.minus(ether(1.0)));
    });
  });

  describe('token vesting', function() {
    it('should not allow to revoke vesting token', async function() {
      await this.vestingToken.revoke(this.token.address, { from: wallet }).should.be.rejectedWith(EVMRevert);
    });
    it('should not allow to be released before cliff', async function () {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(10) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();

      await this.token.unpause({ from: wallet });
      await this.vestingToken.release(this.token.address).should.be.rejectedWith(EVMRevert);
    });
    it('should allow to be released after cliff', async function () {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor1, {from: investor1, value: ether(10) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();

      await this.token.unpause({ from: wallet });
      await increaseTimeTo(this.closingTime + vestingCliff + duration.weeks(1));
      await this.vestingToken.release(this.token.address).should.be.fulfilled;
    });
  });
});
