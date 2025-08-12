# 🐝 WaspBot

**WaspBot** is a high-performance, framework‑agnostic trading bot library written in **TypeScript**, inspired by the architecture of [Hummingbot](https://github.com/hummingbot/hummingbot).  
It provides the essential building blocks for creating, testing, and running algorithmic trading strategies across multiple exchanges — without binding you to any specific framework or application runtime.

## ✨ Features

- **Vanilla TypeScript Library** – No frameworks, minimal dependencies.
- **Exchange Connectors** – Plug-and-play modules for CEX and DEX integrations.
- **Pluggable Strategies** – Build, test, and optimize strategies with ease.
- **Event-Driven Core** – Powerful clock and event dispatcher for scheduling and reacting to market data.
- **Real-Time Market Data** – Order books, tickers, candles, and trades.
- **Order Management** – Submit, track, and manage orders with position tracking.
- **Reusable Utilities** – HTTP/WebSocket clients, math helpers, and more.
- **Extensible** – Add new connectors, data sources, or strategies without touching the core.

***

## 📦 Installation

```bash
# Using npm
npm install wasp-bot

# Using yarn
yarn add wasp-bot

# Using pnpm
pnpm add wasp-bot
```

***

## 🚀 Quick Start

```typescript
import { Clock, BinanceConnector, PingPongStrategy, OrderManager } from "wasp-bot";

// 1. Create a clock for scheduling ticks
const clock = new Clock(1000); // tick every 1 second

// 2. Set up an exchange connector (Binance example)
const binance = new BinanceConnector({
  apiKey: process.env.BINANCE_API_KEY!,
  apiSecret: process.env.BINANCE_API_SECRET!,
  testnet: true
});

// 3. Create your order manager
const orderManager = new OrderManager(binance);

// 4. Initialize a strategy
const strategy = new PingPongStrategy({
  connector: binance,
  orderManager,
  tradingPair: "BTC/USDT",
  orderSize: 0.001,
  priceSpread: 0.25 // percentage from mid-price
});

// 5. Wire everything together
clock.onTick(async () => {
  await strategy.tick();
});

// 6. Start the bot
(async () => {
  await binance.connect();
  clock.start();
})();
```

***

## 🛠 Writing Your Own Strategy

Strategies in WaspBot follow a simple interface:

```typescript
class MyStrategy {
  constructor(private connector, private orderManager) {}

  async tick() {
    // Fetch market data
    const ticker = await this.connector.getTicker("BTC/USDT");

    // Make a decision
    if (ticker.lastPrice < 30000) {
      await this.orderManager.buy("BTC/USDT", 0.001);
    }
  }
}
```

***

## 📡 Supported Exchanges (Planned & Implemented)

- **Centralized Exchanges (CEX)**
  - [x] Binance  
  - [ ] KuCoin  
  - [ ] Kraken  

- **Decentralized Exchanges (DEX)**
  - [ ] Uniswap (via Web3 / Ethers.js)  
  - [ ] SushiSwap  

***

## 🔬 Testing

```bash
npm run test
```
