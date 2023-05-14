// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Bond is ERC20 {
    constructor() ERC20("Bond Token", "BOND") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
