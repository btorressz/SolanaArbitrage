import { SolanaAgentKit } from "solana-agent-kit";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import WebSocket from 'ws';

interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
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

class SolanaArbitrageAgent {
  private agent: SolanaAgentKit;
  private connection: Connection;
  private wsServer: WebSocket.Server | null = null;
  private quotes: Map<string, JupiterQuote> = new Map();
  private opportunities: ArbitrageOpportunity[] = [];
  
  // Trading pairs with their mint addresses
  private readonly TRADING_PAIRS = {
    'SOL/USDC': {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: { input: 9, output: 6 }
    },
    'RAY/USDC': {
      inputMint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: { input: 6, output: 6 }
    },
    'ORCA/USDC': {
      inputMint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: { input: 6, output: 6 }
    }
  };

  private readonly DEX_IDENTIFIERS = {
    'Raydium': ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'],
    'Orca': ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'],
    'Lifinity': ['EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S']
  };

  constructor(rpcUrl?: string, privateKey?: string) {
    this.connection = new Connection(rpcUrl || 'https://api.mainnet-beta.solana.com');
    
    try {
      if (privateKey) {
        // Convert private key string to Keypair
        const keypairBytes = Buffer.from(privateKey, 'base64');
        const keypair = Keypair.fromSecretKey(keypairBytes);
        this.agent = new SolanaAgentKit(keypair, rpcUrl || 'https://api.mainnet-beta.solana.com', {});
      } else {
        // Create agent with minimal wallet for read-only operations
        const dummyKeypair = Keypair.generate();
        this.agent = new SolanaAgentKit(dummyKeypair, rpcUrl || 'https://api.mainnet-beta.solana.com', {});
      }
    } catch (error) {
      console.warn('Could not initialize SolanaAgentKit, using minimal setup:', error);
      // Fallback - just initialize connection for basic operations
      this.agent = null as any;
    }
  }

