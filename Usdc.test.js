const USDCCoin = artifacts.require("USDC");

contract("USDC", accounts => {
    it("should put 1000000 USDC in the first account", async () => {
        let instance = await USDCCoin.deployed();
        let balance = await instance.balanceOf.call(accounts[0]);
        assert.equal(balance.valueOf(), 1000000 * 10**18);
    });

    it("should transfer 1000 USDC from the first account to the second", async () => {
        let instance = await USDCCoin.deployed();

        // Transfer 1000 tokens from account 0 to account 1
        await instance.transfer(accounts[1], web3.utils.toWei('1000', 'ether'), { from: accounts[0] });

        // Check balances after transfer
        let balance0 = await instance.balanceOf.call(accounts[0]);
        let balance1 = await instance.balanceOf.call(accounts[1]);

        assert.equal(balance0.valueOf(), web3.utils.toWei('999000', 'ether'), "Balance of account 0 is incorrect after transfer");
        assert.equal(balance1.valueOf(), web3.utils.toWei('1000', 'ether'), "Balance of account 1 is incorrect after transfer");
    });

    it("should fail to transfer if the sender doesn't have enough balance", async () => {
        let instance = await USDCCoin.deployed();

        try {
            await instance.transfer(accounts[1], web3.utils.toWei('1000001', 'ether'), { from: accounts[0] });
        } catch (error) {
            assert(error.message.includes('revert'), "Expected revert, got " + error.message);
        }

        // Check balances to make sure they haven't changed
        let balance0 = await instance.balanceOf.call(accounts[0]);
        let balance1 = await instance.balanceOf.call(accounts[1]);

        assert.equal(balance0.toString(), web3.utils.toWei('999000', 'ether'));
        assert.equal(balance1.toString(), web3.utils.toWei('1000', 'ether'));
    });

    it("should allow an account to approve another to spend tokens on its behalf", async () => {
        let instance = await USDCCoin.deployed();

        // Account 0 approves Account 1 to spend 500 tokens on its behalf
        await instance.approve(accounts[1], web3.utils.toWei('500', 'ether'), { from: accounts[0] });

        // Check the approved amount
        let allowance = await instance.allowance.call(accounts[0], accounts[1]);
        assert.equal(allowance.toString(), web3.utils.toWei('500', 'ether'), "Allowance is incorrect");
    });

    it("should transfer tokens between accounts when approved", async () => {
        let instance = await USDCCoin.deployed();

        // Account 1 transfers 500 tokens from Account 0 to itself
        await instance.transferFrom(accounts[0], accounts[1], web3.utils.toWei('500', 'ether'), { from: accounts[1] });

        // Check balances after transfer
        let balance0 = await instance.balanceOf.call(accounts[0]);
        let balance1 = await instance.balanceOf.call(accounts[1]);

        assert.equal(balance0.toString(), web3.utils.toWei('998500', 'ether'), "Balance of account 0 is incorrect after transfer");
        assert.equal(balance1.toString(), web3.utils.toWei('1500', 'ether'), "Balance of account 1 is incorrect after transfer");

        // Check the approved amount has been deducted
        let allowance = await instance.allowance.call(accounts[0], accounts[1]);
        assert.equal(allowance.toString(), web3.utils.toWei('0', 'ether'), "Allowance is incorrect");
    });

    it("should allow an account to approve another to spend tokens on its behalf", async () => {
        let instance = await USDCCoin.deployed();

        // Account 0 approves Account 1 to spend 500 tokens on its behalf
        await instance.approve(accounts[1], web3.utils.toWei('500', 'ether'), { from: accounts[0] });

        // Check the approved amount
        let allowance = await instance.allowance.call(accounts[0], accounts[1]);
        assert.equal(allowance.toString(), web3.utils.toWei('500', 'ether'), "Allowance is incorrect");
    });

});
