import React, { useRef, useEffect } from 'react';
import { ArbitrageOpportunity } from '../types/arbitrage';

interface RouteVisualizationProps {
  opportunity: ArbitrageOpportunity;
}

const RouteVisualization: React.FC<RouteVisualizationProps> = ({ opportunity }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    drawRoute();
  }, [opportunity]);

  const drawRoute = () => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clear existing content
    svg.innerHTML = '';

    const width = 400;
    const height = 200;
    
    // Create SVG elements
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Define gradients
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'arrowGradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#9333ea');
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '50%');
    stop2.setAttribute('stop-color', '#fb923c');
    
    const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop3.setAttribute('offset', '100%');
    stop3.setAttribute('stop-color', '#14b8a6');
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    gradient.appendChild(stop3);
    defs.appendChild(gradient);

    // Arrow marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', 'url(#arrowGradient)');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    
    svg.appendChild(defs);

    // DEX positions
    const buyX = 80;
    const sellX = 320;
    const centerY = height / 2;

    // Draw DEX nodes
    const buyCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    buyCircle.setAttribute('cx', buyX.toString());
    buyCircle.setAttribute('cy', centerY.toString());
    buyCircle.setAttribute('r', '30');
    buyCircle.setAttribute('fill', 'rgba(147, 51, 234, 0.2)');
    buyCircle.setAttribute('stroke', '#9333ea');
    buyCircle.setAttribute('stroke-width', '2');
    svg.appendChild(buyCircle);

    const sellCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sellCircle.setAttribute('cx', sellX.toString());
    sellCircle.setAttribute('cy', centerY.toString());
    sellCircle.setAttribute('r', '30');
    sellCircle.setAttribute('fill', 'rgba(20, 184, 166, 0.2)');
    sellCircle.setAttribute('stroke', '#14b8a6');
    sellCircle.setAttribute('stroke-width', '2');
    svg.appendChild(sellCircle);

    // DEX labels
    const buyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    buyText.setAttribute('x', buyX.toString());
    buyText.setAttribute('y', (centerY + 4).toString());
    buyText.setAttribute('text-anchor', 'middle');
    buyText.setAttribute('fill', '#ffffff');
    buyText.setAttribute('font-size', '12');
    buyText.setAttribute('font-weight', 'bold');
    buyText.textContent = opportunity.buyDex;
    svg.appendChild(buyText);

    const sellText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sellText.setAttribute('x', sellX.toString());
    sellText.setAttribute('y', (centerY + 4).toString());
    sellText.setAttribute('text-anchor', 'middle');
    sellText.setAttribute('fill', '#ffffff');
    sellText.setAttribute('font-size', '12');
    sellText.setAttribute('font-weight', 'bold');
    sellText.textContent = opportunity.sellDex;
    svg.appendChild(sellText);

    // Flow arrow
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const curve = `M ${buyX + 30} ${centerY} Q ${(buyX + sellX) / 2} ${centerY - 40} ${sellX - 30} ${centerY}`;
    arrowPath.setAttribute('d', curve);
    arrowPath.setAttribute('stroke', 'url(#arrowGradient)');
    arrowPath.setAttribute('stroke-width', '3');
    arrowPath.setAttribute('fill', 'none');
    arrowPath.setAttribute('marker-end', 'url(#arrowhead)');
    svg.appendChild(arrowPath);

    // Price labels
    const buyPriceText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    buyPriceText.setAttribute('x', buyX.toString());
    buyPriceText.setAttribute('y', (centerY + 50).toString());
    buyPriceText.setAttribute('text-anchor', 'middle');
    buyPriceText.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');
    buyPriceText.setAttribute('font-size', '10');
    buyPriceText.textContent = `$${opportunity.buyPrice.toFixed(4)}`;
    svg.appendChild(buyPriceText);

    const sellPriceText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sellPriceText.setAttribute('x', sellX.toString());
    sellPriceText.setAttribute('y', (centerY + 50).toString());
    sellPriceText.setAttribute('text-anchor', 'middle');
    sellPriceText.setAttribute('fill', 'rgba(255, 255, 255, 0.7)');
    sellPriceText.setAttribute('font-size', '10');
    sellPriceText.textContent = `$${opportunity.sellPrice.toFixed(4)}`;
    svg.appendChild(sellPriceText);

    // Profit indicator
    const profitText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    profitText.setAttribute('x', ((buyX + sellX) / 2).toString());
    profitText.setAttribute('y', (centerY - 55).toString());
    profitText.setAttribute('text-anchor', 'middle');
    profitText.setAttribute('fill', opportunity.netProfit > 0 ? '#10b981' : '#ef4444');
    profitText.setAttribute('font-size', '14');
    profitText.setAttribute('font-weight', 'bold');
    profitText.textContent = `+${opportunity.netProfit.toFixed(2)}%`;
    svg.appendChild(profitText);

    // Animated flow particles
    const createParticle = (delay: number) => {
      const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      particle.setAttribute('r', '3');
      particle.setAttribute('fill', '#fb923c');
      particle.setAttribute('opacity', '0.8');

      const animateMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
      animateMotion.setAttribute('dur', '2s');
      animateMotion.setAttribute('begin', `${delay}s`);
      animateMotion.setAttribute('repeatCount', 'indefinite');
      animateMotion.setAttribute('path', curve);
      particle.appendChild(animateMotion);

      const animateOpacity = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      animateOpacity.setAttribute('attributeName', 'opacity');
      animateOpacity.setAttribute('values', '0;0.8;0');
      animateOpacity.setAttribute('dur', '2s');
      animateOpacity.setAttribute('begin', `${delay}s`);
      animateOpacity.setAttribute('repeatCount', 'indefinite');
      particle.appendChild(animateOpacity);

      svg.appendChild(particle);
    };

    // Create multiple particles with different delays
    for (let i = 0; i < 3; i++) {
      createParticle(i * 0.7);
    }
  };

  return (
    <div className="route-visualization">
      <div className="route-header">
        <h3>Arbitrage Route</h3>
        <div className="pair-badge">{opportunity.pair}</div>
      </div>
      
      <div className="route-content">
        <svg
          ref={svgRef}
          width="100%"
          height="200"
          viewBox="0 0 400 200"
          className="route-svg"
        />
      </div>
      
      <div className="route-details">
        <div className="detail-row">
          <span className="detail-label">Spread:</span>
          <span className="detail-value positive">{opportunity.spread.toFixed(2)}%</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Est. Gas:</span>
          <span className="detail-value">{opportunity.estimatedGas.toFixed(3)}%</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Confidence:</span>
          <span className="detail-value">{opportunity.confidence.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

export default RouteVisualization;
