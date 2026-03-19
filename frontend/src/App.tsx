import React, { useState, useEffect, useRef } from 'react';
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
  Wifi,
  WifiOff,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Wallet,
  Package,
  X,
  LineChart,
} from 'lucide-react';
import { CandlestickChart, Candle } from './components/CandlestickChart';
import { RiskManager } from './components/RiskManager';

type Tab = 'home' | 'dashboard' | 'profile' | 'history' | 'risk' | 'orders' | 'holdings' | 'positions' | 'place_order';

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

interface WatchlistTick {
  instrument_token: number;
  symbol: string;
  exchange: string;
  last_price: number;
  change: number;
  change_pct: number;
  volume?: number;
  ohlc: { open?: number; high?: number; low?: number; close?: number };
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [agentStatus, setAgentStatus] = useState<'ON' | 'OFF'>('OFF');
  const [portfolio, setPortfolio] = useState<any>({ margins: {}, positions: [], holdings: [] });
  const [brokerConnected, setBrokerConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [profile, setProfile] = useState<KiteProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Watchlist polling state
  const [watchlist, setWatchlist] = useState<WatchlistTick[]>([]);
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'error'>('idle');
  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({});
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [orderForm, setOrderForm] = useState({
    variety: 'regular',
    exchange: 'NSE',
    tradingsymbol: '',
    transaction_type: 'BUY',
    quantity: 1,
    product: 'CNC',
    order_type: 'MARKET',
    price: '',
    trigger_price: '',
    disclosed_quantity: '',
    validity: 'DAY',
  });
  const [orderStatus, setOrderStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  // Orders History State
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histFilter, setHistFilter] = useState<string>('ALL');

  // Positions Tab State
  const [posView, setPosView] = useState<'net' | 'day'>('net');

  // Chart Modal State
  const [selectedChartPosition, setSelectedChartPosition] = useState<any | null>(null);
  const [chartData, setChartData] = useState<Candle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const openChart = async (position: any) => {
    setSelectedChartPosition(position);
    setChartLoading(true);
    setChartError(null);
    try {
      const res = await axios.get(`/api/market/historical/${position.tradingsymbol}`);
      if (res.data.status === 'success') {
        const mapped = res.data.candles.map((c: any) => ({
          timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
        }));
        setChartData(mapped);
      } else {
        setChartError(res.data.message || "Failed to load chart data");
      }
    } catch (err: any) {
      setChartError(err.response?.data?.message || err.message || "Network error loading chart");
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'orders' && brokerConnected) {
      setHistLoading(true);
      axios.get('/api/trade/orders')
        .then(r => setHistoryOrders(r.data.orders || []))
        .catch(() => setHistoryOrders([]))
        .finally(() => setHistLoading(false));
    }
  }, [activeTab, brokerConnected]);

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
      const res = await axios.get('/api/auth/profile');
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

  // ── Watchlist REST Polling (every 3 seconds) ──────────────────────────────
  const fetchWatchlist = async () => {
    try {
      const res = await axios.get('/api/market/watchlist');
      if (res.data.error) {
        setPollStatus('error');
        return;
      }
      const items: WatchlistTick[] = res.data.items || [];

      // Detect price changes for flash animation
      const newFlash: Record<string, 'up' | 'down'> = {};
      items.forEach(tick => {
        const prev = prevPricesRef.current[tick.symbol];
        if (prev !== undefined && tick.last_price !== prev) {
          newFlash[tick.symbol] = tick.last_price > prev ? 'up' : 'down';
        }
        prevPricesRef.current[tick.symbol] = tick.last_price;
      });

      if (Object.keys(newFlash).length > 0) {
        setFlashMap(f => ({ ...f, ...newFlash }));
        setTimeout(() => setFlashMap(f => {
          const cleared = { ...f };
          Object.keys(newFlash).forEach(k => delete cleared[k]);
          return cleared;
        }), 600);
      }

      setWatchlist(items);
      setPollStatus('polling');
    } catch (e) {
      setPollStatus('error');
    }
  };

