pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/TokenVesting.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Token.sol";

contract TeamTokenHolder is TokenVesting {
    using SafeMath for uint256;

    function TeamTokenHolder(address _owner, address _beneficiary, uint256 _start, uint256 _cliff, uint256 _duration) public 
        TokenVesting(_beneficiary, _start, _cliff, duration, true)
    {
        owner = _owner;
    }
}