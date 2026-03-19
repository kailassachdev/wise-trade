import React from 'react';

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CandlestickChart = ({ data }: { data: Candle[] }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        No historical data available.
      </div>
    );
  }

  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 60, bottom: 30, left: 10 };
  
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const minPrice = Math.min(...data.map(d => d.low)) * 0.995;
  const maxPrice = Math.max(...data.map(d => d.high)) * 1.005;
  const range = maxPrice - minPrice;

  const getY = (price: number) => padding.top + innerHeight - ((price - minPrice) / range) * innerHeight;
  const candleWidth = Math.max(2, (innerWidth / data.length) * 0.8);
  const stepX = innerWidth / data.length;
  const getX = (index: number) => padding.left + (index * stepX) + (stepX / 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: 'var(--card-bg)', borderRadius: '8px' }}>
      {/* Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padding.top + (innerHeight * pct);
        const price = maxPrice - (range * pct);
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeDasharray="4 4" />
            <text x={width - padding.right + 5} y={y + 4} fill="var(--text-secondary)" fontSize="10">{price.toFixed(2)}</text>
          </g>
        );
      })}

      {/* Candles */}
      {data.map((d, i) => {
        const isUp = d.close >= d.open;
        const color = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
        const x = getX(i);
        const yTop = getY(Math.max(d.open, d.close));
        const yBottom = getY(Math.min(d.open, d.close));
        const yHigh = getY(d.high);
        const yLow = getY(d.low);

        return (
          <g key={i}>
            <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth={1} />
            <rect 
              x={x - candleWidth/2} 
              y={yTop} 
              width={candleWidth} 
              height={Math.max(1, yBottom - yTop)} 
              fill={color} 
            />
          </g>
        );
      })}
    </svg>
  );
};
