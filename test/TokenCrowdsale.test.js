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
  let openingTime = latestTime() + duration.weeks(1);
  let closingTime = openingTime + duration.days(60);
  let uncappedOpeningTime = openingTime + duration.days(15);
  let totalIcoCap = 448e24;

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
});
