import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Mock DEX data
interface DEXQuote {
  dex: 'Raydium' | 'Orca' | 'Lifinity';
  price: number;
  liquidity: number;
  slippage: number;
  route: string[];
  fees: number;
}

interface ArbitrageOpportunity {
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

// Mock data generators
function generateDEXQuote(dex: 'Raydium' | 'Orca' | 'Lifinity', basePrice: number): DEXQuote {
  const variance = (Math.random() - 0.5) * 0.02; // ±1% variance
  const slippageMultiplier = dex === 'Raydium' ? 0.8 : dex === 'Orca' ? 1.0 : 1.2;
  
  return {
    dex,
    price: basePrice * (1 + variance),
    liquidity: Math.random() * 1000000 + 100000,
    slippage: (Math.random() * 0.005 + 0.001) * slippageMultiplier, // 0.1% - 0.6%
    route: ['SOL', dex === 'Raydium' ? 'RAY' : dex === 'Orca' ? 'ORCA' : 'LFNTY', 'USDC'],
    fees: Math.random() * 0.01 + 0.0025 // 0.25% - 1.25%
  };
}

function generateArbitrageOpportunities(): ArbitrageOpportunity[] {
  const pairs = ['SOL/USDC', 'RAY/USDC', 'ORCA/USDC', 'BONK/USDC', 'JUP/USDC'];
  const dexes = ['Raydium', 'Orca', 'Lifinity'];
  const opportunities: ArbitrageOpportunity[] = [];

  pairs.forEach(pair => {
    const basePrice = Math.random() * 100 + 10;
    const quotes = dexes.map(dex => generateDEXQuote(dex as any, basePrice));
    
    // Find arbitrage opportunities
    for (let i = 0; i < quotes.length; i++) {
      for (let j = 0; j < quotes.length; j++) {
        if (i !== j) {
          const buyQuote = quotes[i];
          const sellQuote = quotes[j];
          const spread = ((sellQuote.price - buyQuote.price) / buyQuote.price) * 100;
          
          if (spread > 0.1) { // Only profitable opportunities
            const gasEstimate = Math.random() * 0.02 + 0.01;
            const estimatedProfit = spread - buyQuote.slippage * 100 - sellQuote.slippage * 100;
            const netProfit = estimatedProfit - gasEstimate;
            
            if (netProfit > 0) {
              opportunities.push({
                id: `${pair.replace('/', '-')}-${buyQuote.dex}-${sellQuote.dex}-${Date.now()}`,
                pair,
                buyDex: buyQuote.dex,
                sellDex: sellQuote.dex,
                buyPrice: buyQuote.price,
                sellPrice: sellQuote.price,
                spread,
                estimatedProfit,
                estimatedGas: gasEstimate,
                netProfit,
                confidence: Math.random() * 40 + 60, // 60-100%
                timestamp: Date.now(),
                route: [`Buy on ${buyQuote.dex}`, `Sell on ${sellQuote.dex}`]
              });
            }
          }
        }
      }
    }
  });

  return opportunities.sort((a, b) => b.netProfit - a.netProfit).slice(0, 10);
}

let currentOpportunities: ArbitrageOpportunity[] = [];
let priceHistory: { [key: string]: number[] } = {};

// Update opportunities every 2 seconds
setInterval(() => {
  currentOpportunities = generateArbitrageOpportunities();
  
  // Update price history
  currentOpportunities.forEach(opp => {
    if (!priceHistory[opp.pair]) {
      priceHistory[opp.pair] = [];
    }
    priceHistory[opp.pair].push(opp.spread);
    if (priceHistory[opp.pair].length > 50) {
      priceHistory[opp.pair] = priceHistory[opp.pair].slice(-50);
    }
  });

  // Broadcast to WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'opportunities',
        data: currentOpportunities
      }));
    }
  });
}, 2000);

// API Routes
app.get('/api/quotes', (req, res) => {
  const { pair = 'SOL/USDC' } = req.query;
  const basePrice = Math.random() * 100 + 10;
  const dexes = ['Raydium', 'Orca', 'Lifinity'];
  
  const quotes = dexes.map(dex => generateDEXQuote(dex as any, basePrice));
  
  res.json({
    pair,
    timestamp: Date.now(),
    quotes: quotes.map(quote => ({
      ...quote,
      directRoute: quote.route,
      multiHopRoute: [...quote.route, 'WSOL', (pair as string).split('/')[1]]
    }))
  });
});

app.get('/api/arbitrage/opportunities', (req, res) => {
  const { minPnl = 0, maxLatency = 1000, pair } = req.query;
  
  let filtered = currentOpportunities.filter(opp => 
    opp.netProfit >= parseFloat(minPnl as string) &&
    (!pair || opp.pair === pair)
  );
  
  res.json({
    opportunities: filtered,
    totalCount: filtered.length,
    timestamp: Date.now()
  });
});

app.post('/api/simulate/trade', (req, res) => {
  const { opportunityId, amount = 1000 } = req.body;
  
  const opportunity = currentOpportunities.find(opp => opp.id === opportunityId);
  if (!opportunity) {
    return res.status(404).json({ error: 'Opportunity not found' });
  }
  
  // Simulate trade execution
  const executionLatency = Math.random() * 500 + 100; // 100-600ms
  const slippageImpact = Math.random() * 0.5 + 0.1; // Additional slippage
  const actualProfit = opportunity.netProfit * (amount / 1000) * (1 - slippageImpact / 100);
  
  setTimeout(() => {
    res.json({
      success: true,
      executionTime: executionLatency,
      originalEstimate: opportunity.netProfit,
      actualProfit,
      slippageImpact,
      gasUsed: opportunity.estimatedGas,
      route: opportunity.route,
      timestamp: Date.now()
    });
  }, executionLatency);
});

app.get('/api/price-history', (req, res) => {
  const { pair = 'SOL/USDC' } = req.query;
  
  res.json({
    pair,
    history: priceHistory[pair as string] || [],
    timestamp: Date.now()
  });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'opportunities',
    data: currentOpportunities
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'subscribe') {
        // Handle subscriptions
        ws.send(JSON.stringify({
          type: 'subscribed',
          pair: data.pair
        }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Serve static files
app.use(express.static('public'));
app.use('/src', express.static('src'));

const PORT = process.env.PORT || 8000;

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Arbitrage simulation server running on port ${PORT}`);
});
