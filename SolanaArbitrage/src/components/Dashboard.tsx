import React, { useState, useEffect } from 'react';
import OpportunityCard from './OpportunityCard';
import PnLChart from './PnLChart';
import RouteVisualization from './RouteVisualization';
import Controls from './Controls';
import SimulationTable from './SimulationTable';
import { ArbitrageOpportunity, SimulationFilters } from '../types/arbitrage';
import { subscribeToOpportunities, getOpportunities } from '../services/api';

const Dashboard: React.FC = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);
  const [filters, setFilters] = useState<SimulationFilters>({
    pair: 'SOL/USDC',
    minPnL: 0.1,
    maxLatency: 1000,
    autoRefresh: true
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (filters.autoRefresh) {
      // Subscribe to real-time updates
      unsubscribe = subscribeToOpportunities((data) => {
        setOpportunities(data);
        setLoading(false);
      });
    } else {
      // Manual fetch
      const fetchOpportunities = async () => {
        try {
          setLoading(true);
          const data = await getOpportunities(filters);
          setOpportunities(data.opportunities);
          setLoading(false);
        } catch (err) {
          setError('Failed to fetch opportunities');
          setLoading(false);
        }
      };
      fetchOpportunities();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [filters]);

  const handleOpportunitySelect = (opportunity: ArbitrageOpportunity) => {
    setSelectedOpportunity(opportunity);
  };

  const filteredOpportunities = opportunities.filter(opp => 
    opp.netProfit >= filters.minPnL &&
    (!filters.pair || filters.pair === 'All' || opp.pair === filters.pair)
  );

  return (
    <div className="dashboard">
      <div className="container">
        <Controls 
          filters={filters}
          onFiltersChange={setFilters}
          opportunityCount={filteredOpportunities.length}
        />
        
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        
        <div className="dashboard-grid">
          <section className="opportunities-section">
            <div className="section-header">
              <h2>Current Opportunities</h2>
              <div className="status-indicator">
                <span className={`status-dot ${loading ? 'loading' : 'active'}`}></span>
                {loading ? 'Loading...' : `${filteredOpportunities.length} active`}
              </div>
            </div>
            
            <div className="opportunities-grid">
              {filteredOpportunities.length === 0 && !loading ? (
                <div className="empty-state">
                  <div className="empty-icon">📈</div>
                  <h3>No Arbitrage Opportunities</h3>
                  <p>Adjust your filters or wait for market conditions to change</p>
                </div>
              ) : (
                filteredOpportunities.map(opportunity => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    isSelected={selectedOpportunity?.id === opportunity.id}
                    onClick={() => handleOpportunitySelect(opportunity)}
                  />
                ))
              )}
            </div>
          </section>

          <section className="charts-section">
            <div className="section-header">
              <h2>Market Analysis</h2>
            </div>
            
            <div className="charts-grid">
              <PnLChart opportunities={filteredOpportunities} />
              {selectedOpportunity && (
                <RouteVisualization opportunity={selectedOpportunity} />
              )}
            </div>
          </section>
        </div>

        <section className="simulation-section">
          <div className="section-header">
            <h2>Trade Simulation</h2>
          </div>
          <SimulationTable 
            opportunities={filteredOpportunities}
            selectedOpportunity={selectedOpportunity}
          />
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
