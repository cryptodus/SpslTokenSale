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
  let purchaser = accounts[2];
  let platform = accounts[3];
  let advisor = accounts[5];
  let founder = accounts[6];

  let uncappedPhaseRate = 10000;
  let caps = [71500e21, 137500e21, 198000e21];
  let rates = [13000, 12000, 11000];
  let totalIcoCap = 448e24;

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
      rates, caps, this.openingTime, this.closingTime, this.uncappedOpeningTime, totalIcoCap);
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
});
