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
  ShoppingCart,
} from 'lucide-react';

type Tab = 'home' | 'dashboard' | 'profile' | 'history' | 'risk' | 'orders';

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
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [agentStatus, setAgentStatus] = useState<'ON' | 'OFF'>('OFF');
  const [portfolio, setPortfolio] = useState<any>({ margins: {}, positions: [], holdings: [] });
  const [brokerConnected, setBrokerConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [profile, setProfile] = useState<KiteProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [orderForm, setOrderForm] = useState({
    variety: 'regular',
    exchange: 'NSE',
    tradingsymbol: '',
    transaction_type: 'BUY',
    quantity: 1,
    product: 'CNC',
    order_type: 'MARKET',
    price: '',
  });
  const [orderStatus, setOrderStatus] = useState<{msg: string; type: 'success'|'error'} | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

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
        // Broker not authenticated — store error so sidebar reflects 'Not Connected'
        console.warn("Broker not connected:", res.data.error);
        setPortfolio({ margins: {}, positions: [], holdings: [], error: res.data.error });
        setBrokerConnected(false);
      } else {
        setPortfolio(res.data);
        setBrokerConnected(true);
      }
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      setBrokerConnected(false);
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
      // Step 1: Ask backend to generate the dynamic login URL using API key from .env
      const res = await axios.get('http://localhost:8000/api/auth/zerodha/login');
      
      // Step 2: Backend returns: { login_url: "https://kite.zerodha.com/connect/login?v=3&api_key=...", status: "initialized" }
      if (res.data.login_url) {
        console.log("Redirecting to Zerodha login:", res.data.login_url);
        // Step 3: Open Zerodha login in the same tab
        window.location.href = res.data.login_url;
      }
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || "Could not initialize Zerodha connection. Check backend logs.";
      alert(errorMsg);
      setIsConnecting(false);
    }
  };

  // ─── HOME DIRECTORY TAB ────────────────────────────────────
  const HomeTab = () => (
    <div className="home-layout fade-in">
      {/* Hero Banner */}
      <div className="hero-banner">
        <TrendingUp size={48} color="var(--accent-blue)" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '3rem', letterSpacing: '-1px', marginBottom: '0.5rem' }}>SMART TRADE</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>AI-Powered Trading & Portfolio Management</p>
        
        {/* Quick status dots */}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2.5rem', justifyContent: 'center' }}>
          <span className={`status-badge ${brokerConnected ? 'status-online' : 'status-offline'}`} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
            {brokerConnected ? <><CheckCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />Broker Connected</> : 'Broker Offline'}
          </span>
          <span className={`status-badge ${agentStatus === 'ON' ? 'status-online' : 'status-offline'}`} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
             {agentStatus === 'ON' ? 'Agent Active' : 'Agent Standby'}
          </span>
        </div>
      </div>

      {/* Navigation Feature Rows */}
      <div className="directory-list">
        {/* Profile: Text Left, Button Right */}
        <div className="feature-row">
          <div className="feature-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <User size={48} color="var(--accent-blue)" />
              <h3 style={{ margin: 0, fontSize: '2.5rem' }}>My Profile</h3>
            </div>
            <p>Manage your Zerodha Kite connection, view demat status, and review account permissions.</p>
          </div>
          <div className="feature-action">
            <button className="btn-primary" onClick={() => setActiveTab('profile')}>View Profile</button>
          </div>
        </div>

        {/* Dashboard: Text Right, Button Left */}
        <div className="feature-row reverse">
          <div className="feature-text" style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '2.5rem' }}>Dashboard</h3>
              <Activity size={48} color="var(--accent-green)" />
            </div>
            <p>Monitor the live AI reasoning engine, track your net worth, and oversee your portfolio overview.</p>
          </div>
          <div className="feature-action" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'flex-end' }}>
            <img 
              src="/graph.png" 
              alt="Market Trend" 
              style={{ width: '100%', maxWidth: '400px', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }} 
            />
            <button className="btn-primary" onClick={() => setActiveTab('dashboard')}>View Dashboard</button>
          </div>
        </div>

        {/* Orders: Text Left, Button Right */}
        <div className="feature-row">
          <div className="feature-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <ShoppingCart size={48} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '2.5rem' }}>Place Order</h3>
            </div>
            <p>Manually place buy or sell orders on NSE/BSE directly via your Zerodha Kite broker.</p>
          </div>
          <div className="feature-action">
            <button className="btn-primary" style={{ backgroundColor: '#f59e0b' }} onClick={() => setActiveTab('orders')}>Open Order Form</button>
          </div>
        </div>

        {/* History: Text Right, Button Left */}
        <div className="feature-row reverse">
          <div className="feature-text" style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '2.5rem' }}>Trade History</h3>
              <History size={48} color="#a855f7" />
            </div>
            <p>Review all historical trades, past order placements, and P&L executed seamlessly by the AI.</p>
          </div>
          <div className="feature-action">
            <button className="btn-primary" onClick={() => setActiveTab('history')}>View History</button>
          </div>
        </div>

        {/* Risk Manager: Text Left, Button Right */}
        <div className="feature-row">
          <div className="feature-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <Shield size={48} color="var(--accent-red)" />
              <h3 style={{ margin: 0, fontSize: '2.5rem' }}>Risk Manager</h3>
            </div>
            <p>Configure vital stop-loss parameters, max drawdown limits, and detailed position sizing settings.</p>
          </div>
          <div className="feature-action">
            <button className="btn-primary" onClick={() => setActiveTab('risk')}>View Risk Controls</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── PROFILE TAB ────────────────────────────────────────────
  const ProfileTab = () => (
    <div className="fade-in">
      <div className="inner-page-topbar">
        <button className="btn-back" onClick={() => setActiveTab('home')}>← Home</button>
        <div className="inner-page-title">
          <User size={22} color="var(--accent-blue)" />
          <h2>My Profile</h2>
        </div>
        <button onClick={fetchProfile} disabled={profileLoading} className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: profileLoading ? 0.7 : 1 }}>
          <RefreshCw size={14} className={profileLoading ? 'spin' : ''} />
          {profileLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      <div className="page-content">

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
    </div>
  );

  // ─── DASHBOARD TAB ──────────────────────────────────────────
  const DashboardTab = () => (
    <div className="fade-in">
      <div className="inner-page-topbar">
        <button className="btn-back" onClick={() => setActiveTab('home')}>← Home</button>
        <div className="inner-page-title">
          <Activity size={22} color="var(--accent-green)" />
          <h2>Trading Overview</h2>
        </div>
        <button onClick={toggleAgent} className="btn-primary"
          style={{ backgroundColor: agentStatus === 'ON' ? 'var(--accent-red)' : 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Power size={16} /> {agentStatus === 'ON' ? 'Stop Agent' : 'Start Agent'}
        </button>
      </div>
      <div className="page-content">

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
      </div>  {/* close page-content */}
    </div>
  );

  // ─── ORDERS TAB ─────────────────────────────────────────
  const OrdersTab = () => {
    const handleOrderSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setOrderLoading(true);
      setOrderStatus(null);
      try {
        const payload: any = {
          exchange: orderForm.exchange,
          tradingsymbol: orderForm.tradingsymbol,
          transaction_type: orderForm.transaction_type,
          quantity: Number(orderForm.quantity),
          product: orderForm.product,
          order_type: orderForm.order_type,
        };
        if (orderForm.order_type !== 'MARKET') payload.price = Number(orderForm.price);
        const res = await axios.post(`/api/orders/${orderForm.variety}`, payload);
        setOrderStatus({ msg: `✅ Order placed successfully! ID: ${res.data.order_id || 'OK'}`, type: 'success' });
      } catch (err: any) {
        setOrderStatus({ msg: `❌ ${err.response?.data?.detail || 'Order failed. Check broker connection.'}`, type: 'error' });
      } finally {
        setOrderLoading(false);
      }
    };
    return (
      <div className="fade-in">
        <div className="inner-page-topbar">
          <button className="btn-back" onClick={() => setActiveTab('home')}>← Home</button>
          <div className="inner-page-title"><ShoppingCart size={22} color="#f59e0b" /><h2>Place Order</h2></div>
          <span />
        </div>
        <div className="page-content">
          <div style={{ maxWidth: '620px', margin: '0 auto' }}>
            <div className="card glass" style={{ padding: '2.5rem' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>New Order</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Submit a buy or sell order directly via Zerodha Kite.</p>
              {orderStatus && (
                <div style={{ padding: '0.9rem 1.2rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 600,
                  background: orderStatus.type === 'success' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)',
                  color: orderStatus.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${orderStatus.type === 'success' ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}`
                }}>{orderStatus.msg}</div>
              )}
              <form onSubmit={handleOrderSubmit}>
                <div className="order-grid">
                  {(['variety','exchange','transaction_type','order_type','product'] as const).map(key => {
                    const options: Record<string, string[]> = {
                      variety: ['regular','co','amo','iceberg','auction'],
                      exchange: ['NSE','BSE','NFO','MCX','BFO','CDS'],
                      transaction_type: ['BUY','SELL'],
                      order_type: ['MARKET','LIMIT','SL','SL-M'],
                      product: ['CNC','MIS','NRML','MTF'],
                    };
                    return (
                      <div className="order-field" key={key}>
                        <label className="order-label">{key.replace(/_/g,' ').toUpperCase()}</label>
                        <select className="order-input" value={String(orderForm[key])} onChange={e => setOrderForm(f => ({ ...f, [key]: e.target.value }))}>
                          {options[key].map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  <div className="order-field">
                    <label className="order-label">SYMBOL</label>
                    <input className="order-input" placeholder="e.g. RELIANCE" value={orderForm.tradingsymbol}
                      onChange={e => setOrderForm(f => ({ ...f, tradingsymbol: e.target.value }))} required />
                  </div>
                  <div className="order-field">
                    <label className="order-label">QUANTITY</label>
                    <input className="order-input" type="number" min={1} value={orderForm.quantity}
                      onChange={e => setOrderForm(f => ({ ...f, quantity: Number(e.target.value) }))} required />
                  </div>
                  {orderForm.order_type !== 'MARKET' && (
                    <div className="order-field">
                      <label className="order-label">PRICE</label>
                      <input className="order-input" type="number" step="0.05" value={orderForm.price}
                        onChange={e => setOrderForm(f => ({ ...f, price: e.target.value }))} required />
                    </div>
                  )}
                </div>
                <button type="submit" className="btn-primary" disabled={orderLoading}
                  style={{ width: '100%', marginTop: '2rem', padding: '1rem', fontSize: '1.05rem',
                    backgroundColor: orderForm.transaction_type === 'BUY' ? '#f59e0b' : 'var(--accent-red)',
                    justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px',
                    opacity: orderLoading ? 0.7 : 1 }}>
                  <ShoppingCart size={18} />
                  {orderLoading ? 'Placing Order...' : `${orderForm.transaction_type} ${orderForm.tradingsymbol || '...'}`}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {error && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 1000,
          background: 'var(--accent-red)', color: 'white',
          padding: '8px', textAlign: 'center', fontSize: '0.9rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      <main className="main-content-full">
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'orders' && <OrdersTab />}
        
        {activeTab === 'history' && (
          <div className="fade-in">
            <div className="inner-page-topbar">
              <button className="btn-back" onClick={() => setActiveTab('home')}>← Home</button>
              <div className="inner-page-title"><History size={22} color="#a855f7" /><h2>Trade History</h2></div>
              <span />
            </div>
            <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
              <History size={60} color="#a855f7" />
              <h3 style={{ fontSize: '1.8rem' }}>Trade History</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Coming soon: Full order and P&L history.</p>
            </div>
          </div>
        )}
        
        {activeTab === 'risk' && (
          <div className="fade-in">
            <div className="inner-page-topbar">
              <button className="btn-back" onClick={() => setActiveTab('home')}>← Home</button>
              <div className="inner-page-title"><Shield size={22} color="var(--accent-red)" /><h2>Risk Manager</h2></div>
              <span />
            </div>
            <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
              <Shield size={60} color="var(--accent-red)" />
              <h3 style={{ fontSize: '1.8rem' }}>Risk Manager</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Coming soon: Stop-loss and position sizing controls.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