  async startQuoteSubscription(port: number = 8001): Promise<void> {
    console.log('Starting Solana Arbitrage Agent...');
    
    // Start WebSocket server for communication with Flask backend
    this.wsServer = new WebSocket.Server({ port });
    
    this.wsServer.on('connection', (ws) => {
      console.log('Flask backend connected to agent');
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMessage(data, ws);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('Flask backend disconnected from agent');
      });
    });

    // Start quote monitoring
    this.startQuoteMonitoring();
    
    console.log(`Solana Agent listening on port ${port}`);
  }

  private async handleMessage(data: any, ws: WebSocket): Promise<void> {
    switch (data.type) {
      case 'get_quote':
        const quote = await this.getJupiterQuote(data.inputMint, data.outputMint, data.amount);
        ws.send(JSON.stringify({
          type: 'quote_response',
          data: quote,
          requestId: data.requestId
        }));
        break;
      
      case 'get_opportunities':
        ws.send(JSON.stringify({
          type: 'opportunities_response',
          data: this.opportunities,
          requestId: data.requestId
        }));
        break;
    }
  }

  private async getJupiterQuote(
    inputMint: string, 
    outputMint: string, 
    amount: number = 1000000
  ): Promise<JupiterQuote | null> {
    try {
      const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`);
      
      if (response.ok) {
        const quote = await response.json() as JupiterQuote;
        this.quotes.set(`${inputMint}-${outputMint}`, quote);
        return quote;
      }
    } catch (error) {
      console.error('Error fetching Jupiter quote:', error);
    }
    
    return null;
  }

  private identifyDexFromRoute(routePlan: JupiterQuote['routePlan']): string {
    if (!routePlan || routePlan.length === 0) return 'Unknown';
    
    for (const step of routePlan) {
      const ammKey = step.swapInfo.ammKey;
      
      // Check against known program IDs/AMM keys
      for (const [dexName, identifiers] of Object.entries(this.DEX_IDENTIFIERS)) {
        if (identifiers.some(id => ammKey.includes(id))) {
          return dexName;
        }
      }
    }
    
    // Fallback heuristics
    if (routePlan[0]?.swapInfo?.label?.toLowerCase().includes('raydium')) return 'Raydium';
    if (routePlan[0]?.swapInfo?.label?.toLowerCase().includes('orca')) return 'Orca';
    if (routePlan[0]?.swapInfo?.label?.toLowerCase().includes('lifinity')) return 'Lifinity';
    
    return routePlan.length === 1 ? 'Raydium' : 'Orca';
  }

  private async analyzeArbitrageOpportunities(): Promise<void> {
    const newOpportunities: ArbitrageOpportunity[] = [];
    
    for (const [pairName, pairConfig] of Object.entries(this.TRADING_PAIRS)) {
      try {
        // Get quotes for this pair from different perspectives
        const directQuote = await this.getJupiterQuote(
          pairConfig.inputMint, 
          pairConfig.outputMint
        );
        
        const reverseQuote = await this.getJupiterQuote(
          pairConfig.outputMint, 
          pairConfig.inputMint
        );
        
        if (directQuote && reverseQuote) {
          // Analyze for arbitrage opportunities
          const opportunities = this.findArbitrageInQuotes(pairName, directQuote, reverseQuote);
          newOpportunities.push(...opportunities);
        }
      } catch (error) {
        console.error(`Error analyzing ${pairName}:`, error);
      }
    }
    
    // Sort by profitability and keep top 20
    this.opportunities = newOpportunities
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, 20);
  }

  private findArbitrageInQuotes(
    pair: string, 
    directQuote: JupiterQuote, 
    reverseQuote: JupiterQuote
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    
    // Extract route information
    const directDex = this.identifyDexFromRoute(directQuote.routePlan);
    const reverseDex = this.identifyDexFromRoute(reverseQuote.routePlan);
    
    // Calculate prices
    const directPrice = parseFloat(directQuote.outAmount) / parseFloat(directQuote.inAmount);
    const reversePrice = parseFloat(reverseQuote.inAmount) / parseFloat(reverseQuote.outAmount);
    
    // Check for arbitrage opportunity
    if (directDex !== reverseDex) {
      const spread = ((reversePrice - directPrice) / directPrice) * 100;
      
      if (spread > 0.1) { // Minimum 0.1% spread
        const priceImpact = parseFloat(directQuote.priceImpactPct) + parseFloat(reverseQuote.priceImpactPct);
        const estimatedProfit = spread - priceImpact;
        const estimatedGas = 0.015; // ~1.5% for cross-DEX arbitrage
        const netProfit = estimatedProfit - estimatedGas;
        
        if (netProfit > 0.05) { // Minimum 0.05% net profit
          const opportunity: ArbitrageOpportunity = {
            id: `${pair.replace('/', '-')}-${directDex}-${reverseDex}-${Date.now()}`,
            pair,
            buyDex: directDex,
            sellDex: reverseDex,
            buyPrice: directPrice,
            sellPrice: reversePrice,
            spread,
            estimatedProfit,
            estimatedGas,
            netProfit,
            confidence: Math.min(95, 60 + (netProfit * 10)), // Higher profit = higher confidence
            timestamp: Date.now(),
            route: [
              `Buy ${pair.split('/')[0]} on ${directDex}`,
              `Sell ${pair.split('/')[0]} on ${reverseDex}`
            ]
          };
          
          opportunities.push(opportunity);
        }
      }
    }
    
    return opportunities;
  }

  private startQuoteMonitoring(): void {
    // Monitor quotes every 3 seconds
    setInterval(async () => {
      try {
        await this.analyzeArbitrageOpportunities();
        
        // Broadcast to connected Flask backends
        if (this.wsServer) {
          this.wsServer.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'opportunities_update',
                data: this.opportunities
              }));
            }
          });
        }
        
        console.log(`Found ${this.opportunities.length} arbitrage opportunities`);
      } catch (error) {
        console.error('Error in quote monitoring:', error);
      }
    }, 3000);
  }

  async getBalance(tokenAddress: string): Promise<number> {
    try {
      // Use the agent's connection to get balance
      const publicKey = new PublicKey(tokenAddress);
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }

  async simulateSwap(
    inputMint: string, 
    outputMint: string, 
    amount: number
  ): Promise<{ success: boolean; estimatedOutput?: number; error?: string }> {
    try {
      const quote = await this.getJupiterQuote(inputMint, outputMint, amount);
      
      if (quote) {
        return {
          success: true,
          estimatedOutput: parseFloat(quote.outAmount)
        };
      } else {
        return {
          success: false,
          error: 'Failed to get quote'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Start the agent if run directly
if (require.main === module) {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const privateKey = process.env.SOLANA_PRIVATE_KEY; // Optional for read-only operations
  
  const agent = new SolanaArbitrageAgent(rpcUrl, privateKey);
  
  agent.startQuoteSubscription(8001).catch(console.error);
}

export { SolanaArbitrageAgent };