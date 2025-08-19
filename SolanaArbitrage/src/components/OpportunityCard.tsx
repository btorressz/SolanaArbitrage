import React from 'react';
import { ArbitrageOpportunity } from '../types/arbitrage';

interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity;
  isSelected: boolean;
  onClick: () => void;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, isSelected, onClick }) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  };

  return (
    <div 
      className={`opportunity-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="pair-info">
          <h3 className="pair-name">{opportunity.pair}</h3>
          <span className="update-time">{formatTime(opportunity.timestamp)}</span>
        </div>
        <div className={`confidence-badge ${getConfidenceColor(opportunity.confidence)}`}>
          {opportunity.confidence.toFixed(0)}%
        </div>
      </div>

      <div className="card-body">
        <div className="dex-route">
          <div className="dex-item buy">
            <span className="dex-label">Buy</span>
            <span className="dex-name">{opportunity.buyDex}</span>
            <span className="price">${opportunity.buyPrice.toFixed(4)}</span>
          </div>
          
          <div className="arrow">→</div>
          
          <div className="dex-item sell">
            <span className="dex-label">Sell</span>
            <span className="dex-name">{opportunity.sellDex}</span>
            <span className="price">${opportunity.sellPrice.toFixed(4)}</span>
          </div>
        </div>

        <div className="metrics">
          <div className="metric">
            <span className="metric-label">Spread</span>
            <span className="metric-value positive">
              {opportunity.spread.toFixed(2)}%
            </span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Est. Profit</span>
            <span className="metric-value">
              {opportunity.estimatedProfit.toFixed(2)}%
            </span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Net Profit</span>
            <span className={`metric-value ${opportunity.netProfit > 0 ? 'positive' : 'negative'}`}>
              {opportunity.netProfit.toFixed(2)}%
            </span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Gas Est.</span>
            <span className="metric-value">
              {opportunity.estimatedGas.toFixed(3)}%
            </span>
          </div>
        </div>
      </div>

      <div className="card-footer">
        <div className="route-preview">
          {opportunity.route.map((step, index) => (
            <React.Fragment key={index}>
              <span className="route-step">{step}</span>
              {index < opportunity.route.length - 1 && <span className="route-separator">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OpportunityCard;
