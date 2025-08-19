import { ArbitrageOpportunity, DEXQuote, DexName, TradingPair } from '../types/arbitrage';

// Base prices for different pairs (in USDC)
const basePrices: Record<TradingPair, number> = {
  'SOL/USDC': 85.42,
  'RAY/USDC': 2.15,
  'ORCA/USDC': 3.87,
  'BONK/USDC': 0.000023,
  'JUP/USDC': 1.12
};

// DEX characteristics
const dexCharacteristics: Record<DexName, {
  slippageMultiplier: number;
  feeRange: [number, number];
  liquidityMultiplier: number;
  priceVariance: number;
}> = {
  Raydium: {
    slippageMultiplier: 0.8,
    feeRange: [0.0025, 0.005],
    liquidityMultiplier: 1.2,
    priceVariance: 0.015
  },
  Orca: {
    slippageMultiplier: 1.0,
    feeRange: [0.003, 0.008],
    liquidityMultiplier: 1.0,
    priceVariance: 0.012
  },
  Lifinity: {
    slippageMultiplier: 1.3,
    feeRange: [0.002, 0.006],
    liquidityMultiplier: 0.7,
    priceVariance: 0.020
  }
};

export const generateMockDEXQuote = (
  dex: DexName,
  pair: TradingPair,
  timestamp: number = Date.now()
): DEXQuote => {
  const basePrice = basePrices[pair];
  const characteristics = dexCharacteristics[dex];
  
  // Add some time-based volatility
  const timeVariance = Math.sin(timestamp / 60000) * 0.005; // 60 second cycle
  const randomVariance = (Math.random() - 0.5) * characteristics.priceVariance;
  const totalVariance = timeVariance + randomVariance;
  
  const price = basePrice * (1 + totalVariance);
  
  return {
    dex,
    price,
    liquidity: Math.random() * 500000 * characteristics.liquidityMultiplier + 50000,
    slippage: (Math.random() * 0.004 + 0.001) * characteristics.slippageMultiplier,
    route: [pair.split('/')[0], dex.toUpperCase(), pair.split('/')[1]],
    fees: Math.random() * (characteristics.feeRange[1] - characteristics.feeRange[0]) + characteristics.feeRange[0]
  };
};

export const generateMockArbitrageOpportunity = (
  pair: TradingPair,
  timestamp: number = Date.now()
): ArbitrageOpportunity | null => {
  const dexes: DexName[] = ['Raydium', 'Orca', 'Lifinity'];
  const quotes = dexes.map(dex => generateMockDEXQuote(dex, pair, timestamp));
  
  // Find the best buy (lowest price) and sell (highest price) opportunities
  const sortedByPrice = [...quotes].sort((a, b) => a.price - b.price);
  const buyQuote = sortedByPrice[0];
  const sellQuote = sortedByPrice[sortedByPrice.length - 1];
  
  if (buyQuote.dex === sellQuote.dex) return null;
  
  const spread = ((sellQuote.price - buyQuote.price) / buyQuote.price) * 100;
  const estimatedProfit = spread - (buyQuote.slippage * 100) - (sellQuote.slippage * 100);
  const estimatedGas = Math.random() * 0.02 + 0.01; // 1-3% gas cost
  const netProfit = estimatedProfit - estimatedGas;
  
  // Only return profitable opportunities
  if (netProfit <= 0.05) return null; // Minimum 0.05% profit threshold
  
  // Calculate confidence based on liquidity, spread, and market conditions
  const avgLiquidity = (buyQuote.liquidity + sellQuote.liquidity) / 2;
  const liquidityScore = Math.min(avgLiquidity / 100000, 1) * 40; // 0-40 points
  const spreadScore = Math.min(spread / 2, 1) * 30; // 0-30 points
  const stabilityScore = Math.random() * 30; // 0-30 points for market stability
  
  const confidence = liquidityScore + spreadScore + stabilityScore;
  
  return {
    id: `${pair.replace('/', '-')}-${buyQuote.dex}-${sellQuote.dex}-${timestamp}`,
    pair,
    buyDex: buyQuote.dex,
    sellDex: sellQuote.dex,
    buyPrice: buyQuote.price,
    sellPrice: sellQuote.price,
    spread,
    estimatedProfit,
    estimatedGas,
    netProfit,
    confidence: Math.min(confidence, 100),
    timestamp,
    route: [
      `Buy ${pair.split('/')[0]} on ${buyQuote.dex}`,
      `Sell ${pair.split('/')[0]} on ${sellQuote.dex}`
    ]
  };
};

