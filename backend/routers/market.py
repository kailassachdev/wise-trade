from fastapi import APIRouter, Query
import yfinance as yf
from yahooquery import search as yq_search
import logging
import time
import math
import threading

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
