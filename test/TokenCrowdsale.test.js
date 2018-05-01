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

contract('TokenCrowdsaleTest', function (accounts) {
  let investor = accounts[0];
  let wallet = accounts[1];
  // should create tokenVesting wallet for the lockup
  let lockupWallet = accounts[2];
  let fundation = accounts[3];
  let advisor = accounts[5];
  let founder = accounts[6];

  let uncappedPhaseRate = 10000;
  let caps = [71500e21, 137500e21, 198000e21];
  let rates = [13000, 12000, 11000];
  let openingTime = latestTime() + duration.weeks(1);
  let closingTime = openingTime + duration.days(60);
  let uncappedOpeningTime = openingTime + duration.days(15);
  let totalIcoCap = 448e24;
  let fundationPercentage = 40;
  let icoPercentage = 60;

  beforeEach(async function () {
    this.token = await Token.new();
    this.crowdsale = await TokenCrowdsale.new(this.token.address, wallet, uncappedPhaseRate, rates, caps, openingTime, closingTime, uncappedOpeningTime, totalIcoCap);
  });

  describe('check initial setup', function() {
    it('should have token deployed', async function() {
      let totalSupply = await this.token.totalSupply();
      totalSupply.should.be.bignumber.equal(0);
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
      await increaseTimeTo(this.openingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(5000) }).should.be.fulfilled;
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
      let expectedFundationBalance = tokenCap * 100 / fundationPercentage;
      fundationBalance.should.be.bignumber.equal(expectedFundationBalance);
    });
    it('should assign correct ammount of tokens to fundation when all tokens where sold', async function() {
      //TODO: fix the amount of eth so to make sure all tokens were bought
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(5000) }).should.be.fulfilled;
      await this.crowdsale.finalize();
      let fundationBalance = await this.token.balanceOf(fundation);
      let tokenCap = await this.token.cap();
      let expectedFundationBalance = tokenCap * 100 / fundationPercentage;
      fundationBalance.should.be.bignumber.equal(expectedFundationBalance);
    });
    it('should not assign any tokens to lockup when all tokens where sold', async function() {
      //TODO: fix the amount of eth so to make sure all tokens were bought
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(5000) }).should.be.fulfilled;
      await this.crowdsale.finalize();
      let lockupBalance = await this.token.balanceOf(lockupWallet);
      lockupBalance.should.be.bignumber.equal(0);
    });
    it('should assign leftover tokens to lockup when some tokens where sold', async function() {
      //TODO: fix the amount of eth so to make sure all tokens were bought
      await increaseTimeTo(this.closingTime + duration.weeks(1));
      await this.crowdsale.buyTokens(investor, { value: ether(10) }).should.be.fulfilled;
      await this.crowdsale.finalize();
      let investorBalance = await this.token.balanceOf(investor);
      let lockupBalance = await this.token.balanceOf(lockupWallet);
      let totalBalance = investorBalance + lockupBalance;
      totalBalance.should.be.bignumber.equal(totalIcoCap);
    });
    it('should not assign all ico tokens to lockup when no tokens where sold', async function() {
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
