# 🚀 SolanaArbitrage

A real-time arbitrage opportunity detection and visualization platform for Solana DEXs, featuring live market data integration with Jupiter and CoinGecko APIs.

## ✨ Features

- **Real-Time Arbitrage Detection** - Automatically finds profitable opportunities across Raydium, Orca, and Lifinity DEXs
- **Interactive Modal Analysis** - Click any opportunity card for detailed analysis with charts and simulations
- **Trading Route Visualization** - Clear "Buy on [DEX] → Sell on [DEX]" flow diagrams
- **Live Trading Simulator** - Interactive profit calculator with adjustable investment amounts
- **Price History Charts** - Visual price movement data for each trading pair
- **Dual Data Sources** - Jupiter API as primary source with CoinGecko backup for maximum reliability
- **Intelligent Rate Limiting** - Smart retry logic with exponential backoff to handle API limits gracefully
- **Live Dashboard** - Beautiful Solana-themed interface with gradient styling (purple → orange → teal)
- **Continuous Updates** - Real-time opportunity streaming every 3 seconds (app never pauses)
- **Profit Analysis** - Detailed calculations including slippage, gas costs, and confidence metrics
- **Data Source Transparency** - Clear indicators showing which API provided each opportunity


## 🎯 Supported Trading Pairs

- SOL/USDC
- RAY/USDC
- ORCA/USDC
- BONK/USDC
- JUP/USDC

## 🏗️ Architecture

### Backend (Flask + Python)
- **Flask REST API** serving arbitrage opportunities
- **Jupiter API Integration** for real-time DEX quotes
- **CoinGecko Backup** for price data redundancy
- **Intelligent Rate Limiting** (10 calls/min Jupiter, 15 calls/min CoinGecko)
- **WebSocket Server** for real-time updates
- **Solana Agent Kit v2.0.9** for on-chain interactions



### Frontend (React + TypeScript)
- **React 19** with modern hooks and TypeScript
- **Vite** for fast development and optimized builds
- **Recharts** for data visualization

  ## 📊 API Endpoints

### REST API

- `GET /api/arbitrage/opportunities` - Get current arbitrage opportunities
- `GET /api/price-history/<pair>` - Get price history for specific trading pair
- `GET /api/quotes` - Get cached DEX quotes
- `POST /api/simulate/trade` - Simulate trade execution with custom parameters
- `GET /health` - Health check with data source status

### Rate Limiting Configuration

The platform includes intelligent rate limiting to prevent API abuse:

- **Jupiter API**: 10 calls per minute
- **CoinGecko API**: 15 calls per minute
- **Retry Logic**: Exponential backoff (1s, 2s, 4s delays)
- **Update Interval**: 10 seconds between quote refreshes

## 🎨 UI Features

### Main Dashboard
- **Clickable Opportunity Cards** with hover effects showing:
  - Trading pair (e.g., SOL/USDC)
  - Buy/Sell DEX information
  - Price spread percentage
  - Net profit after fees
  - Confidence score
  - Data source indicator
- **Auto-refreshing** every 3 seconds (continues even when viewing modals)
- **Responsive design** for mobile and desktop
- **Error handling** with user-friendly messages

### Interactive Modal Analysis
- **Detailed Opportunity Analysis** opened by clicking any card:
  - Comprehensive profit/loss breakdown
  - Trading route visualization with DEX flow
  - Interactive trading simulator with adjustable amounts
  - Real-time gross profit, fees, and net profit calculations
  - Price history charts with 20 data points
  - Close button and click-outside-to-close functionality
- **Non-blocking Interface** - opportunities continue updating while modal is open
- **Price History Integration** - Live data from both Jupiter and CoinGecko APIs


- **Lucide React** for consistent iconography
- **Custom Solana gradient styling**
