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
  let investor = accounts[0];
  let wallet = accounts[1];
  // should create tokenVesting wallet for the lockup
  let lockupWallet = accounts[2];
  let fundation = accounts[3];
  let purchaser = accounts[5];
  let founder = accounts[6];

  let uncappedPhaseRate = 10000;
  let caps = [71500e21, 137500e21, 198000e21];
  let rates = [13000, 12000, 11000];
  let totalIcoCap = 448e24;
  let fundationPercentage = 40;
  let icoPercentage = 60;

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
      rates, caps, this.openingTime, this.closingTime, this.uncappedOpeningTime, totalIcoCap,
      fundation, fundationPercentage, lockupWallet);
    await this.token.transferOwnership(this.crowdsale.address);
  });

  describe('purchasing tokens', function() {
    it('should not accept payments before opening time', async function() {
      await increaseTimeTo(latestTime());
      await this.crowdsale.buyTokens(investor, { value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should accept payments during crowdsale', async function() {
       await increaseTimeTo(this.openingTime + duration.weeks(1));
       await this.crowdsale.buyTokens(investor, { value: ether(1) }).should.be.fulfilled;
    });
    it('should not allow buy tokens if all capped are bought and uncapped phase not started yet', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(20000) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(founder, { value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should allow buy tokens if all capped are bought and uncapped phase started', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(20000) }).should.be.fulfilled;
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(founder, { value: ether(1) }).should.be.fulfilled;
    });
    it('should allow buy tokens if no tokens bought and uncapped phase started', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(founder, { value: ether(1) }).should.be.fulfilled;
    });
    it('should not accept payments after closing time', async function() {
       await increaseTimeTo(this.closingTime + duration.weeks(1));
       await this.crowdsale.buyTokens(investor, { value: ether(1) }).should.be.rejectedWith(EVMRevert);
    });
    it('should buy correct amount of tokens in the capped first phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor);
      balance.should.be.bignumber.equal(rates[0]*1e18);
    });
    it('should buy correct amount of tokens in the capped second phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(purchaser, { value: ether(5500) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor, { value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor);
      balance.should.be.bignumber.equal(rates[1]*1e18);
    });
    it('should buy correct amount of tokens in the capped third phase', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(purchaser, { value: ether(11000) }).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor, { value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor);
      balance.should.be.bignumber.equal(rates[2]*1e18);
    });
    it('should buy correct amount of tokens in the uncapped phase', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(1) }).should.be.fulfilled;
      let balance = await this.token.balanceOf(investor);
      balance.should.be.bignumber.equal(uncappedPhaseRate* 1e18);
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
      await this.crowdsale.buyTokens(investor, { value: ether(42000) }).should.be.fulfilled;
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
    it('should assign correct ammount of tokens to fundation when no tokens where sold', async function() {
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let fundationBalance = await this.token.balanceOf(fundation);
      let tokenCap = await this.token.cap();
      let expectedFundationBalance = new BigNumber(tokenCap).times(fundationPercentage/100);
      fundationBalance.should.be.bignumber.equal(expectedFundationBalance);
    });
    it('should assign correct ammount of tokens to fundation when all tokens where sold', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(50000) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let fundationBalance = await this.token.balanceOf(fundation);
      let tokenCap = await this.token.cap();
      let expectedFundationBalance = new BigNumber(tokenCap).times(fundationPercentage/100);
      fundationBalance.should.be.bignumber.equal(expectedFundationBalance);
    });
    it('should not assign any tokens to lockup when all tokens where sold', async function() {
      await increaseTimeTo(this.uncappedOpeningTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(70000) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let lockupBalance = await this.token.balanceOf(lockupWallet);
      lockupBalance.should.be.bignumber.equal(0);
    });
    it('should assign leftover tokens to lockup when some tokens where sold', async function() {
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(10) }).should.be.fulfilled;
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.finalize();
      let investorBalance = await this.token.balanceOf(investor);
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
