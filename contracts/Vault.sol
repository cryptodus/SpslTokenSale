pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/distribution/utils/RefundVault.sol";

contract Vault is RefundVault {

  event RefundsDisabled();

  constructor(address _wallet) public RefundVault(_wallet) {
  }

  function refund(address investor) public onlyOwner {
    super.refund(investor);
  }

  function disableRefunds() onlyOwner public {
    require(state == State.Refunding);
    state = State.Active;
    emit RefundsDisabled();
  }
}
