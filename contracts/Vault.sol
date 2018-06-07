pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/crowdsale/distribution/utils/RefundVault.sol";

/*
  Custom refund vault that allows onlyOwner to do refunding.
  Also it allows to stop refunding process
*/
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
