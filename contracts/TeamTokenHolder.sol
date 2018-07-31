pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/TokenVesting.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Token.sol";

contract TeamTokenHolder is TokenVesting {
    using SafeMath for uint256;

    constructor(address _beneficiary, uint256 _start, uint256 _cliff, uint256 _duration) public
        TokenVesting(_beneficiary, _start, _cliff, _duration, false)
    {
    }
}
