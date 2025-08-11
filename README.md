# WaspBot 🐝

**A TypeScript Port of Hummingbot - Open Source Crypto Trading Framework**

[![Build Status](https://github.com/WaspBot/wasp-bot/workflows/CI/badge.svg)](https://github.com/WaspBot/wasp-bot/actions)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red.svg)](https://nestjs.com/)

WaspBot is a modern, TypeScript-based port of the popular [Hummingbot](https://github.com/hummingbot/hummingbot) algorithmic trading framework. Built on NestJS, it provides a scalable, maintainable, and developer-friendly platform for creating and deploying high-frequency crypto trading bots.

## 🚀 Key Features

### 📈 **Strategy Framework**
- **V1 Strategies**: Direct TypeScript ports of classic Hummingbot strategies
- **V2 Framework**: Modern modular architecture with Scripts, Controllers, and Executors
- **Custom Indicators**: Technical analysis indicators and custom market metrics
- **Backtesting**: Comprehensive backtesting engine with historical data

### 🔗 **Exchange Connectors**
- **CEX Support**: Binance, OKX, Coinbase Pro, KuCoin, and more
- **DEX Integration**: Uniswap, PancakeSwap, SushiSwap via Gateway
- **Real-time Data**: WebSocket-based order book and trade feeds
- **Order Management**: Advanced order tracking and lifecycle management

### 🏗️ **Architecture**
- **Microservices**: Modular microservice architecture with NestJS
- **Event-Driven**: Comprehensive event system for market and trading events
- **Clock System**: Precise timing mechanism for strategy execution
- **Database**: PostgreSQL with TypeORM for data persistence

### 🌐 **API & Dashboard**
- **REST API**: Full-featured API for bot management and monitoring
- **WebSocket**: Real-time updates and live trading data
- **Dashboard**: Web-based interface for strategy deployment and monitoring
- **Authentication**: JWT-based security with role-based access

### ⚡ **Performance & Reliability**
- **High Performance**: Optimized for low-latency trading
- **Fault Tolerance**: Graceful error handling and automatic recovery
- **Rate Limiting**: Built-in rate limiting for exchange compliance
- **Logging**: Comprehensive logging and monitoring

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 14+
- Redis 6+

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/WaspBot/wasp-bot.git
cd wasp-bot

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f wasp-bot
```

### Manual Installation

```bash
# Install dependencies
npm install

# Set up configuration
cp .env.example .env
# Edit .env with your settings

# Start databases
docker-compose up -d postgres redis

# Run database migrations
npm run migration:run

# Start the application
npm run start:dev
```

## 🎯 Quick Example

### Simple Market Making Script

```typescript
import { Injectable } from '@nestjs/common';
import { ScriptStrategyBase } from '../base/script-strategy.abstract';
import { ConnectorService } from '../../connectors/connector.service';
import { MarketDataService } from '../../market-data/market-data.service';

@Injectable()
export class SimplePMMScript extends ScriptStrategyBase {
  constructor(
    private connectorService: ConnectorService,
    private marketDataService: MarketDataService
  ) {
    super();
  }

  async onTick(): Promise<void> {
    const connector = this.getConnector('binance');
    const orderBook = await this.marketDataService.getOrderBook('BTC-USDT');
    
    const midPrice = (orderBook.bestBid + orderBook.bestAsk) / 2;
    const spread = 0.002; // 0.2% spread
    
    // Cancel existing orders
    await this.cancelAllOrders(connector);
    
    // Place new orders
    await connector.placeBuyOrder('BTC-USDT', 0.001, midPrice * (1 - spread));
    await connector.placeSellOrder('BTC-USDT', 0.001, midPrice * (1 + spread));
  }
}
```

### V2 Controller Example

```typescript
import { Injectable } from '@nestjs/common';
import { MarketMakingControllerBase } from '../base/market-making-controller.abstract';
import { ExecutorAction } from '../../executors/executor-action.interface';

@Injectable()
export class PMMSimpleController extends MarketMakingControllerBase {
  async getExecutorActions(): Promise<ExecutorAction[]> {
    const candles = await this.getCandlesForPair(this.config.tradingPair);
    const orderBook = await this.getOrderBookForPair(this.config.tradingPair);
    
    const volatility = this.calculateVolatility(candles);
    const midPrice = (orderBook.bestBid + orderBook.bestAsk) / 2;
    
    // Dynamic spread based on volatility
    const spread = Math.max(this.config.minSpread, volatility * this.config.volatilityMultiplier);
    
    return [
      this.createBuyExecutorAction(midPrice * (1 - spread), this.config.orderAmount),
      this.createSellExecutorAction(midPrice * (1 + spread), this.config.orderAmount)
    ];
  }
}
```

## 📋 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/waspbot
REDIS_URL=redis://localhost:6379

# Exchange API Keys
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret

# Application
NODE_ENV=development
PORT=3000
JWT_SECRET=your_jwt_secret

# Gateway (for DEX support)
GATEWAY_URL=http://localhost:15888
GATEWAY_CERT_PATH=./certs
```

### Strategy Configuration

```yaml
# config/strategies/pmm-simple.yaml
strategy_name: pmm_simple
connector: binance
trading_pair: BTC-USDT
order_amount: 0.001
spread: 0.002
order_refresh_time: 10
max_orders_per_side: 1
```

## 🏗️ Architecture Overview

WaspBot follows a modular architecture inspired by Hummingbot but designed for TypeScript and modern cloud-native deployments:

### Core Components

1. **Clock System**: Manages strategy execution timing
2. **Event System**: Handles market events, order events, and custom events
3. **Connector Layer**: Standardized interfaces for exchanges (CEX/DEX)
4. **Strategy Framework**: V1 and V2 strategy implementations
5. **Market Data**: Real-time and historical market data management

### Strategy V2 Framework

- **Scripts**: Entry point for strategies, handle high-level logic
- **Controllers**: Modular strategy components with specific responsibilities
- **Executors**: Handle order execution, position management, and risk controls

### Microservices

- **Main Application**: Core trading engine and strategy execution
- **Gateway Service**: DEX interaction middleware (TypeScript port of Hummingbot Gateway)
- **Analytics Service**: Performance tracking and reporting
- **Notification Service**: Alerts and trade notifications

## 📚 Documentation

- [Architecture Guide](docs/architecture/README.md)
- [Strategy Development](docs/strategies/README.md)
- [Exchange Connectors](docs/connectors/README.md)
- [API Reference](docs/api/README.md)
- [Deployment Guide](docs/deployment/README.md)

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🚀 Deployment

### Docker Deployment

```bash
# Production build
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f deploy/k8s/
```

### Monitoring

WaspBot includes built-in monitoring and observability:

- **Health Checks**: `/health` endpoint for container health
- **Metrics**: Prometheus-compatible metrics endpoint
- **Logging**: Structured logging with configurable levels
- **Tracing**: Distributed tracing support

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code standards and style guide
- Testing requirements
- Pull request process
- Development setup

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/wasp-bot.git
cd wasp-bot

# Install dependencies
npm install

# Start development environment
npm run dev

# Run tests
npm run test:watch
```

## 📈 Roadmap

### Phase 1: Core Framework ✅
- [x] Basic NestJS architecture
- [x] Clock and timing system
- [x] Event system
- [x] Database layer

### Phase 2: Exchange Connectors 🚧
- [x] Binance connector
- [ ] OKX connector
- [ ] Coinbase connector
- [ ] KuCoin connector

### Phase 3: Strategy Framework 📋
- [ ] V1 strategy ports
- [ ] V2 Scripts implementation
- [ ] V2 Controllers framework
- [ ] Executors system

### Phase 4: Advanced Features 🔮
- [ ] Backtesting engine
- [ ] Dashboard UI
- [ ] Advanced analytics
- [ ] Machine learning integration

## 🆚 Hummingbot vs WaspBot

| Feature | Hummingbot | WaspBot |
|---------|------------|---------|
| Language | Python/Cython | TypeScript |
| Framework | Custom | NestJS |
| Architecture | Monolithic | Microservices |
| Database | SQLite | PostgreSQL |
| API | Basic | Full REST + WebSocket |
| Cloud Native | Limited | Docker + K8s Ready |
| Type Safety | Limited | Full TypeScript |
| Testing | Basic | Comprehensive |

## 📄 License

WaspBot is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

This project is inspired by and builds upon the excellent work of the [Hummingbot Foundation](https://hummingbot.org/). 

## 🙏 Acknowledgments

- [Hummingbot Foundation](https://hummingbot.org/) for the original framework
- [NestJS](https://nestjs.com/) for the excellent TypeScript framework
- The crypto trading community for continuous feedback and contributions

## 📞 Support

- **Documentation**: [docs.waspbot.org](https://docs.waspbot.org)
- **Discord**: [Join our community](https://discord.gg/waspbot)
- **GitHub Issues**: [Report bugs or request features](https://github.com/WaspBot/wasp-bot/issues)
- **Email**: support@waspbot.org

---

**⚠️ Disclaimer**: Cryptocurrency trading involves substantial risk and may result in significant financial losses. WaspBot is provided "as is" without warranty. Always do your own research and trade responsibly.
