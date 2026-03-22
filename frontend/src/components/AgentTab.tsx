import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Bot, ScanLine, CheckCircle, XCircle, RefreshCw,
  TrendingUp, TrendingDown, AlertTriangle, Activity,
  Zap, Target, ShieldAlert, Clock
} from 'lucide-react';

interface Proposal {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  qty: number;
  target: number | null;
  stop_loss: number | null;
  reason: string;
  momentum_pct?: number;
  vol_ratio?: number;
  variety: string;
  order_type: string;
  limit_price: number;
  exchange: string;
  score?: number;
}

interface LogEntry {
  time: string;
  msg: string;
}

interface AgentTabProps {
  brokerConnected: boolean;
  accountBalance?: number;
}

export const AgentTab: React.FC<AgentTabProps> = ({ brokerConnected, accountBalance = 100000 }) => {
  const [scanning, setScanning] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [agentActive, setAgentActive] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Scan settings
  const [riskPct, setRiskPct] = useState('1.0');
  const [targetPct, setTargetPct] = useState('5.0');
  const [slPct, setSlPct] = useState('2.0');
  const [maxProposals, setMaxProposals] = useState('2');
  const [autoApprove, setAutoApprove] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  // Fetch agent status on mount

  useEffect(() => {
    axios.get('/api/agent/status').then(r => setAgentActive(r.data.status === 'ON')).catch(() => { });
  }, []);

  // Poll monitor every 30s
  useEffect(() => {
    fetchMonitor();
    const interval = setInterval(fetchMonitor, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAgent = async () => {
    setToggling(true);
    try {
      const newState = !agentActive;
      await axios.post(`/api/agent/toggle?active=${newState}`);
      setAgentActive(newState);
    } catch (e: any) {
      alert('Agent toggle failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setToggling(false);
    }
  };

  const fetchMonitor = async () => {
    try {
      const res = await axios.get('/api/agent/monitor');
      setLog(res.data.log || []);
      setPositions(res.data.positions || []);
      setProposals(prev => {
        // Merge monitor proposals with existing to not lose scan results
        const monitorProposals = res.data.proposals || [];
        const existingIds = new Set(prev.map(p => p.id));
        const newOnes = monitorProposals.filter((p: Proposal) => !existingIds.has(p.id));
        return [...prev, ...newOnes];
      });
      if (res.data.auto_approve !== undefined && res.data.auto_approve !== autoApprove) {
        setAutoApprove(res.data.auto_approve);
      }
    } catch { /* silent */ }
  };

  const handleScan = async () => {
    setScanning(true);
    setProposals([]);
    try {
      const res = await axios.post(`/api/agent/scan?account_balance=${accountBalance}&risk_pct=${riskPct}&target_pct=${targetPct}&sl_pct=${slPct}&max_proposals=${maxProposals}&auto_approve=${autoApprove}`);
      setProposals(res.data.proposals || []);
    } catch (e: any) {
      alert('Scan failed: ' + (e.response?.data?.message || e.message));
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      await axios.post(`/api/agent/approve/${id}`);
      setProposals(prev => prev.filter(p => p.id !== id));
      fetchMonitor();
    } catch (e: any) {
      alert('Order failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await axios.post(`/api/agent/reject/${id}`);
      setProposals(prev => prev.filter(p => p.id !== id));
    } catch { /* silent */ }
  };

  const handleToggleAutoApprove = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAutoApprove(checked);
    try {
      await axios.post(`/api/agent/auto_approve?active=${checked}`);
    } catch (e: any) {
      alert('Could not toggle auto approve: ' + (e.response?.data?.detail || e.message));
      setAutoApprove(!checked);
    }
  };

  const buyProposals = proposals.filter(p => p.action === 'BUY');
  const sellProposals = proposals.filter(p => p.action === 'SELL');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Bot size={32} color={agentActive ? 'var(--accent-green)' : 'var(--accent-blue)'} />
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>AI Trading Agent</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {autoApprove ? 'Auto-Approve Mode — agent trades autonomously.' : 'Approval Mode — all orders need your confirmation before execution.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {!brokerConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} /> Broker not connected
            </div>
          )}
          <button
            onClick={handleToggleAgent}
            disabled={toggling}
            style={{
              padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none',
              background: agentActive ? 'var(--accent-red)' : 'var(--accent-green)',
              color: 'white', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              opacity: toggling ? 0.7 : 1
            }}
          >
            {toggling
              ? <RefreshCw size={15} className="spin" />
              : <Activity size={15} />}
            {agentActive ? 'Stop Agent' : 'Start Agent'}
          </button>
        </div>
      </div>

      {/* SCAN CONTROLS */}
      <div className="card glass">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ScanLine size={20} color="var(--accent-blue)" />
            <h3 style={{ fontWeight: 700 }}>Market Scan Settings</h3>
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: autoApprove ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
              Auto-Approve Trades
            </span>
            <div style={{
              width: '40px', height: '22px', borderRadius: '12px',
              background: autoApprove ? 'var(--accent-green)' : 'var(--bg-main)',
              border: `1px solid ${autoApprove ? 'var(--accent-green)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center',
              padding: '2px', transition: 'all 0.2s', position: 'relative'
            }}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                transform: `translateX(${autoApprove ? '18px' : '0'})`, transition: 'transform 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </div>
            <input 
              type="checkbox" 
              checked={autoApprove} 
              onChange={handleToggleAutoApprove} 
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Risk Per Trade (%)', val: riskPct, set: setRiskPct, step: '0.1' },
            { label: 'Target (%)', val: targetPct, set: setTargetPct, step: '0.5' },
            { label: 'Stop-Loss (%)', val: slPct, set: setSlPct, step: '0.5' },
            { label: 'Max Proposals', val: maxProposals, set: setMaxProposals, step: '1' },
          ].map(({ label, val, set, step }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
              <input type="number" step={step} value={val} onChange={e => set(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          <span>Capital: <strong style={{ color: 'var(--text-primary)' }}>₹{accountBalance.toLocaleString('en-IN')}</strong></span>
          <span>•</span>
          <span>Max risk/trade: <strong style={{ color: 'var(--accent-red)' }}>₹{(accountBalance * parseFloat(riskPct || '0') / 100).toFixed(0)}</strong></span>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning || !brokerConnected}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: (scanning || !brokerConnected) ? 0.6 : 1 }}
        >
          {scanning
            ? <><RefreshCw size={16} className="spin" /> Scanning NSE penny stocks...</>
            : <><Zap size={16} /> Scan Market</>}
        </button>
      </div>

      {/* SELL ALERTS (priority display) */}
      {sellProposals.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <ShieldAlert size={18} color="var(--accent-red)" />
            <h3 style={{ fontWeight: 700, color: 'var(--accent-red)' }}>Exit Alerts ({sellProposals.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sellProposals.map(p => (
              <ProposalCard key={p.id} proposal={p} onApprove={handleApprove} onReject={handleReject} approving={approving} />
            ))}
          </div>
        </div>
      )}

      {/* BUY PROPOSALS */}
      {buyProposals.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <TrendingUp size={18} color="var(--accent-green)" />
            <h3 style={{ fontWeight: 700 }}>Buy Proposals ({buyProposals.length})</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {buyProposals.map(p => (
              <ProposalCard key={p.id} proposal={p} onApprove={handleApprove} onReject={handleReject} approving={approving} />
            ))}
          </div>
        </div>
      )}

      {proposals.length === 0 && !scanning && (
        <div className="card glass" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <Bot size={48} style={{ margin: '0 auto 1rem' }} />
          <p>No proposals yet. Click <strong>Scan Market</strong> to find penny stock opportunities.</p>
        </div>
      )}

      {/* POSITION MONITOR */}
      {positions.filter((p: any) => p.quantity !== 0).length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Activity size={18} color="var(--accent-blue)" />
            <h3 style={{ fontWeight: 700 }}>Live Position Monitor</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Auto-refreshes every 30s</span>
          </div>
          <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', background: 'var(--bg-main)', padding: '0.75rem 1.25rem', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              <span>Symbol</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Avg</span><span style={{ textAlign: 'right' }}>LTP</span><span style={{ textAlign: 'right' }}>M2M</span>
            </div>
            {positions.filter((p: any) => p.quantity !== 0).map((p: any, i: number) => {
              const pnl = p.m2m || p.pnl || 0;
              const isUp = pnl >= 0;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{p.tradingsymbol}</span>
                  <span style={{ textAlign: 'right' }}>{p.quantity}</span>
                  <span style={{ textAlign: 'right' }}>₹{(p.average_price || 0).toFixed(2)}</span>
                  <span style={{ textAlign: 'right' }}>₹{(p.last_price || 0).toFixed(2)}</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {isUp ? '+' : ''}₹{pnl.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVITY LOG */}
      {log.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Clock size={16} color="var(--text-secondary)" />
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Agent Activity Log</h3>
          </div>
          <div ref={logRef} className="card glass" style={{ padding: '1rem', maxHeight: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.82rem' }}>
            {log.map((entry, i) => (
              <div key={i} style={{ marginBottom: '0.3rem', color: entry.msg.includes('🚨') ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-primary)', marginRight: '0.75rem', fontWeight: 600 }}>{entry.time}</span>
                {entry.msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Proposal Card ───────────────────────────────────────────────────────
const ProposalCard: React.FC<{
  proposal: Proposal;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approving: string | null;
}> = ({ proposal: p, onApprove, onReject, approving }) => {
  const isBuy = p.action === 'BUY';
  const isAmo = p.variety === 'amo';
  const totalCost = p.price * p.qty;

  return (
    <div className="card glass" style={{ padding: '1.25rem 1.5rem', borderLeft: `3px solid ${isBuy ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>

        {/* Left — stock info */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '8px', background: isBuy ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.12)' }}>
            {isBuy ? <TrendingUp size={22} color="var(--accent-green)" /> : <TrendingDown size={22} color="var(--accent-red)" />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{p.symbol}</span>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                color: isBuy ? 'var(--accent-green)' : 'var(--accent-red)',
                background: isBuy ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)',
                border: `1px solid ${isBuy ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}`
              }}>
                {p.action}
              </span>
              {isAmo && (
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                  color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)'
                }}>
                  AMO
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 480 }}>{p.reason}</p>
          </div>
        </div>

        {/* Right — approve/reject */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => onReject(p.id)}
            style={{
              padding: '0.5rem 1.1rem', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.4)',
              background: 'rgba(220,38,38,0.08)', color: 'var(--accent-red)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
            }}>
            <XCircle size={15} /> Reject
          </button>
          <button
            onClick={() => onApprove(p.id)}
            disabled={approving === p.id}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
              background: isBuy ? 'var(--accent-green)' : 'var(--accent-red)', color: 'white',
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
              opacity: approving === p.id ? 0.6 : 1
            }}>
            {approving === p.id ? <RefreshCw size={14} className="spin" /> : <CheckCircle size={15} />}
            {approving === p.id ? 'Placing...' : 'Approve'}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        {([
          ['Price', `₹${p.price}`],
          ['Quantity', String(p.qty)],
          ['Total Cost', `₹${totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
          p.target ? ['Target', `₹${p.target}`] : null,
          p.stop_loss ? ['Stop-Loss', `₹${p.stop_loss}`] : null,
          ['Order', `${p.variety.toUpperCase()} / ${p.order_type}`],
          p.momentum_pct !== undefined ? ['Momentum', `+${p.momentum_pct}%`] : null,
          p.vol_ratio !== undefined ? ['Volume Surge', `${p.vol_ratio}×`] : null,
        ].filter(Boolean) as [string, string][]).map(([label, val]) => (
          <div key={label}>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{label}</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '2px' }}>{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
