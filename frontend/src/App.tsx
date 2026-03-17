import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  TrendingUp, 
  Activity, 
  History, 
  Cpu, 
  Power, 
  ExternalLink,
  Shield,
  BarChart3
} from 'lucide-react';

const App: React.FC = () => {
  const [agentStatus, setAgentStatus] = useState<'ON' | 'OFF'>('OFF');
  const [portfolio, setPortfolio] = useState<any>({ margins: {}, positions: [], holdings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchPortfolio();
    const interval = setInterval(() => {
        if (agentStatus === 'ON') {
            fetchPortfolio();
            fetchStatus();
        }
    }, 5000);
    return () => clearInterval(interval);
  }, [agentStatus]);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/agent/status');
      setAgentStatus(res.data.status);
      setError(null);
    } catch (e: any) { 
        console.error(e);
        setError("Backend unreachable. Ensure FastAPI is running on port 8000.");
    }
  };

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get('/api/portfolio/');
      if (res.data.error) {
        // This is a graceful error from the backend (e.g. Kite not authenticated)
        console.warn("Portfolio Fetch Error:", res.data.error);
      } else {
        setPortfolio(res.data);
      }
      setLoading(false);
    } catch (e: any) { 
      console.error(e);
      setLoading(false);
    }
  };

  const toggleAgent = async () => {
    const nextStatus = agentStatus === 'ON' ? false : true;
    try {
      const res = await axios.post(`/api/agent/toggle?active=${nextStatus}`);
      setAgentStatus(res.data.status);
      setError(null);
    } catch (e: any) { 
        alert("Failed to toggle agent. Is the backend running?");
    }
  };

  const handleZerodhaLogin = async () => {
    try {
      const res = await axios.get('/api/auth/zerodha/login');
      window.location.href = res.data.login_url;
    } catch (e: any) { 
        const errorMsg = e.response?.data?.detail || "Could not get Zerodha Login URL. Check if API Key is set in .env";
        alert(errorMsg);
    }
  };

  return (
    <div className="dashboard">
      {error && (
        <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            background: 'var(--accent-red)', 
            color: 'white', 
            padding: '8px', 
            textAlign: 'center', 
            zIndex: 1000,
            fontSize: '0.9rem'
        }}>
          ⚠️ {error}
        </div>
      )}
      <aside className="sidebar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp color="var(--accent-blue)" size={32} />
          <h2 style={{ fontSize: '1.5rem', letterSpacing: '-1px' }}>SMART TRADE</h2>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button className="glass" style={{ textAlign: 'left', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={20} /> Dashboard
          </button>
          <button style={{ background: 'transparent', textAlign: 'left', padding: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <History size={20} /> History
          </button>
          <button style={{ background: 'transparent', textAlign: 'left', padding: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={20} /> Risk Manager
          </button>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div className="card glass" style={{ padding: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px' }}>Broker Status</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className={`status-badge ${portfolio.error ? 'status-offline' : 'status-online'}`}>
                {portfolio.error ? 'Disconnected' : 'Connected'}
              </span>
              <button onClick={handleZerodhaLogin} style={{ background: 'none', color: 'var(--accent-blue)' }}>
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <h1 style={{ fontSize: '2rem' }}>Trading Overview</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Welcome back, Kailas. AI Agent is currently {agentStatus}.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              onClick={toggleAgent} 
              className="btn-primary" 
              style={{ 
                backgroundColor: agentStatus === 'ON' ? 'var(--accent-red)' : 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Power size={18} /> {agentStatus === 'ON' ? 'Stop Agent' : 'Start Agent'}
            </button>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Net Worth</p>
            <h2 style={{ fontSize: '1.8rem', margin: '8px 0' }}>₹ {portfolio.margins?.equity?.net?.toLocaleString() || '0'}</h2>
            <p style={{ color: 'var(--accent-green)', fontSize: '0.85rem' }}>+2.4% (Today)</p>
          </div>
          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Available Cash</p>
            <h2 style={{ fontSize: '1.8rem', margin: '8px 0' }}>₹ {portfolio.margins?.equity?.available?.cash?.toLocaleString() || '0'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Utilized: ₹0</p>
          </div>
          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Active Positions</p>
            <h2 style={{ fontSize: '1.8rem', margin: '8px 0' }}>{portfolio.positions?.length || 0}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>PnL: ₹0</p>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div className="card glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>Live Market Analysis</h3>
              <BarChart3 size={20} color="var(--text-secondary)" />
            </div>
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
              TradingView Chart Placeholder
            </div>
          </div>

          <div className="card glass">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <Cpu size={20} color="var(--accent-blue)" />
              <h3>AI Reasoning Engine</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid var(--accent-blue)' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>Last Decision: {agentStatus === 'ON' ? 'Analyzing...' : 'Standby'}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {agentStatus === 'ON' 
                    ? "DeepSeek is scanning NSE:RELIANCE for entry signals based on RSI and MACD divergence." 
                    : "Agent is inactive. Start agent to enable AI reasoning."}
                </p>
              </div>
              
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Confidence Score</span>
                  <span>0%</span>
                </div>
                <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '0%', height: '100%', background: 'var(--accent-blue)' }}></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
