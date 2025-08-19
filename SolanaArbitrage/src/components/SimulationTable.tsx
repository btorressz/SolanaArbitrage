import React, { useState } from 'react';
import { ArbitrageOpportunity } from '../types/arbitrage';
import { simulateTrade } from '../services/api';

interface SimulationTableProps {
  opportunities: ArbitrageOpportunity[];
  selectedOpportunity: ArbitrageOpportunity | null;
}

interface SimulationResult {
  success: boolean;
  executionTime: number;
  originalEstimate: number;
  actualProfit: number;
  slippageImpact: number;
  gasUsed: number;
  route: string[];
  timestamp: number;
}

const SimulationTable: React.FC<SimulationTableProps> = ({ opportunities, selectedOpportunity }) => {
  const [simulationResults, setSimulationResults] = useState<{ [key: string]: SimulationResult }>({});
  const [simulatingIds, setSimulatingIds] = useState<Set<string>>(new Set());
  const [tradeAmount, setTradeAmount] = useState(1000);

  const handleSimulate = async (opportunity: ArbitrageOpportunity) => {
    setSimulatingIds(prev => new Set(prev).add(opportunity.id));
    
    try {
      const result = await simulateTrade(opportunity.id, tradeAmount);
      setSimulationResults(prev => ({
        ...prev,
        [opportunity.id]: result
      }));
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setSimulatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(opportunity.id);
        return newSet;
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  };

  const formatPercentage = (value: number, decimals = 2) => {
    return `${value.toFixed(decimals)}%`;
  };

  const topOpportunities = opportunities
    .filter(opp => opp.netProfit > 0)
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 10);

  return (
    <div className="simulation-table">
      <div className="table-header">
        <div className="table-title">
          <h3>Trade Simulation Results</h3>
          <div className="table-controls">
            <label className="amount-control">
              Trade Amount:
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(Number(e.target.value))}
                min="100"
                max="100000"
                step="100"
                className="amount-input"
              />
              USDC
            </label>
          </div>
        </div>
      </div>

      <div className="table-container">
        {topOpportunities.length === 0 ? (
          <div className="empty-table">
            <div className="empty-icon">🎯</div>
            <h4>No Profitable Opportunities</h4>
            <p>Adjust your filters to find arbitrage opportunities</p>
          </div>
        ) : (
          <table className="results-table">
            <thead>
              <tr>
                <th>Pair</th>
                <th>Route</th>
                <th>Spread</th>
                <th>Est. Profit</th>
                <th>Est. Value</th>
                <th>Confidence</th>
                <th>Simulation</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {topOpportunities.map(opportunity => {
                const isSimulating = simulatingIds.has(opportunity.id);
                const result = simulationResults[opportunity.id];
                const estimatedValue = (opportunity.netProfit / 100) * tradeAmount;
                
                return (
                  <tr 
                    key={opportunity.id}
                    className={selectedOpportunity?.id === opportunity.id ? 'selected' : ''}
                  >
                    <td>
                      <div className="pair-cell">
                        <span className="pair-name">{opportunity.pair}</span>
                        <span className="pair-time">
                          {new Date(opportunity.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    
                    <td>
                      <div className="route-cell">
                        <span className="buy-dex">{opportunity.buyDex}</span>
                        <span className="route-arrow">→</span>
                        <span className="sell-dex">{opportunity.sellDex}</span>
                      </div>
                    </td>
                    
                    <td>
                      <span className="spread-value positive">
                        {formatPercentage(opportunity.spread)}
                      </span>
                    </td>
                    
                    <td>
                      <span className={`profit-value ${opportunity.netProfit > 0 ? 'positive' : 'negative'}`}>
                        {formatPercentage(opportunity.netProfit)}
                      </span>
                    </td>
                    
                    <td>
                      <span className={`value-estimate ${estimatedValue > 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(estimatedValue)}
                      </span>
                    </td>
                    
                    <td>
                      <div className={`confidence-indicator ${
                        opportunity.confidence >= 80 ? 'high' : 
                        opportunity.confidence >= 60 ? 'medium' : 'low'
                      }`}>
                        {opportunity.confidence.toFixed(0)}%
                      </div>
                    </td>
                    
                    <td>
                      {result ? (
                        <div className="simulation-result">
                          <div className="result-row">
                            <span className="result-label">Actual:</span>
                            <span className={`result-value ${result.actualProfit > 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(result.actualProfit)}
                            </span>
                          </div>
                          <div className="result-row">
                            <span className="result-label">Slippage:</span>
                            <span className="result-value">
                              {formatPercentage(result.slippageImpact)}
                            </span>
                          </div>
                          <div className="result-row">
                            <span className="result-label">Time:</span>
                            <span className="result-value">
                              {result.executionTime.toFixed(0)}ms
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="no-simulation">Not simulated</span>
                      )}
                    </td>
                    
                    <td>
                      <button
                        className={`simulate-button ${isSimulating ? 'loading' : ''}`}
                        onClick={() => handleSimulate(opportunity)}
                        disabled={isSimulating}
                      >
                        {isSimulating ? (
                          <>
                            <span className="loading-spinner"></span>
                            Simulating...
                          </>
                        ) : result ? (
                          'Re-simulate'
                        ) : (
                          'Simulate'
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {selectedOpportunity && (
        <div className="selected-opportunity-details">
          <h4>Selected Opportunity Details</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Full Route:</span>
              <span className="detail-value">
                {selectedOpportunity.route.join(' → ')}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Buy Price:</span>
              <span className="detail-value">
                {formatCurrency(selectedOpportunity.buyPrice)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Sell Price:</span>
              <span className="detail-value">
                {formatCurrency(selectedOpportunity.sellPrice)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Gas Estimate:</span>
              <span className="detail-value">
                {formatPercentage(selectedOpportunity.estimatedGas)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationTable;
