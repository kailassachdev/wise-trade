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
  BarChart3,
  User,
  RefreshCw,
  Building2,
  Mail,
  Hash,
  Briefcase,
  CheckCircle,
} from 'lucide-react';

type Tab = 'dashboard' | 'profile' | 'history' | 'risk';

interface KiteProfile {
  user_id: string;
  user_type: string;
  email: string;
  user_name: string;
  user_shortname: string;
  broker: string;
  exchanges: string[];
  products: string[];
  order_types: string[];
  avatar_url: string | null;
  meta?: { demat_consent: string };
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [agentStatus, setAgentStatus] = useState<'ON' | 'OFF'>('OFF');
  const [portfolio, setPortfolio] = useState<any>({ margins: {}, positions: [], holdings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [profile, setProfile] = useState<KiteProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    // Check for auth status in URL
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    if (authStatus === 'success') {
      alert("Successfully connected to Zerodha Broker!");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'error') {
      const message = urlParams.get('message');
      alert(`Authentication failed: ${message}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

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

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      // Frontend instructs backend to fetch profile from Zerodha
      const res = await axios.get('http://localhost:8000/api/auth/profile');
      if (res.data.status === 'success') {
        setProfile(res.data.data);
      }
    } catch (e: any) {
      console.error("Profile fetch error:", e);
      alert(e.response?.data?.detail || "Failed to fetch profile. Make sure you are connected.");
    } finally {
      setProfileLoading(false);
    }
  };

  // Auto-fetch profile when switching to profile tab
  useEffect(() => {
    if (activeTab === 'profile' && !profile) {
      fetchProfile();
    }
  }, [activeTab]);

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
    setIsConnecting(true);
    try {
      const res = await axios.get('http://localhost:8000/api/auth/zerodha/login');
      if (res.data.login_url) {
        window.location.href = res.data.login_url;
      }
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || "Could not initialize Zerodha connection. Check backend logs.";
      alert(errorMsg);
      setIsConnecting(false);
    }
  };

  // ─── PROFILE TAB ────────────────────────────────────────────
  const ProfileTab = () => (
    <div>
      <header className="header">
        <div>
          <h1 style={{ fontSize: '2rem' }}>My Profile</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Zerodha Kite account details</p>
        </div>
        <button
          onClick={fetchProfile}
          disabled={profileLoading}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: profileLoading ? 0.7 : 1 }}
        >
          <RefreshCw size={16} className={profileLoading ? 'spin' : ''} />
          {profileLoading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      {profileLoading && !profile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} style={{ marginRight: '12px', animation: 'spin 1s linear infinite' }} />
          Fetching profile from Zerodha...
        </div>
      )}

      {!profileLoading && !profile && (
        <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>
          <User size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Not Connected</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Connect your Zerodha account to see profile details.
          </p>
          <button onClick={handleZerodhaLogin} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Connect Kite <ExternalLink size={14} />
          </button>
        </div>
      )}

      {profile && (
        <>
          {/* Hero card with avatar */}
          <div className="profile-hero">
            <div className="avatar-ring">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.user_name} />
              ) : (
                <div className="avatar-placeholder">
                  {profile.user_shortname?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{profile.user_name}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {profile.user_shortname} · {profile.user_id}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span className="status-badge status-online">
                  <CheckCircle size={11} style={{ display: 'inline', marginRight: '4px' }} />
                  Zerodha Connected
                </span>
                <span style={{
                  background: 'rgba(168,85,247,0.15)',
                  color: '#a855f7',
                  border: '1px solid rgba(168,85,247,0.3)',
                  borderRadius: '20px',
                  padding: '3px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}>
                  {profile.broker}
                </span>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="profile-info-grid">
            <div className="info-item">
              <div className="info-label"><Mail size={11} style={{ display: 'inline', marginRight: '4px' }} />Email</div>
              <div className="info-value">{profile.email}</div>
            </div>
            <div className="info-item">
              <div className="info-label"><Hash size={11} style={{ display: 'inline', marginRight: '4px' }} />User ID</div>
              <div className="info-value">{profile.user_id}</div>
            </div>
            <div className="info-item">
              <div className="info-label"><Briefcase size={11} style={{ display: 'inline', marginRight: '4px' }} />Account Type</div>
              <div className="info-value" style={{ textTransform: 'capitalize' }}>
                {profile.user_type.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label"><Building2 size={11} style={{ display: 'inline', marginRight: '4px' }} />Broker</div>
              <div className="info-value">{profile.broker}</div>
            </div>
          </div>

          {/* Exchanges */}
          <div className="card glass profile-chip-row" style={{ marginBottom: '1rem' }}>
            <p className="profile-section-title">Enabled Exchanges</p>
            <div>
              {profile.exchanges.map(ex => (
                <span key={ex} className="tag-chip green">{ex}</span>
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="card glass profile-chip-row" style={{ marginBottom: '1rem' }}>
            <p className="profile-section-title">Supported Products</p>
            <div>
              {profile.products.map(p => (
                <span key={p} className="tag-chip">{p}</span>
              ))}
            </div>
          </div>

          {/* Order Types */}
          <div className="card glass profile-chip-row">
            <p className="profile-section-title">Allowed Order Types</p>
            <div>
              {profile.order_types.map(o => (
                <span key={o} className="tag-chip purple">{o}</span>
              ))}
            </div>
          </div>

          {/* Demat consent */}
          {profile.meta && (
            <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle size={20} color="var(--accent-green)" />
              <div>
                <p style={{ fontWeight: 600 }}>Demat Consent</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {profile.meta.demat_consent}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ─── DASHBOARD TAB ──────────────────────────────────────────
  const DashboardTab = () => (
    <div>
      <header className="header">
        <div>
          <h1 style={{ fontSize: '2rem' }}>Trading Overview</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Welcome back{profile ? `, ${profile.user_shortname}` : ''}. AI Agent is currently {agentStatus}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={toggleAgent}
            className="btn-primary"
            style={{
              backgroundColor: agentStatus === 'ON' ? 'var(--accent-red)' : 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', gap: '8px'
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
              <p style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                Last Decision: {agentStatus === 'ON' ? 'Analyzing...' : 'Standby'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {agentStatus === 'ON'
                  ? "DeepSeek is scanning NSE:RELIANCE for entry signals based on RSI and MACD divergence."
                  : "Agent is inactive. Start agent to enable AI reasoning."}
              </p>
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Confidence Score</span><span>0%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '0%', height: '100%', background: 'var(--accent-blue)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="dashboard">
      {error && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: 'var(--accent-red)', color: 'white',
          padding: '8px', textAlign: 'center', zIndex: 1000, fontSize: '0.9rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      <aside className="sidebar">
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp color="var(--accent-blue)" size={32} />
          <h2 style={{ fontSize: '1.5rem', letterSpacing: '-1px' }}>SMART TRADE</h2>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <User size={20} /> Profile
          </button>
          <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Activity size={20} /> Dashboard
          </button>
          <button className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <History size={20} /> History
          </button>
          <button className={`nav-btn ${activeTab === 'risk' ? 'active' : ''}`} onClick={() => setActiveTab('risk')}>
            <Shield size={20} /> Risk Manager
          </button>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div className="card glass" style={{ padding: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px' }}>Broker Status</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`status-badge ${portfolio.error ? 'status-offline' : 'status-online'}`}>
                  {portfolio.error ? 'Disconnected' : 'Connected'}
                </span>
              </div>
              {portfolio.error && (
                <button
                  onClick={handleZerodhaLogin}
                  disabled={isConnecting}
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '6px 10px', width: '100%', justifyContent: 'center', marginTop: '4px', opacity: isConnecting ? 0.7 : 1 }}
                >
                  {isConnecting ? 'Initializing...' : 'Connect Kite'}
                  {!isConnecting && <ExternalLink size={12} style={{ marginLeft: '4px' }} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)', flexDirection: 'column', gap: '1rem' }}>
            <History size={48} />
            <h3>Trade History</h3>
            <p>Coming soon: Full order and P&L history.</p>
          </div>
        )}
        {activeTab === 'risk' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)', flexDirection: 'column', gap: '1rem' }}>
            <Shield size={48} />
            <h3>Risk Manager</h3>
            <p>Coming soon: Stop-loss and position sizing controls.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
