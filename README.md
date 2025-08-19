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
- **Lucide React** for consistent iconography
- **Custom Solana gradient styling**
