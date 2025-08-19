export interface ArbitrageOpportunity {
  id: string;
  pair: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  estimatedProfit: number;
  estimatedGas: number;
  netProfit: number;
  confidence: number;
  timestamp: number;
  route: string[];
}

export interface SimulationFilters {
  pair: string;
  minPnL: number;
  maxLatency: number;
  autoRefresh: boolean;
}

export interface DEXQuote {
  dex: 'Raydium' | 'Orca' | 'Lifinity';
  price: number;
  liquidity: number;
  slippage: number;
  route: string[];
  fees: number;
}

export interface TradeSimulation {
  opportunityId: string;
  amount: number;
  estimatedProfit: number;
  actualProfit: number;
  executionTime: number;
  slippageImpact: number;
  gasUsed: number;
  success: boolean;
}

export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
  pair: string;
  dex: string;
}

export interface ArbitrageRoute {
  steps: RouteStep[];
  totalFees: number;
  estimatedTime: number;
  confidence: number;
}

export interface RouteStep {
  dex: string;
  action: 'buy' | 'sell';
  token: string;
  amount: number;
  price: number;
  slippage: number;
}

export interface MarketData {
  pair: string;
  price: number;
  volume24h: number;
  priceChange24h: number;
  liquidity: number;
  lastUpdate: number;
}

export interface DEXInfo {
  name: string;
  tvl: number;
  volume24h: number;
  fees: number;
  slippage: number;
  status: 'active' | 'maintenance' | 'error';
}

export type DexName = 'Raydium' | 'Orca' | 'Lifinity';
export type TradingPair = 'SOL/USDC' | 'RAY/USDC' | 'ORCA/USDC' | 'BONK/USDC' | 'JUP/USDC';
export type TimeRange = '1m' | '5m' | '15m' | '1h' | '1d';

export interface ChartDataPoint {
  time: number;
  value: number;
  pair: string;
  label?: string;
}

export interface SimulationSettings {
  defaultAmount: number;
  slippageTolerance: number;
  gasPrice: number;
  maxLatency: number;
  minProfitThreshold: number;
}

export interface WebSocketMessage {
  type: 'opportunities' | 'prices' | 'error' | 'subscribed';
  data?: any;
  error?: string;
  pair?: string;
}