export const generateMultipleOpportunities = (count: number = 10): ArbitrageOpportunity[] => {
  const pairs: TradingPair[] = ['SOL/USDC', 'RAY/USDC', 'ORCA/USDC', 'BONK/USDC', 'JUP/USDC'];
  const opportunities: ArbitrageOpportunity[] = [];
  const timestamp = Date.now();
  
  for (let i = 0; i < count; i++) {
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    const timeOffset = Math.random() * 300000; // Spread over 5 minutes
    const opportunity = generateMockArbitrageOpportunity(pair, timestamp - timeOffset);
    
    if (opportunity) {
      opportunities.push(opportunity);
    }
  }
  
  return opportunities.sort((a, b) => b.netProfit - a.netProfit);
};

export const simulateMarketMovement = (currentPrice: number, volatility: number = 0.02): number => {
  // Simple random walk with mean reversion
  const random = Math.random() - 0.5;
  const meanReversion = (85 - currentPrice) * 0.001; // Slight pull toward $85 for SOL
  const change = (random * volatility) + meanReversion;
  
  return Math.max(currentPrice * (1 + change), 0.01);
};

export const generatePriceHistory = (pair: TradingPair, points: number = 50): number[] => {
  const basePrice = basePrices[pair];
  const history: number[] = [];
  let currentPrice = basePrice;
  
  for (let i = 0; i < points; i++) {
    currentPrice = simulateMarketMovement(currentPrice);
    history.push(currentPrice);
  }
  
  return history;
};

export const generateMockLatency = (): number => {
  // Simulate network latency with some realistic variance
  return Math.random() * 500 + 100; // 100-600ms
};

export const simulateSlippageImpact = (amount: number, liquidity: number): number => {
  // Higher amounts relative to liquidity cause more slippage
  const liquidityRatio = amount / liquidity;
  const baseSlippage = Math.min(liquidityRatio * 0.1, 0.05); // Max 5% additional slippage
  const randomVariance = Math.random() * 0.001; // Small random component
  
  return baseSlippage + randomVariance;
};

export const mockJupiterAPIResponse = (pair: TradingPair) => {
  const timestamp = Date.now();
  const dexes: DexName[] = ['Raydium', 'Orca', 'Lifinity'];
  
  return {
    data: dexes.map(dex => ({
      dex,
      quote: generateMockDEXQuote(dex, pair, timestamp),
      route: {
        direct: [pair.split('/')[0], pair.split('/')[1]],
        multiHop: [pair.split('/')[0], 'WSOL', pair.split('/')[1]]
      }
    })),
    timestamp,
    success: true
  };
};

// Helper function to add realistic delays
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Generate mock historical arbitrage data for charts
export const generateHistoricalArbitrageData = (days: number = 7): Array<{
  timestamp: number;
  opportunities: number;
  avgProfit: number;
  totalVolume: number;
}> => {
  const data: Array<{
    timestamp: number;
    opportunities: number;
    avgProfit: number;
    totalVolume: number;
  }> = [];
  
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (let i = days; i >= 0; i--) {
    const timestamp = now - (i * dayMs);
    const opportunities = Math.floor(Math.random() * 20) + 5; // 5-25 opportunities
    const avgProfit = Math.random() * 2 + 0.1; // 0.1-2.1% average profit
    const totalVolume = Math.random() * 1000000 + 100000; // $100K-$1.1M volume
    
    data.push({
      timestamp,
      opportunities,
      avgProfit,
      totalVolume
    });
  }
  
  return data;
};
