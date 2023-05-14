// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Erc20Xchange {

    enum Side {
        BUY,
        SELL
    }

    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    struct Order {
        uint id;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint filled;
        uint price;
        uint timestamp;
    }

    mapping(bytes32 => Token) public tokens;
    bytes32[] public tokenList;
    mapping(address => mapping(bytes32 => uint)) public traderBalances;
    mapping(bytes32 => mapping(uint => Order[])) public orderBook;
    address public admin;
    uint public nextOrderId;
    uint public nextTradeId;
    bytes32 constant USDC = bytes32('USDC');
    mapping(uint => TokenProposal) public tokenProposals;
    address[] public trustedParties;
    uint public requiredApprovals;


    event NewTrade(
        uint tradeId,
        uint orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint amount,
        uint price,
        uint date
    );

    struct TokenProposal {
        bytes32 ticker;
        address tokenAddress;
        uint approvals;
        mapping(address => bool) approvedBy;
    }


    modifier tokenIsNotUSDC(bytes32 ticker) {
        require(ticker != USDC, 'cannot trade USDC');
        _;
    }

    modifier tokenExist(bytes32 ticker) {
        require(
            tokens[ticker].tokenAddress != address(0),
            'this token does not exist'
        );
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, 'only admin');
        _;
    }

    constructor(address[] memory _trustedParties, uint _requiredApprovals)  {
        admin = msg.sender;
        trustedParties = _trustedParties;
        requiredApprovals = _requiredApprovals;
    }

    /**
    * @dev Return List in order book filter by ticker and side
    * @param ticker token type
    * @param side  BUY or SELL
    * @return list of order book filter by ticker and side
    */
    function getOrders(bytes32 ticker, Side side) external view returns(Order[] memory) {
        return orderBook[ticker][uint(side)];
    }

    /**
    * @dev Return Token List
    * @return a token list
    */
    function getTokens() external view returns(Token[] memory) {
        Token[] memory _tokens = new Token[](tokenList.length);
        for (uint i = 0; i < tokenList.length; i++) {
            _tokens[i] = Token(
                tokens[tokenList[i]].ticker,
                tokens[tokenList[i]].tokenAddress
            );
        }
        return _tokens;
    }

    function proposeToken(bytes32 ticker, address tokenAddress) external onlyTrustedParty() {
        uint proposalId = tokenList.length;
        tokenProposals[proposalId].ticker = ticker;
        tokenProposals[proposalId].tokenAddress = tokenAddress;
        tokenProposals[proposalId].approvals = 0;
    }

    function approveTokenProposal(uint proposalId) external onlyTrustedParty() {
        TokenProposal storage proposal = tokenProposals[proposalId];
        require(!proposal.approvedBy[msg.sender], "Already approved");
        proposal.approvedBy[msg.sender] = true;
        proposal.approvals++;

        if (proposal.approvals >= requiredApprovals) {
            tokens[proposal.ticker] = Token(proposal.ticker, proposal.tokenAddress);
            tokenList.push(proposal.ticker);
        }
    }

    modifier onlyTrustedParty() {
        bool isTrusted = false;
        for (uint i = 0; i < trustedParties.length; i++) {
            if (trustedParties[i] == msg.sender) {
                isTrusted = true;
                break;
            }
        }
        require(isTrusted, "Only trusted parties can call this function");
        _;
    }


    function getTokenKeys() public view returns (bytes32[] memory) {
        return tokenList;
    }

    /**
    * @dev Allow trader to deposit amount from their wallet to their trader balance
    * @param ticker token type to be deposited
    * @param amount  amount
    */
    function deposit(uint amount, bytes32 ticker) tokenExist(ticker) external {
        IERC20(tokens[ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        traderBalances[msg.sender][ticker] += amount;
    }

    /**
    * @dev Withdraw amount from trader balance to trader's wallet
    * @param ticker token type
    * @param amount  amount in trader balance account
    */
    function withdraw(uint amount, bytes32 ticker) tokenExist(ticker) external {
        require(
            traderBalances[msg.sender][ticker] >= amount,
            'balance too low'
        );
        traderBalances[msg.sender][ticker] -= amount;
        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
    }

    /**
    * @dev Create limit order either BUY or SELL
    * @param ticker token type
    * @param amount amount want to trade
    * @param price price limit to perform the trade
    * @param side type of trade, BUY or SELL
    */
    function createLimitOrder(bytes32 ticker, uint amount, uint price, Side side) tokenExist(ticker) tokenIsNotUSDC(ticker) external {

        require(price > 0, 'Price must be greater than 0');

        if(side == Side.SELL) {
            require(traderBalances[msg.sender][ticker] >= amount, 'token balance too low');
        } else {
            require(traderBalances[msg.sender][USDC] >= amount * price, 'USDC balance too low');
        }

        Order[] storage orders = orderBook[ticker][uint(side)];
        Order memory newOrder = Order(
            nextOrderId,
            msg.sender,
            side,
            ticker,
            amount,
            0,
            price,
            block.timestamp
        );

        bool inserted = false;
        for (uint i = 0; i < orders.length; i++) {
            if (side == Side.BUY && (orders[i].price < newOrder.price || (orders[i].price == newOrder.price && orders[i].timestamp > newOrder.timestamp))) {
                orders.push(orders[orders.length - 1]);
                for (uint j = orders.length - 2; j > i; j--) {
                    orders[j] = orders[j - 1];
                }
                orders[i] = newOrder;
                inserted = true;
                break;
            } else if (side == Side.SELL && (orders[i].price > newOrder.price || (orders[i].price == newOrder.price && orders[i].timestamp > newOrder.timestamp))) {
                orders.push(orders[orders.length - 1]);
                for (uint j = orders.length - 2; j > i; j--) {
                    orders[j] = orders[j - 1];
                }
                orders[i] = newOrder;
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            orders.push(newOrder);
        }

        nextOrderId++;
    }


    /**
    * @dev Create market order either BUY or SELL
    * @param ticker token type
    * @param amount amount want to trade
    * @param side type of trade, BUY or SELL
    */
    function createMarketOrder(bytes32 ticker, uint amount, Side side) tokenExist(ticker) tokenIsNotUSDC(ticker) external {
        if(side == Side.SELL) {
            require(traderBalances[msg.sender][ticker] >= amount, 'token balance too low');
        }

        Order[] storage orders = orderBook[ticker][uint(side == Side.BUY ? Side.SELL : Side.BUY)];
        uint remaining = amount;

        while(orders.length > 0 && remaining > 0) {
            uint available = orders[0].amount - orders[0].filled;
            uint matched = (remaining > available) ? available : remaining;
            remaining -= matched;
            orders[0].filled += matched;
            emit NewTrade(
                nextTradeId,
                orders[0].id,
                ticker,
                orders[0].trader,
                msg.sender,
                matched,
                orders[0].price,
                block.timestamp
            );

            if(side == Side.SELL) {
                traderBalances[msg.sender][ticker] -= matched;
                traderBalances[msg.sender][USDC] += (matched * orders[0].price);
                traderBalances[orders[0].trader][ticker] += matched;
                traderBalances[orders[0].trader][USDC] -= (matched * orders[0].price);
            }

            if(side == Side.BUY) {
                require(traderBalances[msg.sender][USDC] >= matched * orders[0].price, 'USDC balance too low');
                traderBalances[msg.sender][ticker] += matched;
                traderBalances[msg.sender][USDC] -= (matched * orders[0].price);
                traderBalances[orders[0].trader][ticker] -= matched;
                traderBalances[orders[0].trader][USDC] += (matched * orders[0].price);
            }

            if(orders[0].filled == orders[0].amount) {
                for(uint i = 0; i < orders.length - 1; i++) {
                    orders[i] = orders[i + 1];
                }
                orders.pop();
            }

            nextTradeId++;
        }
    }
}