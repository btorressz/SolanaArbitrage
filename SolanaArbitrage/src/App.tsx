import React from 'react';
import Dashboard from './components/Dashboard';
import './styles/globals.css';

const App: React.FC = () => {
  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <h1 className="app-title">
            <span className="gradient-text">Solana Arbitrage</span>
            <span className="subtitle">Simulation Platform</span>
          </h1>
        </div>
      </header>
      <main className="app-main">
        <Dashboard />
      </main>
    </div>
  );
};

export default App;
