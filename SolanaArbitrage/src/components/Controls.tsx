import React from 'react';
import { SimulationFilters } from '../types/arbitrage';

interface ControlsProps {
  filters: SimulationFilters;
  onFiltersChange: (filters: SimulationFilters) => void;
  opportunityCount: number;
}

const Controls: React.FC<ControlsProps> = ({ filters, onFiltersChange, opportunityCount }) => {
  const pairs = ['All', 'SOL/USDC', 'RAY/USDC', 'ORCA/USDC', 'BONK/USDC', 'JUP/USDC'];

  const handleFilterChange = (key: keyof SimulationFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="controls-panel">
      <div className="controls-section">
        <h3>Filters & Settings</h3>
        
        <div className="controls-grid">
          <div className="control-group">
            <label className="control-label">Trading Pair</label>
            <select
              className="control-select"
              value={filters.pair}
              onChange={(e) => handleFilterChange('pair', e.target.value)}
            >
              {pairs.map(pair => (
                <option key={pair} value={pair}>{pair}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">
              Min PnL: {filters.minPnL.toFixed(2)}%
            </label>
            <input
              type="range"
              className="control-slider"
              min="0"
              max="5"
              step="0.1"
              value={filters.minPnL}
              onChange={(e) => handleFilterChange('minPnL', parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              Max Latency: {filters.maxLatency}ms
            </label>
            <input
              type="range"
              className="control-slider"
              min="100"
              max="2000"
              step="100"
              value={filters.maxLatency}
              onChange={(e) => handleFilterChange('maxLatency', parseInt(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label className="control-checkbox">
              <input
                type="checkbox"
                checked={filters.autoRefresh}
                onChange={(e) => handleFilterChange('autoRefresh', e.target.checked)}
              />
              <span className="checkbox-indicator"></span>
              Auto Refresh
            </label>
          </div>
        </div>
      </div>

      <div className="controls-stats">
        <div className="stat-card">
          <div className="stat-value">{opportunityCount}</div>
          <div className="stat-label">Active Opportunities</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">3</div>
          <div className="stat-label">DEX Pairs</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">
            {filters.autoRefresh ? '2s' : 'Manual'}
          </div>
          <div className="stat-label">Refresh Rate</div>
        </div>
      </div>

      <div className="controls-actions">
        <button 
          className="action-button primary"
          onClick={() => window.location.reload()}
        >
          🔄 Refresh Data
        </button>
        
        <button 
          className="action-button secondary"
          onClick={() => onFiltersChange({
            pair: 'SOL/USDC',
            minPnL: 0.1,
            maxLatency: 1000,
            autoRefresh: true
          })}
        >
          ↺ Reset Filters
        </button>
      </div>
    </div>
  );
};

export default Controls;
