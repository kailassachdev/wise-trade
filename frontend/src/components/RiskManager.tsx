import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Crosshair, Calculator, TrendingDown, Target, Skull } from 'lucide-react';

interface RiskManagerProps {
  totalM2M: number;
}

export const RiskManager: React.FC<RiskManagerProps> = ({ totalM2M }) => {
  // --- Daily Risk Monitor State ---
  const [maxDailyLoss, setMaxDailyLoss] = useState<number>(5000);
  
  // --- Position Sizing Calculator State ---
  const [accountSize, setAccountSize] = useState<string>('100000');
  const [riskPercent, setRiskPercent] = useState<string>('1.0');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');

  // Daily Loss Calculations
  const m2mValue = totalM2M || 0;
  // If positive M2M, percent used is 0. If negative, calculate percentage.
  const riskPercentUsed = m2mValue >= 0 ? 0 : Math.min(100, Math.abs(m2mValue) / maxDailyLoss * 100);
  const isDanger = riskPercentUsed >= 80;
  const isBlown = riskPercentUsed >= 100;

  // Position Sizing Calculations
  const acc = parseFloat(accountSize) || 0;
  const riskP = parseFloat(riskPercent) || 0;
  const maxRiskAmount = acc * (riskP / 100);
  
  const entry = parseFloat(entryPrice);
  const sl = parseFloat(stopLoss);
  
  let suggestedQty = 0;
  let riskPerShare = 0;
  
  if (entry > 0 && sl > 0 && entry !== sl) {
    riskPerShare = Math.abs(entry - sl);
    suggestedQty = Math.floor(maxRiskAmount / riskPerShare);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <Shield size={32} color="var(--accent-blue)" />
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Risk Manager</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Protect your capital and calculate optimal trade sizes.</p>
        </div>
      </div>

      {/* DAILY RISK MONITOR */}
      <div className="card glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ActivityIcon isDanger={isDanger} isBlown={isBlown} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Daily Loss Monitor</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Max Daily Limit (₹):</label>
            <input 
              type="number" 
              value={maxDailyLoss} 
              onChange={e => setMaxDailyLoss(Number(e.target.value) || 0)}
              style={{ padding: '0.4rem 0.8rem', width: '100px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: 600 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Current M2M: <strong style={{color: m2mValue >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}}>₹{m2mValue.toFixed(2)}</strong></span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{riskPercentUsed.toFixed(1)}% Limit Used</span>
        </div>

        <div style={{ width: '100%', height: '12px', background: 'var(--bg-main)', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: riskPercentUsed + '%', 
            background: isBlown ? 'var(--accent-red)' : isDanger ? '#f59e0b' : 'var(--accent-blue)',
            transition: 'width 0.5s ease',
          }} />
        </div>
        
        {isBlown && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-red)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-red)' }}>
            <Skull size={20} />
            <span style={{ fontWeight: 700 }}>KILL SWITCH TRIPPED: You have exceeded your maximum daily loss limit. Stop trading for the day.</span>
          </div>
        )}
      </div>

      {/* POSITION SIZING CALCULATOR */}
      <div className="card glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Calculator size={24} color="var(--accent-blue)" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Position Size Calculator</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Total Trading Capital (₹)</label>
              <input type="number" value={accountSize} onChange={e => setAccountSize(e.target.value)} className="input-field" placeholder="100000" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Risk Per Trade (%)</label>
              <input type="number" step="0.1" value={riskPercent} onChange={e => setRiskPercent(e.target.value)} className="input-field" placeholder="1.0" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Entry Price (₹)</label>
                <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} className="input-field" placeholder="150.50" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Stop Loss (₹)</label>
                <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} className="input-field" placeholder="148.00" />
              </div>
            </div>
          </div>

          {/* Outputs */}
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Max Risk Amount</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--accent-red)' }}>₹{maxRiskAmount.toFixed(2)}</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Risk Per Share</span>
              <strong style={{ fontSize: '1.1rem' }}>₹{riskPerShare.toFixed(2)}</strong>
            </div>
            
            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Calculated Quantity</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--accent-blue)', lineHeight: 1 }}>{suggestedQty}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>shares</p>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

// Helper Icon Toggle
const ActivityIcon = ({ isDanger, isBlown }: { isDanger: boolean, isBlown: boolean }) => {
  if (isBlown) return <AlertTriangle color="var(--accent-red)" />;
  if (isDanger) return <AlertTriangle color="#f59e0b" />;
  return <Target color="var(--accent-blue)" />;
};
