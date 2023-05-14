const Erc20Xchange = artifacts.require('Erc20Xchange');
const USDC = artifacts.require('USDC');
const Bond = artifacts.require('Bond');

contract('Erc20Xchange', ([alice, bob, ...trustedParties]) => {
    let exchange;
    let usdc;
    let bond;
    const usdcTicker = web3.utils.fromAscii('USDC');
    const bondTicker = web3.utils.fromAscii('BOND');

    before(async () => {
        exchange = await Erc20Xchange.deployed();
        usdc = await USDC.deployed();
        bond = await Bond.deployed();

        // The following assumes that Alice and Bob have enough USDC and BOND respectively.
        await usdc.transfer(alice, web3.utils.toWei('10000'));
        await bond.transfer(bob, web3.utils.toWei('10000'));

        // Alice and Bob allow the exchange to handle their tokens.
        await usdc.approve(exchange.address, web3.utils.toWei('10000'), {from: alice});
        await bond.approve(exchange.address, web3.utils.toWei('10000'), {from: bob});


        // Propose and approve token
        await exchange.proposeToken(usdcTicker, usdc.address, {from: accounts[0]});
        await exchange.approveTokenProposal(0, {from: accounts[1]});
        await exchange.approveTokenProposal(0, {from: accounts[2]});

        await exchange.proposeToken(bondTicker, bond.address, {from: accounts[0]});
        await exchange.approveTokenProposal(1, {from: accounts[1]});
        await exchange.approveTokenProposal(1, {from: accounts[2]});
        
    });

    it('should create a market order', async () => {
        // Alice deposits 5000 USDC into the exchange.
        await exchange.deposit(web3.utils.toWei('5000'), usdcTicker, {from: alice});

        // Bob deposits 1000 BOND into the exchange.
        await exchange.deposit(web3.utils.toWei('1000'), bondTicker, {from: bob});

        // Alice creates a limit order to buy 100 BOND for 10 USDC each.
        await exchange.createLimitOrder(bondTicker, web3.utils.toWei('100'), 10, Erc20Xchange.SIDE.BUY, {from: alice});

        // Bob creates a market order to sell 50 BOND.
        await exchange.createMarketOrder(bondTicker, web3.utils.toWei('50'), Erc20Xchange.SIDE.SELL, {from: bob});

        const sellOrders = await exchange.getOrders(bondTicker, Erc20Xchange.SIDE.SELL);
        const buyOrders = await exchange.getOrders(bondTicker, Erc20Xchange.SIDE.BUY);

        // Ensure the sell order book is still empty (market order was filled).
        assert(sellOrders.length === 0);

        // Ensure the buy order has 50 BOND left (half of the market order was filled).
        assert(web3.utils.fromWei(buyOrders[0].amount) === '50');
    });
});
