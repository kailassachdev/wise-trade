import React, { useRef, useEffect, useCallback } from 'react';

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  data: Candle[];
}

const W = 800;
const H = 300;
const PAD = { top: 20, right: 64, bottom: 30, left: 10 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

function lerp(min: number, max: number, v: number) {
  return max === min ? 0.5 : (v - min) / (max - min);
}

export const CandlestickChart: React.FC<Props> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const prevDataRef = useRef<Candle[]>([]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const ns = 'http://www.w3.org/2000/svg';

  const renderChart = useCallback((candles: Candle[]) => {
    const svg = svgRef.current;
    if (!svg || candles.length === 0) return;

    const minPrice = Math.min(...candles.map(d => d.low)) * 0.995;
    const maxPrice = Math.max(...candles.map(d => d.high)) * 1.005;
    const range = maxPrice - minPrice || 1;

    const getY = (p: number) => PAD.top + IH - lerp(minPrice, maxPrice, p) * IH;
    const stepX = IW / candles.length;
    const getX  = (i: number) => PAD.left + i * stepX + stepX / 2;
    const cw    = Math.max(2, stepX * 0.7);

    // ── Wipe and rebuild grid & labels only when needed ─────────────────────
    // We use stable element IDs so React never remounts the SVG itself.

    // Grid
    let gridG = svg.getElementById('chart-grid') as SVGGElement | null;
    if (!gridG) {
      gridG = document.createElementNS(ns, 'g') as SVGGElement;
      gridG.id = 'chart-grid';
      svg.insertBefore(gridG, svg.firstChild);
    }
    gridG.innerHTML = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
      const y     = PAD.top + IH * pct;
      const price = maxPrice - range * pct;

      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', String(PAD.left));
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(W - PAD.right));
      line.setAttribute('y2', String(y));
      line.setAttribute('stroke', 'var(--border)');
      line.setAttribute('stroke-dasharray', '4 4');
      gridG!.appendChild(line);

      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', String(W - PAD.right + 5));
      txt.setAttribute('y', String(y + 4));
      txt.setAttribute('fill', 'var(--text-secondary)');
      txt.setAttribute('font-size', '10');
      txt.textContent = price.toFixed(2);
      gridG!.appendChild(txt);
    });

    // X-axis labels
    let xAxisG = svg.getElementById('chart-xaxis') as SVGGElement | null;
    if (!xAxisG) {
      xAxisG = document.createElementNS(ns, 'g') as SVGGElement;
      xAxisG.id = 'chart-xaxis';
      svg.appendChild(xAxisG);
    }
    xAxisG.innerHTML = '';
    [0, 0.2, 0.4, 0.6, 0.8, 0.99].forEach(pct => {
      const idx = Math.min(Math.floor(candles.length * pct), candles.length - 1);
      const x   = getX(idx);
      const d   = new Date(candles[idx].timestamp);
      const lbl = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', String(x));
      txt.setAttribute('y', String(H - 10));
      txt.setAttribute('fill', 'var(--text-secondary)');
      txt.setAttribute('font-size', '10');
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = lbl;
      xAxisG!.appendChild(txt);
    });

    // ── Candles — reuse existing <g> elements, only update attributes ────────
    let candlesG = svg.getElementById('chart-candles') as SVGGElement | null;
    if (!candlesG) {
      candlesG = document.createElementNS(ns, 'g') as SVGGElement;
      candlesG.id = 'chart-candles';
      svg.insertBefore(candlesG, xAxisG);
    }

    // Add missing candle groups
    while (candlesG.childElementCount < candles.length) {
      const g = document.createElementNS(ns, 'g') as SVGGElement;

      const wick = document.createElementNS(ns, 'line');
      wick.classList.add('c-wick');
      wick.setAttribute('stroke-width', '1');
      g.appendChild(wick);

      const body = document.createElementNS(ns, 'rect');
      body.classList.add('c-body');
      body.style.transition = 'y 0.25s ease, height 0.25s ease, fill 0.15s';
      g.appendChild(body);

      candlesG.appendChild(g);
    }

    // Remove extra groups
    while (candlesG.childElementCount > candles.length) {
      candlesG.removeChild(candlesG.lastChild!);
    }

    // Update each candle's attributes in-place (no DOM removal = no blink)
    candles.forEach((d, i) => {
      const isUp  = d.close >= d.open;
      const color = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
      const x     = getX(i);
      const yHigh = getY(d.high);
      const yLow  = getY(d.low);
      const yTop  = getY(Math.max(d.open, d.close));
      const yBot  = getY(Math.min(d.open, d.close));
      const bodyH = Math.max(1, yBot - yTop);

      const g    = candlesG!.children[i] as SVGGElement;
      const wick = g.children[0] as SVGLineElement;
      const body = g.children[1] as SVGRectElement;

      wick.setAttribute('x1', String(x));
      wick.setAttribute('y1', String(yHigh));
      wick.setAttribute('x2', String(x));
      wick.setAttribute('y2', String(yLow));
      wick.setAttribute('stroke', color);

      body.setAttribute('x', String(x - cw / 2));
      body.setAttribute('y', String(yTop));
      body.setAttribute('width', String(cw));
      body.setAttribute('height', String(bodyH));
      body.setAttribute('fill', color);
    });

  }, []);

  // Re-render whenever data changes — NO remount, purely imperative updates
  useEffect(() => {
    if (data && data.length > 0) {
      prevDataRef.current = data;
      renderChart(data);
    }
  }, [data, renderChart]);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        No historical data available.
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: '100%',
        height: 'auto',
        background: 'var(--card-bg)',
        borderRadius: '8px',
        display: 'block',
        // Never re-trigger a paint flash — the SVG el itself is stable
      }}
    />
  );
};