  // ── Smart Global Stock Search (debounced) ───────────────────────────────────
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await axios.get(`http://localhost:8000/api/market/search?q=${searchQuery}`);
        if (res.data.status === 'success') {
          setSearchResults(res.data.results);
        }
      } catch (e) {
        console.error("Search failed", e);
      }
      setIsSearching(false);
    }, 600); // 600ms typing debounce
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Start/stop polling for Yahoo Finance Market Data regardless of broker connection
  useEffect(() => {
    fetchWatchlist(); // immediate first load
    pollIntervalRef.current = setInterval(fetchWatchlist, 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

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

  const handleWatchlistTrade = (symbol: string, transaction_type: 'BUY' | 'SELL', price: number) => {
    setOrderForm(prev => ({
      ...prev,
      variety: 'amo',
      exchange: 'NSE',
      product: 'CNC',
      tradingsymbol: symbol,
      transaction_type,
      // Provide a safe LIMIT price (e.g., 0.5% below for BUY to guarantee Zerodha AMO validation)
      price: String((transaction_type === 'BUY' ? price * 0.995 : price * 1.005).toFixed(2)),
      order_type: 'LIMIT'
    }));
    setActiveTab('orders');
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
      <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>My Profile</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
          <button onClick={fetchProfile} disabled={profileLoading} className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: profileLoading ? 0.7 : 1 }}>
            <RefreshCw size={14} className={profileLoading ? 'spin' : ''} />
            {profileLoading ? 'Loading...' : 'Refresh Profile'}
          </button>
        </div>
      </div>

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
  const DashboardTab = () => {
    // Calculate PnL from positions if available. 
    // Zerodha API returns {"net": [...], "day": [...]}.
    const positionsData = portfolio.positions || [];
    const positions = Array.isArray(positionsData) ? positionsData : (positionsData.net || []);
    const totalM2M = positions.reduce((acc: number, p: any) => acc + (p.m2m || 0), 0);
    const m2mColor = totalM2M >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    const m2mSign = totalM2M >= 0 ? '+' : '';

    // Advanced Margin Parsing
    const eq = portfolio.margins?.equity || {};
    const net = eq.net || 0;
    const avail = eq.available?.live_balance || eq.available?.cash || 0;
    const collateral = eq.available?.collateral || 0;

    // Total utilized can be calculated from debits or span+exposure. Let's use debits
    const utilised = eq.utilised?.debits || 0;
    const delivery = eq.utilised?.delivery || 0;

    // For net worth trend, we use M2M as a proxy for today's change on net
    const trendPct = net > 0 ? (totalM2M / net) * 100 : 0;
    const trendColor = trendPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    const trendSign = trendPct >= 0 ? '+' : '';

    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Trading Overview</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Welcome back{profile ? `, ${profile.user_shortname}` : ''}. AI Agent is currently {agentStatus}.</p>
          </div>
          <button onClick={toggleAgent} className="btn-primary"
            style={{ backgroundColor: agentStatus === 'ON' ? 'var(--accent-red)' : 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Power size={16} /> {agentStatus === 'ON' ? 'Stop Agent' : 'Start Agent'}
          </button>
        </div>

        {/* Dynamic Margin Stats Row */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Account Value (Net)</p>
            <h2 style={{ fontSize: '1.8rem', margin: '8px 0' }}>₹{net.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h2>
            <p style={{ color: trendColor, fontSize: '0.85rem', fontWeight: 600 }}>{trendSign}{trendPct.toFixed(2)}% PnL (Today)</p>
          </div>

          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Available Margin</p>
            <h2 style={{ fontSize: '1.8rem', margin: '8px 0', color: 'var(--accent-blue)' }}>₹{avail.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Collateral: ₹{collateral.toLocaleString('en-IN')}</p>
          </div>

          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Margin Utilized</p>
            <h2 style={{ fontSize: '1.8rem', margin: '8px 0', color: utilised > 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
              ₹{Math.abs(utilised).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Delivery: ₹{Math.abs(delivery).toLocaleString('en-IN')}</p>
          </div>

          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Positions M2M</p>
            <h2 style={{ fontSize: '1.8rem', margin: '8px 0', color: m2mColor }}>
              {m2mSign}₹{Math.abs(totalM2M).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{positions.length} Active Positions</p>
          </div>
        </section>

        {/* Live Watchlist */}
        <div className="card glass" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BarChart3 size={20} color="var(--accent-blue)" />
              <h3 style={{ margin: 0 }}>Live Watchlist</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Poll status indicator and Search */}
              <span style={{
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem',
                color: pollStatus === 'polling' ? 'var(--accent-green)' : pollStatus === 'error' ? 'var(--accent-red)' : 'var(--text-secondary)',
                fontWeight: 600
              }}>
                {pollStatus === 'polling' ? <Wifi size={13} /> : pollStatus === 'error' ? <WifiOff size={13} /> : <RefreshCw size={13} />}
                {pollStatus === 'polling' ? 'LIVE · 3s' : pollStatus === 'error' ? 'Error' : 'Waiting...'}
              </span>
              <div style={{ position: 'relative', marginLeft: '10px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Search stocks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    padding: '6px 12px 6px 30px', borderRadius: '20px', fontSize: '0.85rem', width: '200px',
                    border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)'
                  }}
                />
              </div>
              {pollStatus === 'error' && brokerConnected && (
                <button onClick={fetchWatchlist} style={{ background: 'var(--accent-blue)', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, marginLeft: '6px' }}>
                  Retry
                </button>
              )}
            </div>
          </div>

          {/* Watchlist Table */}
          {watchlist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem' }} />
              <p>Connecting to market feed...</p>
            </div>
          ) : (
            <div className="watchlist-table">
              <div className="watchlist-header" style={{ gridTemplateColumns: searchQuery.length >= 2 ? '3fr 1.5fr 1fr 1.5fr' : '1.8fr 1.2fr 1fr 1fr 1fr 1fr 1.5fr' }}>
                <span>{searchQuery.length >= 2 ? 'Company Name & Symbol' : 'Symbol'}</span>
                <span style={{ textAlign: 'right' }}>LTP (₹)</span>
                <span style={{ textAlign: 'right' }}>Change</span>
                {searchQuery.length < 2 && (
                  <>
                    <span style={{ textAlign: 'right' }}>Open</span>
                    <span style={{ textAlign: 'right' }}>High</span>
                    <span style={{ textAlign: 'right' }}>Low</span>
                  </>
                )}
                <span style={{ textAlign: 'right' }}>Trade</span>
              </div>

              {isSearching ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <RefreshCw className="spin" size={20} style={{ margin: '0 auto 0.5rem' }} />
                  <p>Searching Yahoo Finance...</p>
                </div>
              ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p>No valid Indian stocks found for "{searchQuery}"</p>
                </div>
              ) : (searchQuery.length >= 2 ? searchResults : watchlist.filter(t => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()))).map((tick: any) => {
                const isUp = tick.change_pct >= 0;
                const flash = flashMap[tick.symbol];
                const isSearchMode = searchQuery.length >= 2;

                return (
                  <div key={`${tick.symbol}-${tick.exchange}`} className={`watchlist-row ${flash ? `flash-${flash}` : ''}`}
                    style={{ gridTemplateColumns: isSearchMode ? '3fr 1.5fr 1fr 1.5fr' : '1.8fr 1.2fr 1fr 1fr 1fr 1fr 1.5fr' }}>
                    <div className="watchlist-symbol">
                      <span className="symbol-name">{isSearchMode ? tick.name : tick.symbol}</span>
                      <span className="symbol-exchange">{tick.symbol} • {tick.exchange || 'NSE'}</span>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {tick.last_price > 0
                        ? tick.last_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : 'N/A'}
                    </div>
                    <div style={{
                      textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px',
                      color: isUp ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600, fontSize: '0.9rem'
                    }}>
                      {tick.last_price > 0 && (isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
                      {tick.last_price > 0 ? `${tick.change_pct.toFixed(2)}%` : '—'}
                    </div>

                    {!isSearchMode && (
                      <>
                        <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                          {tick.ohlc?.open?.toFixed(2) ?? '—'}
                        </div>
                        <div style={{ textAlign: 'right', color: 'var(--accent-green)', fontSize: '0.88rem' }}>
                          {tick.ohlc?.high?.toFixed(2) ?? '—'}
                        </div>
                        <div style={{ textAlign: 'right', color: 'var(--accent-red)', fontSize: '0.88rem' }}>
                          {tick.ohlc?.low?.toFixed(2) ?? '—'}
                        </div>
                      </>
                    )}

                    <div style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {tick.last_price > 0 ? (
                        <>
                          <button className="btn-trade-small btn-buy" onClick={() => handleWatchlistTrade(tick.symbol, 'BUY', tick.last_price)}>BUY</button>
                          <button className="btn-trade-small btn-sell" onClick={() => handleWatchlistTrade(tick.symbol, 'SELL', tick.last_price)}>SELL</button>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Off-hours/Unavailable</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Engine */}
        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <Cpu size={20} color="var(--accent-blue)" />
            <h3>AI Reasoning Engine</h3>
          </div>
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', borderLeft: '4px solid var(--accent-blue)', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
              Last Decision: {agentStatus === 'ON' ? 'Analyzing...' : 'Standby'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {agentStatus === 'ON'
                ? 'DeepSeek is scanning NSE:RELIANCE for entry signals based on RSI and MACD divergence.'
                : 'Agent is inactive. Start agent to enable AI reasoning.'}
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
    );
  };

  // ─── ORDERS TAB ─────────────────────────────────────────
  const OrdersTab = () => {
    const handleOrderSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setOrderLoading(true);
      setOrderStatus(null);
      try {
        const payload: any = {
          variety: orderForm.variety,
          exchange: orderForm.exchange,
          symbol: orderForm.tradingsymbol, // Backend expects 'symbol'
          transaction_type: orderForm.transaction_type,
          quantity: Number(orderForm.quantity),
          product: orderForm.product,
          order_type: orderForm.order_type,
          validity: orderForm.validity,
        };
        if (orderForm.order_type !== 'MARKET') payload.price = Number(orderForm.price);
        if (orderForm.order_type === 'SL' || orderForm.order_type === 'SL-M') payload.trigger_price = Number(orderForm.trigger_price);
        if (orderForm.disclosed_quantity) payload.disclosed_quantity = Number(orderForm.disclosed_quantity);

        // Execute trade to backend route
        const res = await axios.post(`/api/trade/execute`, payload);

        setOrderStatus({ msg: `✅ ${res.data.message} | Order ID: ${res.data.order_id || 'OK'}`, type: 'success' });
      } catch (err: any) {
        setOrderStatus({ msg: `❌ ${err.response?.data?.detail || 'Order failed. Check backend logs.'}`, type: 'error' });
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
                <div style={{
                  padding: '0.9rem 1.2rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: 600,
                  background: orderStatus.type === 'success' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)',
                  color: orderStatus.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${orderStatus.type === 'success' ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}`
                }}>{orderStatus.msg}</div>
              )}
              <form onSubmit={handleOrderSubmit}>
                <div className="order-grid">
                  {(['variety', 'exchange', 'transaction_type', 'order_type', 'product', 'validity'] as const).map(key => {
                    const options: Record<string, string[]> = {
                      variety: ['regular', 'co', 'amo', 'iceberg', 'auction'],
                      exchange: ['NSE', 'BSE', 'NFO', 'MCX', 'BFO', 'CDS'],
                      transaction_type: ['BUY', 'SELL'],
                      order_type: ['MARKET', 'LIMIT', 'SL', 'SL-M'],
                      product: ['CNC', 'MIS', 'NRML', 'MTF'],
                      validity: ['DAY', 'IOC', 'TTL'],
                    };
                    return (
                      <div className="order-field" key={key}>
                        <label className="order-label">{key.replace(/_/g, ' ').toUpperCase()}</label>
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
                  {(orderForm.order_type === 'SL' || orderForm.order_type === 'SL-M') && (
                    <div className="order-field">
                      <label className="order-label">TRIGGER PRICE</label>
                      <input className="order-input" type="number" step="0.05" value={orderForm.trigger_price}
                        onChange={e => setOrderForm(f => ({ ...f, trigger_price: e.target.value }))} required />
                    </div>
                  )}
                  <div className="order-field">
                    <label className="order-label">DISCLOSED QUANTITY</label>
                    <input className="order-input" type="number" min={0} value={orderForm.disclosed_quantity} placeholder="Optional"
                      onChange={e => setOrderForm(f => ({ ...f, disclosed_quantity: e.target.value }))} />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={orderLoading}
                  style={{
                    width: '100%', marginTop: '2rem', padding: '1rem', fontSize: '1.05rem',
                    backgroundColor: orderForm.transaction_type === 'BUY' ? '#f59e0b' : 'var(--accent-red)',
                    justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px',
                    opacity: orderLoading ? 0.7 : 1
                  }}>
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
  // ─── HOLDINGS TAB ────────────────────────────────────────────
  const HoldingsTab = () => {
    const holdings: any[] = portfolio.holdings || [];

    const totalInvested = holdings.reduce((s: number, h: any) => s + ((h.average_price || 0) * (h.quantity || 0)), 0);
    const totalCurrent = holdings.reduce((s: number, h: any) => s + ((h.last_price || 0) * (h.quantity || 0)), 0);
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested ? (totalPnl / totalInvested) * 100 : 0;
    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Holdings</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Stocks currently held in your demat account</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {holdings.length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total P&L</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
                <p style={{ fontSize: '0.85rem', color: totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                  {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
                </p>
              </div>
            )}
            <button onClick={fetchPortfolio} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
        {!brokerConnected ? (
          <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>
            <Wallet size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem' }} />
            <h3>Not Connected</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Connect your Zerodha account to view your holdings.</p>
          </div>
        ) : holdings.length === 0 ? (
          <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>
            <Package size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem' }} />
            <h3>No Holdings</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>You don't have any equity holdings in your demat account.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card glass"><p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Invested</p><h3 style={{ fontSize: '1.4rem', marginTop: '6px' }}>₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3></div>
              <div className="card glass"><p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Current Value</p><h3 style={{ fontSize: '1.4rem', marginTop: '6px' }}>₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3></div>
              <div className="card glass"><p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Holdings</p><h3 style={{ fontSize: '1.4rem', marginTop: '6px' }}>{holdings.length} stocks</h3></div>
            </div>
            <div className="card glass" style={{ overflow: 'hidden', padding: 0 }}>
              <div className="holdings-header">
                <span>Symbol</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Avg Price</span><span style={{ textAlign: 'right' }}>LTP</span><span style={{ textAlign: 'right' }}>Invested</span><span style={{ textAlign: 'right' }}>Current</span><span style={{ textAlign: 'right' }}>P&L</span>
              </div>
              {holdings.map((h: any) => {
                const invested = (h.average_price || 0) * (h.quantity || 0);
                const current = (h.last_price || 0) * (h.quantity || 0);
                const pnl = current - invested;
                const pnlPct = invested ? (pnl / invested) * 100 : 0;
                const isUp = pnl >= 0;
                return (
                  <div key={h.tradingsymbol} className="holdings-row">
                    <div>
                      <p style={{ fontWeight: 700 }}>
                        {h.tradingsymbol}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{h.exchange}</p>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{h.quantity}</div>
                    <div style={{ textAlign: 'right' }}>₹{(h.average_price || 0).toFixed(2)}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700 }}>₹{(h.last_price || 0).toFixed(2)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>₹{invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <div style={{ textAlign: 'right' }}>₹{current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <div style={{ textAlign: 'right', color: isUp ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                      {isUp ? '+' : ''}₹{pnl.toFixed(0)}<br />
                      <span style={{ fontSize: '0.75rem' }}>{isUp ? '+' : ''}{pnlPct.toFixed(2)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── POSITIONS TAB ────────────────────────────────────────────
  const PositionsTab = () => {
    const positionsData = portfolio.positions || {};
    const netPositions: any[] = Array.isArray(positionsData) ? positionsData : (positionsData.net || []);
    const dayPositions: any[] = Array.isArray(positionsData) ? [] : (positionsData.day || []);
    const totalM2M = netPositions.reduce((s: number, p: any) => s + (p.m2m || p.pnl || 0), 0);
    const totalUnrealised = netPositions.reduce((s: number, p: any) => s + (p.unrealised || 0), 0);
    const totalRealised = netPositions.reduce((s: number, p: any) => s + (p.realised || 0), 0);
    const displayPositions = posView === 'net' ? netPositions : dayPositions;

    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Positions</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Open intraday & delivery positions for today</p>
          </div>
          <button onClick={fetchPortfolio} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total M2M</p>
            <h3 style={{ fontSize: '1.4rem', marginTop: '6px', color: totalM2M >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {totalM2M >= 0 ? '+' : ''}₹{totalM2M.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Unrealised</p>
            <h3 style={{ fontSize: '1.4rem', marginTop: '6px', color: totalUnrealised >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {totalUnrealised >= 0 ? '+' : ''}₹{totalUnrealised.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Realised</p>
            <h3 style={{ fontSize: '1.4rem', marginTop: '6px', color: totalRealised >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {totalRealised >= 0 ? '+' : ''}₹{totalRealised.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="card glass">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Open Positions</p>
            <h3 style={{ fontSize: '1.4rem', marginTop: '6px' }}>{netPositions.length}</h3>
          </div>
        </div>

        {/* Net / Day toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {(['net', 'day'] as const).map(v => (
            <button key={v} onClick={() => setPosView(v)} style={{
              padding: '0.4rem 1.2rem', borderRadius: '20px', border: '1.5px solid',
              borderColor: posView === v ? 'var(--accent-blue)' : 'var(--border)',
              background: posView === v ? 'rgba(37,99,235,0.1)' : 'transparent',
              color: posView === v ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', textTransform: 'uppercase'
            }}>{v}</button>
          ))}
          <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '2' }}>
            {displayPositions.length} position{displayPositions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {!brokerConnected ? (
          <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>
            <Activity size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem' }} />
            <h3>Not Connected</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Connect your Zerodha account to view positions.</p>
          </div>
        ) : displayPositions.length === 0 ? (
          <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>
            <Activity size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem' }} />
            <h3>No {posView === 'net' ? 'Net' : 'Day'} Positions</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No open {posView} positions for today.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayPositions.map((p: any, i: number) => {
              const pnl = p.m2m || p.pnl || 0;
              const isUp = pnl >= 0;
              return (
                <div 
                  key={`${p.tradingsymbol}-${p.product}-${i}`} 
                  className="card glass chart-clickable-card" 
                  style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onClick={() => openChart(p)}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{p.tradingsymbol}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '4px' }}>{p.exchange}</span>
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 700,
                        color: p.product === 'CNC' ? 'var(--accent-blue)' : '#f59e0b',
                        background: p.product === 'CNC' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                        padding: '2px 10px', borderRadius: '20px',
                        border: `1px solid ${p.product === 'CNC' ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)'}`
                      }}>{p.product}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '1.1rem', fontWeight: 800, color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {isUp ? '+' : ''}₹{pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>M2M P&L</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                    {[
                      ['Qty', p.quantity],
                      ['Buy Qty', p.buy_quantity],
                      ['Sell Qty', p.sell_quantity],
                      ['Avg Price', `₹${(p.average_price || 0).toFixed(2)}`],
                      ['LTP', `₹${(p.last_price || 0).toFixed(2)}`],
                      ['Buy Value', `₹${(p.buy_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
                      ['Sell Value', `₹${(p.sell_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`],
                      ['Realised', `₹${(p.realised || 0).toFixed(2)}`],
                      ['Unrealised', `₹${(p.unrealised || 0).toFixed(2)}`],
                    ].map(([label, val]) => (
                      <div key={String(label)}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</p>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '2px' }}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chart Modal Overlay */}
        {selectedChartPosition && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
          }}>
            <div className="card glass fade-in" style={{ width: '100%', maxWidth: '900px', position: 'relative', padding: '2rem' }}>
              <button 
                onClick={() => setSelectedChartPosition(null)}
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.4rem', cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                <X size={20} />
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <LineChart size={28} color="var(--accent-blue)" />
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedChartPosition.tradingsymbol}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedChartPosition.exchange} • 15 Minute Interval (5 Days)</p>
                </div>
              </div>

              {chartLoading ? (
                <div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                  <RefreshCw className="spin" size={32} color="var(--text-secondary)" />
                  <p style={{ color: 'var(--text-secondary)' }}>Loading historical data...</p>
                </div>
              ) : chartError ? (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-red)', textAlign: 'center', padding: '2rem' }}>
                  <p><strong>Error:</strong> {chartError}</p>
                </div>
              ) : (
                <CandlestickChart data={chartData} />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <TrendingUp size={28} color="var(--accent-blue)" />
          <span>SMART TRADE</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <p className="sidebar-nav-label">MAIN</p>
          <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <User size={18} /> My Profile
          </button>
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Activity size={18} /> Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'holdings' ? 'active' : ''}`} onClick={() => setActiveTab('holdings')}>
            <Wallet size={18} /> Holdings
          </button>
          <button className={`nav-item ${activeTab === 'positions' ? 'active' : ''}`} onClick={() => setActiveTab('positions')}>
            <Activity size={18} /> Positions
          </button>
          <p className="sidebar-nav-label" style={{ marginTop: '0.75rem' }}>TRADING</p>
          <button className={`nav-item ${activeTab === 'place_order' ? 'active' : ''}`} onClick={() => setActiveTab('place_order')}>
            <ShoppingCart size={18} /> Place Order
          </button>
          <button className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            <History size={18} /> Orders
          </button>
          <p className="sidebar-nav-label" style={{ marginTop: '0.75rem' }}>TOOLS</p>
          <button className={`nav-item ${activeTab === 'risk' ? 'active' : ''}`} onClick={() => setActiveTab('risk')}>
            <Shield size={18} /> Risk Manager
          </button>
        </nav>

        {/* Broker connect widget */}
        <div className="sidebar-broker">
          <p className="sidebar-broker-label">Broker</p>
          <span className={`status-badge ${brokerConnected ? 'status-online' : 'status-offline'}`} style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
            {brokerConnected ? 'Connected' : 'Not Connected'}
          </span>
          {!brokerConnected && (
            <button onClick={handleZerodhaLogin} disabled={isConnecting} className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.6rem 1rem', opacity: isConnecting ? 0.7 : 1 }}>
              {isConnecting ? 'Connecting...' : <><ExternalLink size={13} /> Connect Kite</>}
            </button>
          )}
          {profile && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Logged in as <strong>{profile.user_shortname}</strong>
            </p>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="sidebar-main">
        {error && (
          <div style={{ background: 'var(--accent-red)', color: 'white', padding: '8px', textAlign: 'center', fontSize: '0.9rem' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="sidebar-content fade-in" key={activeTab}>
          {activeTab === 'dashboard' && DashboardTab()}
          {activeTab === 'profile' && ProfileTab()}
          {activeTab === 'place_order' && OrdersTab()}
          {activeTab === 'holdings' && HoldingsTab()}
          {activeTab === 'positions' && PositionsTab()}

          {activeTab === 'orders' && (() => {
            const statusColor: Record<string, string> = {
              COMPLETE: 'var(--accent-green)',
              REJECTED: 'var(--accent-red)',
              CANCELLED: 'var(--text-secondary)',
              OPEN: 'var(--accent-blue)',
              PENDING: '#f59e0b',
              TRIGGER_PENDING: '#f59e0b',
            };
            const statuses = ['ALL', 'COMPLETE', 'OPEN', 'REJECTED', 'CANCELLED'];
            const displayed = histFilter === 'ALL' ? historyOrders : historyOrders.filter(o => o.status === histFilter);

            return (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Orders</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Orders for the day from Zerodha</p>
                  </div>
                  <button onClick={() => { setHistLoading(true); axios.get('/api/trade/orders').then(r => setHistoryOrders(r.data.orders || [])).finally(() => setHistLoading(false)); }}
                    className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: histLoading ? 0.7 : 1 }}>
                    <RefreshCw size={14} className={histLoading ? 'spin' : ''} /> Refresh
                  </button>
                </div>

                {/* Status filter */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {statuses.map(s => (
                    <button key={s} onClick={() => setHistFilter(s)} style={{
                      padding: '0.4rem 0.9rem', borderRadius: '20px', border: '1.5px solid',
                      borderColor: histFilter === s ? 'var(--accent-blue)' : 'var(--border)',
                      background: histFilter === s ? 'rgba(37,99,235,0.1)' : 'transparent',
                      color: histFilter === s ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer'
                    }}>{s}</button>
                  ))}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '2' }}>{displayed.length} order{displayed.length !== 1 ? 's' : ''}</span>
                </div>

                {!brokerConnected ? (
                  <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>
                    <History size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem' }} />
                    <h3>Not Connected</h3>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Connect your Zerodha account to view orders.</p>
                  </div>
                ) : histLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
                    <p>Loading orders...</p>
                  </div>
                ) : displayed.length === 0 ? (
                  <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>
                    <History size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem' }} />
                    <h3>No Orders</h3>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No {histFilter !== 'ALL' ? histFilter.toLowerCase() + ' ' : ''}orders found for today.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {displayed.map((o: any, i: number) => (
                      <div key={o.order_id || i} className="card glass" style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{o.tradingsymbol}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '4px' }}>{o.exchange}</span>
                            <span style={{
                              fontSize: '0.78rem', fontWeight: 700, color: o.transaction_type === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)',
                              background: o.transaction_type === 'BUY' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)',
                              padding: '2px 10px', borderRadius: '20px', border: `1px solid ${o.transaction_type === 'BUY' ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}`
                            }}>
                              {o.transaction_type}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{o.variety} · {o.order_type} · {o.product}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              fontWeight: 700, fontSize: '0.82rem', padding: '3px 10px', borderRadius: '20px',
                              color: statusColor[o.status] || 'var(--text-secondary)',
                              background: `${statusColor[o.status] || 'var(--text-secondary)'}18`,
                              border: `1px solid ${statusColor[o.status] || 'var(--border)'}40`
                            }}>
                              {o.status}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                          {[
                            ['Order ID', o.order_id?.slice(-8)],
                            ['Qty', o.quantity],
                            ['Filled', o.filled_quantity],
                            ['Pending', o.pending_quantity],
                            ['Price', o.price ? `₹${o.price}` : 'MARKET'],
                            ['Avg Price', o.average_price ? `₹${o.average_price}` : '—'],
                            ['Validity', o.validity + (o.validity_ttl ? ` (${o.validity_ttl}m)` : '')],
                            ['Time', o.order_timestamp ? new Date(o.order_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'],
                          ].map(([label, val]) => (
                            <div key={String(label)}>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</p>
                              <p style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '2px' }}>{val}</p>
                            </div>
                          ))}
                        </div>

                        {o.status_message && o.status !== 'COMPLETE' && (
                          <div style={{
                            marginTop: '0.75rem', padding: '0.6rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem',
                            background: 'rgba(220,38,38,0.06)', color: 'var(--accent-red)', borderLeft: '3px solid var(--accent-red)'
                          }}>
                            {o.status_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === 'risk' && (
            <div className="fade-in">
              <RiskManager 
                totalM2M={portfolio.positions?.net?.reduce((sum: number, p: any) => sum + (p.m2m || p.pnl || 0), 0) || 0}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
