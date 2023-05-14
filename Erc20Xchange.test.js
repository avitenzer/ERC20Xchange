const Erc20Xchange = artifacts.require("Erc20Xchange");
const USDC = artifacts.require("USDC");
const Bond = artifacts.require("Bond");

contract("Erc20Xchange", accounts => {
    let exchange;
    let usdc;
    let bond;
    let trustedParties = [accounts[0], accounts[1], accounts[2]];
    const requiredApprovals = 2;
    const usdcTicker = web3.utils.fromAscii('USDC');
    const bondTicker = web3.utils.fromAscii('BOND');

    before(async () => {
        usdc = await USDC.deployed();
        bond = await Bond.deployed();
        exchange = await Erc20Xchange.new(trustedParties, requiredApprovals);

        // Mint tokens for testing
        await usdc.transfer(accounts[1], web3.utils.toWei('1000', 'ether'), { from: accounts[0] });
        await usdc.transfer(accounts[2], web3.utils.toWei('1000', 'ether'), { from: accounts[0] });

        await bond.transfer(accounts[1], web3.utils.toWei('1000', 'ether'), { from: accounts[0] });
        await bond.transfer(accounts[2], web3.utils.toWei('1000', 'ether'), { from: accounts[0] });

        // Propose and approve token
        await exchange.proposeToken(usdcTicker, usdc.address, {from: accounts[0]});
        await exchange.approveTokenProposal(0, {from: accounts[1]});
        await exchange.approveTokenProposal(0, {from: accounts[2]});

        await exchange.proposeToken(bondTicker, bond.address, {from: accounts[0]});
        await exchange.approveTokenProposal(1, {from: accounts[1]});
        await exchange.approveTokenProposal(1, {from: accounts[2]});
    });

    it("should allow USDC deposit", async () => {
        let depositAmount = web3.utils.toWei('500', 'ether');
        await usdc.approve(exchange.address, depositAmount, {from: accounts[0]});
        await exchange.deposit(depositAmount, usdcTicker, {from: accounts[0]});

        let balance = await exchange.traderBalances(accounts[0], usdcTicker);
        assert.equal(balance.toString(), depositAmount);
    });

    it("should create a limit order", async () => {
        const deposit = web3.utils.toWei('100', 'ether');
        const amount = 1
        const price = web3.utils.toWei('1', 'ether');

        // Approve the exchange to spend the trader's tokens
        await usdc.approve(exchange.address, deposit, {from: accounts[0]});
        await bond.approve(exchange.address, deposit, {from: accounts[0]});
        await usdc.approve(exchange.address, deposit, {from: accounts[1]});
        await bond.approve(exchange.address, deposit, {from: accounts[1]});

        // Traders deposit tokens into the exchange
        await exchange.deposit(deposit, usdcTicker, {from: accounts[0]});
        await exchange.deposit(deposit, bondTicker, {from: accounts[0]});
        await exchange.deposit(deposit, usdcTicker, {from: accounts[1]});
        await exchange.deposit(deposit, bondTicker, {from: accounts[1]});


        const traderAUsdcBalanceBefore = await exchange.traderBalances(accounts[0], usdcTicker);

        console.log('traderAUsdcBalanceBefore', traderAUsdcBalanceBefore.toString());
        console.log('amount', amount.toString());
        console.log('price', price.toString());
        // Traders create limit orders
        await exchange.createLimitOrder(bondTicker, amount, price, 0, {from: accounts[0]}); // BUY
        await exchange.createLimitOrder(bondTicker, amount, price, 1, {from: accounts[1]}); // SELL

        // Retrieve orders
        const buyOrders = await exchange.getOrders(bondTicker, 0); // BUY
        const sellOrders = await exchange.getOrders(bondTicker, 1); // SELL

        // Validate buy order
        assert(buyOrders.length === 1);
        assert(buyOrders[0].trader === accounts[0]);
        assert(web3.utils.hexToAscii(buyOrders[0].ticker).replace(/\0/g, '') === web3.utils.hexToAscii( bondTicker ));
        assert(buyOrders[0].price === price);
        assert(buyOrders[0].amount.toString() === amount.toString());
        assert(buyOrders[0].side === '0'); // BUY

        // Validate sell order
        assert(sellOrders.length === 1);
        assert(sellOrders[0].trader === accounts[1]);
        assert(web3.utils.hexToAscii ( sellOrders[0].ticker).replace(/\0/g, '') === web3.utils.hexToAscii(bondTicker));
        assert(sellOrders[0].price === price);
        assert(sellOrders[0].amount.toString() === amount.toNumber());
        assert(sellOrders[0].side === '1'); // SELL
    });

});
