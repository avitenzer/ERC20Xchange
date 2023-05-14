
const USDCCoin = artifacts.require("USDC");
const Bond = artifacts.require("Bond");
const Erc20Xchange = artifacts.require("Erc20Xchange");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(USDCCoin);
  deployer.deploy(Bond);

  const trustedParties = [accounts[0], accounts[1], accounts[2]];
  const requiredApprovals = 2;

  deployer.deploy(Erc20Xchange, trustedParties, requiredApprovals);
};
