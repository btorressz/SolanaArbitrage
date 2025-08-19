const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-domain.com'
  : 'http://localhost:5000';

export interface QuoteResponse {
  pair: string;
  timestamp: number;
  quotes: {
    dex: string;
    price: number;
    liquidity: number;
    slippage: number;
    directRoute: string[];
    multiHopRoute: string[];
    fees: number;
  }[];
}

export interface ArbitrageOpportunityResponse {
  opportunities: import('../types/arbitrage').ArbitrageOpportunity[];
  totalCount: number;
  timestamp: number;
}

export interface TradeSimulationResponse {
  success: boolean;
  executionTime: number;
  originalEstimate: number;
  actualProfit: number;
  slippageImpact: number;
  gasUsed: number;
  route: string[];
  timestamp: number;
}

export interface PriceHistoryResponse {
  pair: string;
  history: number[];
  timestamp: number;
}

// WebSocket connection for real-time updates
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

export const subscribeToOpportunities = (callback: (opportunities: import('../types/arbitrage').ArbitrageOpportunity[]) => void): (() => void) => {
  const wsUrl = API_BASE_URL.replace('http', 'ws');
  
  const connect = () => {
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'opportunities') {
            callback(data.data);
          }
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        ws = null;
        
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${reconnectAttempts}`);
            connect();
          }, Math.pow(2, reconnectAttempts) * 1000); // Exponential backoff
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      // Fallback to polling if WebSocket fails
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/arbitrage/opportunities`);
          const data = await response.json();
          callback(data.opportunities);
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 2000);
      
      return () => clearInterval(pollInterval);
    }
  };
  
  connect();
  
  // Return cleanup function
  return () => {
    if (ws) {
      ws.close();
      ws = null;
    }
  };
};

export const getQuotes = async (pair: string = 'SOL/USDC'): Promise<QuoteResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/quotes?pair=${encodeURIComponent(pair)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch quotes:', error);
    throw new Error('Failed to fetch quotes. Please check your connection and try again.');
  }
};

export const getOpportunities = async (filters: {
  pair?: string;
  minPnl?: number;
  maxLatency?: number;
}): Promise<ArbitrageOpportunityResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters.pair && filters.pair !== 'All') params.append('pair', filters.pair);
    if (filters.minPnl !== undefined) params.append('minPnl', filters.minPnl.toString());
    if (filters.maxLatency !== undefined) params.append('maxLatency', filters.maxLatency.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/arbitrage/opportunities?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch opportunities:', error);
    throw new Error('Failed to fetch arbitrage opportunities. Please check your connection and try again.');
  }
};

export const simulateTrade = async (opportunityId: string, amount: number = 1000): Promise<TradeSimulationResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/simulate/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        opportunityId,
        amount
      })
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Opportunity not found or has expired');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to simulate trade:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to simulate trade. Please try again.');
  }
};

export const getPriceHistory = async (pair: string = 'SOL/USDC'): Promise<PriceHistoryResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/price-history?pair=${encodeURIComponent(pair)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch price history:', error);
    throw new Error('Failed to fetch price history. Please check your connection and try again.');
  }
};

// Utility function to check API health
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/arbitrage/opportunities`);
    return response.ok;
  } catch {
    return false;
  }
};

// Error boundary helper
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error('API operation failed:', error);
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw error;
  }
};
