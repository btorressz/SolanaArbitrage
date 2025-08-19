import React, { useEffect, useRef, useState } from 'react';
import { ArbitrageOpportunity } from '../types/arbitrage';

interface PnLChartProps {
  opportunities: ArbitrageOpportunity[];
}

const PnLChart: React.FC<PnLChartProps> = ({ opportunities }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('5m');

  useEffect(() => {
    drawChart();
  }, [opportunities, selectedTimeRange]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (opportunities.length === 0) {
      // Draw empty state
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', rect.width / 2, rect.height / 2);
      return;
    }

    // Chart dimensions
    const padding = 40;
    const chartWidth = rect.width - padding * 2;
    const chartHeight = rect.height - padding * 2;

    // Prepare data - group by pair and time
    const dataPoints = opportunities.map(opp => ({
      time: opp.timestamp,
      value: opp.netProfit,
      pair: opp.pair
    })).sort((a, b) => a.time - b.time);

    if (dataPoints.length === 0) return;

    // Find min/max values
    const minValue = Math.min(...dataPoints.map(d => d.value));
    const maxValue = Math.max(...dataPoints.map(d => d.value));
    const valueRange = maxValue - minValue || 1;

    const minTime = Math.min(...dataPoints.map(d => d.time));
    const maxTime = Math.max(...dataPoints.map(d => d.time));
    const timeRange = maxTime - minTime || 1;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight * i) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();

      // Y-axis labels
      const value = maxValue - (valueRange * i) / 5;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${value.toFixed(2)}%`, padding - 5, y + 4);
    }

    // Vertical grid lines
    for (let i = 0; i <= 6; i++) {
      const x = padding + (chartWidth * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + chartHeight);
      ctx.stroke();
    }

    // Draw zero line if it's in range
    if (minValue < 0 && maxValue > 0) {
      const zeroY = padding + chartHeight - ((0 - minValue) / valueRange * chartHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, zeroY);
      ctx.lineTo(padding + chartWidth, zeroY);
      ctx.stroke();
    }

    // Group data by pair for different colored lines
    const pairGroups: { [key: string]: typeof dataPoints } = {};
    dataPoints.forEach(point => {
      if (!pairGroups[point.pair]) {
        pairGroups[point.pair] = [];
      }
      pairGroups[point.pair].push(point);
    });

    const colors = [
      'rgba(147, 51, 234, 0.8)', // Purple
      'rgba(251, 146, 60, 0.8)',  // Orange
      'rgba(20, 184, 166, 0.8)',  // Teal
      'rgba(236, 72, 153, 0.8)',  // Pink
      'rgba(34, 197, 94, 0.8)'    // Green
    ];

    // Draw lines for each pair
    Object.entries(pairGroups).forEach(([pair, points], index) => {
      if (points.length < 2) return;

      ctx.strokeStyle = colors[index % colors.length];
      ctx.lineWidth = 2;
      ctx.beginPath();

      points.forEach((point, i) => {
        const x = padding + ((point.time - minTime) / timeRange * chartWidth);
        const y = padding + chartHeight - ((point.value - minValue) / valueRange * chartHeight);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw points
      ctx.fillStyle = colors[index % colors.length];
      points.forEach(point => {
        const x = padding + ((point.time - minTime) / timeRange * chartWidth);
        const y = padding + chartHeight - ((point.value - minValue) / valueRange * chartHeight);
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Draw legend
    let legendY = 10;
    Object.keys(pairGroups).forEach((pair, index) => {
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(10, legendY, 12, 2);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(pair, 28, legendY + 6);
      
      legendY += 18;
    });
  };

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>PnL Trends</h3>
        <div className="chart-controls">
          {['1m', '5m', '15m', '1h'].map(range => (
            <button
              key={range}
              className={`chart-control ${selectedTimeRange === range ? 'active' : ''}`}
              onClick={() => setSelectedTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      <div className="chart-content">
        <canvas
          ref={canvasRef}
          className="pnl-chart"
          style={{ width: '100%', height: '300px' }}
        />
      </div>
      
      <div className="chart-footer">
        <div className="chart-stats">
          <div className="stat">
            <span className="stat-label">Avg PnL</span>
            <span className="stat-value">
              {opportunities.length > 0 
                ? (opportunities.reduce((sum, o) => sum + o.netProfit, 0) / opportunities.length).toFixed(2)
                : '0.00'
              }%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Best</span>
            <span className="stat-value positive">
              {opportunities.length > 0 
                ? Math.max(...opportunities.map(o => o.netProfit)).toFixed(2)
                : '0.00'
              }%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Active Pairs</span>
            <span className="stat-value">
              {new Set(opportunities.map(o => o.pair)).size}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PnLChart;
