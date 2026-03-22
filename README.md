# WiseTrade AI Trading Platform

WiseTrade is an advanced, AI-driven stock trading platform designed to automate market analysis, identify high-probability setups, and manage portfolio risk intelligently.

## 🚀 Key Features

### 1. Dual-Core AI Agent
The foundation of WiseTrade is its background AI Agent that constantly looks for both short-term momentum opportunities and long-term fundamental plays.

*   **Penny Stock Screener (Manual Scan)**: Focuses on picking up volatile penny stocks (< ₹100). Scans specific stocks utilizing 15-minute intraday chart intervals to calculate dynamic volume surges and momentum indicators, returning instant, actionable `BUY` setups.
*   **Autonomous Scheduler (Background Scan)**: Every 60 seconds, the AI autonomously evaluates large-cap symbols. 
    *   **Technical Engine**: Calculates RSI, MACD, and price movement.
    *   **News Catalyst Engine**: Scrapes live BSE corporate announcements and pipes them into a Local LLM (DeepSeek via Ollama) to interpret sentiment.
    *   **Social Media Engine**: Scrapes Twitter/X for relevant stock `$cashtags` and analyzes the public sentiment for potential breakouts.

### 2. Auto-Approve & Hands-Free Execution
The Agent Tab features an **"Auto-Approve Trades"** mode.
*   **Approval Mode (Default)**: The AI queues up its findings as readable "Proposal Cards" on your dashboard. Every proposal includes the entry price, target, stop-loss, and the *exact AI reasoning* for why the stock was chosen (e.g., "AI Technical Insight: Strong Signal" or "Twitter Sentiment: Positive").
*   **Auto-Approve Mode**: By flipping the toggle, the AI bypasses the approval queue and **automatically executes** the trade with your broker instantly.

### 3. Live Position & Risk Monitor
Once a position is opened, you do not need to babysit it. The background Position Monitor scans your open broker positions every 30 seconds.
*   If your pre-calculated **Target Profit** or **Stop-Loss** limits are hit, the system generates a `SELL` order.
*   If *Auto-Approve* is turned on, it instantly fires the trade to the broker to lock in your profits or cut your losses without manual intervention.

### 4. After-Market Order (AMO) Intelligence
The entire platform is aware of Indian Stock Market hours (9:15 AM - 3:30 PM IST). 
If the AI detects massive news or social media surges late at night, or if you run a manual market scan on the weekend, the backend automatically flags those findings with an `AMO` tag and queues them as After-Market LIMIT orders ready to execute precisely when the market opens next.

## ⚙️ Getting Started

### Prerequisites
*   Python 3.12+
*   Node.js v18+
*   [Ollama](https://ollama.ai/) installed locally with the `deepseek-r1:1.5b` model downloaded (`ollama run deepseek-r1:1.5b`).

### Installation & Running the App

The easiest way to start the platform is utilizing the provided batch file, which will automatically download python requirements, node modules, start the FastAPI backend, and boot up the Vite frontend server:

```bash
./run_smart_trade.bat
```

Once running:
*   **Frontend**: Navigate to `http://localhost:5173`
*   **Backend API**: `http://localhost:8000`

### Connecting Your Broker
1. Ensure your `.env` contains the proper Zerodha API keys.
2. Log into the web interface and complete the broker authentication flow to generate your daily access token. You must be connected to execute trades.

---
*Built for autonomous equity analysis and intelligent portfolio automation.*
