from fastapi import APIRouter, Query
import yfinance as yf
from yahooquery import search as yq_search
import logging
import time
import math
import threading
import asyncio
from backend.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)
router = APIRouter()

# ── DEFAULT WATCHLIST ──────────────────────────────────────────────────────────
# We use Yahoo Finance instead of Zerodha here so we can show live stock
# prices without needing the paid 'Market Quotes' API permission on Zerodha.
DEFAULT_WATCHLIST = {
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "INFY": "INFY.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "SBIN": "SBIN.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "WIPRO": "WIPRO.NS",
    "AXISBANK": "AXISBANK.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
    "ITC": "ITC.NS",
}

# Cache real-time prices to avoid spamming the Yahoo Finance API and getting banned
cache = {
    "data": [],
    "last_updated": 0,
    "lock": threading.Lock()
}

def clean_float(val):
    """Safely convert pandas/numpy floats to standard float. Returns 0.0 if NaN."""
    try:
        f = float(val)
        return 0.0 if math.isnan(f) else f
    except:
        return 0.0

@router.get("/watchlist")
def get_watchlist_prices():
    """
    Returns current LTP and OHLC for the watchlist stocks using Yahoo Finance (yfinance).
    This bypasses Zerodha's paid API quotas and permissions completely.
    Using standard 'def' instead of 'async def' so fastapi runs this blocking code in a thread pool.
    """
    try:
        current_time = time.time()
        
        with cache["lock"]:
            # If we recently fetched the data (within last 3 seconds), return cached data
            if current_time - cache["last_updated"] < 3 and cache["data"]:
                return {"status": "success", "items": cache["data"]}
            
        items = []
        tickers_str = " ".join(DEFAULT_WATCHLIST.values())
        
        # Download last 5 days of data to get today's live OHLC + yesterday's close
        df = yf.download(tickers_str, period="5d", progress=False)

        for symbol, yf_sym in DEFAULT_WATCHLIST.items():
            try:
                # If only one ticker, df columns handles it differently
                if len(DEFAULT_WATCHLIST) == 1:
                    s_close = df["Close"]
                    s_open = df["Open"]
                    s_high = df["High"]
                    s_low = df["Low"]
                else:
                    s_close = df["Close"][yf_sym]
                    s_open = df["Open"][yf_sym]
                    s_high = df["High"][yf_sym]
                    s_low = df["Low"][yf_sym]
                
                last_price = clean_float(s_close.iloc[-1])
                prev_close = clean_float(s_close.iloc[-2]) if len(s_close) > 1 else last_price
                
                open_price = clean_float(s_open.iloc[-1])
                high_price = clean_float(s_high.iloc[-1])
                low_price = clean_float(s_low.iloc[-1])
                
                change = last_price - prev_close
                change_pct = (change / prev_close) * 100 if prev_close else 0

                items.append({
                    "symbol": symbol,
                    "exchange": "NSE",
                    "last_price": round(last_price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "ohlc": {
                        "open": round(open_price, 2),
                        "high": round(high_price, 2),
                        "low": round(low_price, 2),
                        "close": round(last_price, 2)
                    }
                })
            except Exception as e:
                logger.warning(f"Could not parse yfinance data for {symbol}: {e}")
                
        # Update cache
        if items:
            with cache["lock"]:
                cache["data"] = items
                cache["last_updated"] = current_time
            return {"status": "success", "items": items}
        else:
            return {"status": "error", "items": cache.get("data", [])}

    except Exception as e:
        logger.error(f"Watchlist poll error: {e}")
        # Return fallback cache on error so frontend doesn't break
        return {"error": str(e), "items": cache.get("data", [])}

@router.get("/search")
def search_stocks(q: str = Query(..., description="Company name or symbol to search for")):
    """
    Search for stocks by name and instantly fetch their live price for immediate trading.
    Uses Yahoo Finance search, prioritizing Indian exchanges (.NS and .BO).
    """
    try:
        # Search using yahooquery
        raw_results = yq_search(q)
        quotes = raw_results.get("quotes", [])
        
        # Filter for only Indian stocks (NSE or BSE) to keep results relevant for Zerodha
        indian_stocks = [
            stk for stk in quotes 
            if stk.get("exchange") in ["NSI", "BSE"] and (stk.get("symbol", "").endswith(".NS") or stk.get("symbol", "").endswith(".BO"))
        ]
        
        if not indian_stocks:
            return {"status": "success", "results": []}

        # Take the top 5 relevant Indian search results
        top_5 = indian_stocks[:5]
        
        # Build symbols to fetch live prices natively
        symbols = [stk["symbol"] for stk in top_5]
        df = yf.download(" ".join(symbols), period="5d", progress=False)

        results = []
        for stk in top_5:
            yf_sym = stk["symbol"]
            # Clean .NS or .BO off the symbol string so it perfectly matches Zerodha's expectations!
            zerodha_symbol = yf_sym.replace(".NS", "").replace(".BO", "")
            
            # Extract live price data elegantly
            try:
                if len(symbols) == 1:
                    s_close = df["Close"]
                    s_open = df["Open"]
                else:
                    s_close = df["Close"][yf_sym]
                    s_open = df["Open"][yf_sym]
                    
                last_price = clean_float(s_close.iloc[-1])
                prev_close = clean_float(s_close.iloc[-2]) if len(s_close) > 1 else last_price
                change = last_price - prev_close
                change_pct = (change / prev_close) * 100 if prev_close else 0
                
            except Exception:
                # If we couldn't fetch live price, still return the search result but zero out the price
                last_price = 0.0
                change = 0.0
                change_pct = 0.0
                
            results.append({
                "symbol": zerodha_symbol,
                "exchange": "NSE" if yf_sym.endswith(".NS") else "BSE",
                "name": stk.get("longname") or stk.get("shortname", ""),
                "last_price": round(last_price, 2),
                "change": round(change, 2),
                "change_pct": round(change_pct, 2)
            })
            
        return {"status": "success", "results": results}
        
    except Exception as e:
        logger.error(f"Search API Error: {e}")
        return {"status": "error", "message": str(e), "results": []}

@router.get("/historical/{symbol}")
def get_historical(symbol: str, interval: str = "15minute"):
    """Fetch historical candle data cleanly using free Yahoo Finance API."""
    try:
        yf_sym = f"{symbol}.NS"
        yf_interval = "15m" if interval == "15minute" else "1d"
        yf_period = "5d" if interval == "15minute" else "3mo"
        
        df = yf.download(yf_sym, period=yf_period, interval=yf_interval, progress=False)
        
        if df.empty:
            return {"status": "success", "candles": []}
            
        candles = []
        for idx, row in df.iterrows():
            try:
                # Handle different yfinance version outputs gracefully
                if isinstance(row.get("Open"), (int, float)):
                    c_open, c_high, c_low, c_close = row["Open"], row["High"], row["Low"], row["Close"]
                    c_vol = row.get("Volume", 0)
                else:
                    c_open, c_high, c_low, c_close = row["Open"].iloc[0], row["High"].iloc[0], row["Low"].iloc[0], row["Close"].iloc[0]
                    c_vol = row["Volume"].iloc[0] if "Volume" in row else 0
                    
                timestamp = idx.isoformat()
                candles.append([timestamp, float(c_open), float(c_high), float(c_low), float(c_close), int(c_vol)])
            except Exception:
                continue
                
        return {"status": "success", "candles": candles}
        
    except Exception as e:
        logger.error(f"Historical API Error: {e}")
        return {"status": "error", "message": str(e), "candles": []}


@router.get("/analyze/{symbol}")
async def analyze_stock_with_ai(symbol: str, source: str = "positions"):
    """
    Fetch recent candle data for a symbol and ask Ollama (DeepSeek) for a
    detailed, noobie-friendly stock analysis. Returns the AI narrative as plain text.
    """
    try:
        # 1. Fetch fresh 5-day 15-min candle data
        yf_sym = f"{symbol}.NS"
        df = yf.download(yf_sym, period="5d", interval="15m", progress=False)

        if df.empty:
            return {"status": "error", "message": f"No candle data available for {symbol}"}

        # 2. Build summary statistics from the candles
        closes, highs, lows, vols = [], [], [], []
        for idx, row in df.iterrows():
            try:
                if isinstance(row.get("Open"), (int, float)):
                    closes.append(float(row["Close"]))
                    highs.append(float(row["High"]))
                    lows.append(float(row["Low"]))
                    vols.append(int(row.get("Volume", 0)))
                else:
                    closes.append(float(row["Close"].iloc[0]))
                    highs.append(float(row["High"].iloc[0]))
                    lows.append(float(row["Low"].iloc[0]))
                    vols.append(int(row["Volume"].iloc[0]) if "Volume" in row else 0)
            except Exception:
                continue

        if len(closes) < 5:
            return {"status": "error", "message": "Insufficient candle data for analysis"}

        first, last     = closes[0], closes[-1]
        hi5, lo5        = max(highs), min(lows)
        avg_vol         = sum(vols) / max(len(vols), 1)
        last_vol        = vols[-1] if vols else 0
        pct_change      = ((last - first) / first) * 100 if first else 0
        volatility_pct  = ((hi5 - lo5) / last) * 100 if last else 0
        half            = len(closes) // 2
        first_half_avg  = sum(closes[:half]) / max(half, 1)
        second_half_avg = sum(closes[half:]) / max(len(closes) - half, 1)
        momentum        = second_half_avg - first_half_avg
        context         = "long-term holding (demat account)" if source == "holdings" else "short-term intraday trading position"

        # 3. Build a thorough, structured prompt for Ollama
        prompt = f"""
You are an expert Indian stock market analyst and educator who specialises in explaining things to beginner traders.

The user is looking at a 5-day 15-minute candlestick chart for the NSE stock: {symbol}.
They hold this stock as a {context}.

Here is the quantitative data:
- 5-Day Price Change: {pct_change:+.2f}%
- Starting Price (5 days ago): ₹{first:.2f}
- Current (Latest) Price: ₹{last:.2f}
- 5-Day High: ₹{hi5:.2f}
- 5-Day Low: ₹{lo5:.2f}
- Price Volatility Range: {volatility_pct:.1f}% of current price
- Momentum (2nd half avg vs 1st half avg of 5 days): {momentum:+.2f} (positive = accelerating up, negative = accelerating down)
- Last Session Volume: {last_vol:,}
- Average Volume (5 days): {avg_vol:,.0f}
- Volume Ratio (last vs avg): {last_vol/avg_vol:.1f}x
- Total Candles Analysed: {len(closes)}

Write a detailed, clear, beginner-friendly analysis in PLAIN TEXT (NO JSON, NO markdown). Structure it in these sections:

1. **What the chart is telling us** (2-3 sentences about the overall trend)
2. **Key price levels** (mention the high, low, and current price and what they mean)
3. **Momentum & Volume insight** (what the volume and momentum say about buyer/seller interest)
4. **Risk assessment** (what risks should the beginner be aware of)
5. **What should I do?** (practical advice for a beginner holding this as a {context}. Be specific and actionable)

Speak in a friendly, educational tone. Use simple language. Avoid jargon. Each section should be 2-4 sentences.
Do NOT return JSON. Return only plain narrative text.
"""

        # 4. Call Ollama in plain-text mode (no JSON format)
        import ollama as _ollama
        response = await asyncio.to_thread(
            _ollama.generate,
            model=ollama_service.model,
            prompt=prompt
        )
        analysis_text = response.get("response", "").strip()

        if not analysis_text:
            return {"status": "error", "message": "AI returned an empty response."}

        return {"status": "success", "symbol": symbol, "analysis": analysis_text}

    except Exception as e:
        logger.error(f"AI Analyze Error for {symbol}: {e}")
        return {"status": "error", "message": str(e)}

