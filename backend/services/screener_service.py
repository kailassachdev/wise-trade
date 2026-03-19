"""
Penny Stock Screener Service
Screens NSE stocks using Yahoo Finance for momentum + volume surge signals.
Returns BUY proposals with risk-adjusted position sizing.
"""
import yfinance as yf
import logging
import math
from datetime import datetime, time as dtime

logger = logging.getLogger(__name__)

# Curated NSE penny stock universe (price < ~₹100, decent liquidity)
PENNY_UNIVERSE = [
    "YESBANK", "SUZLON", "GMRINFRA", "RPOWER", "JPPOWER", "IDEA",
    "IRCON", "NHPC", "SJVN", "COALINDIA", "BANKBARODA", "PNB",
    "CANBK", "UNIONBANK", "UCOBANK", "MAHABANK", "CENTRALBK",
    "JBMA", "ALOKINDS", "IFCI", "JSWENERGY", "TATAPOWER",
    "ADANIPOWER", "ADANIGREEN", "TATAMOTORS", "SAIL", "MOIL",
    "NALCO", "HINDALCO", "IDFCFIRSTB", "BANDHANBNK", "SPICEJET",
    "INDIGOPNTS", "ZEEL", "BALRAMCHIN", "DWARIKESH", "SAKTHI",
]

def is_market_open() -> bool:
    """Check if NSE is currently open (Mon-Fri, 9:15-15:30 IST)."""
    now = datetime.now()
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    market_open = dtime(9, 15)
    market_close = dtime(15, 30)
    return market_open <= now.time() <= market_close

def get_order_params(price: float) -> dict:
    """Return order variety/type based on current market hours."""
    if is_market_open():
        return {"variety": "regular", "order_type": "MARKET", "price": 0}
    else:
        return {"variety": "amo", "order_type": "LIMIT", "price": round(price, 2)}

def calculate_quantity(account_balance: float, risk_pct: float, entry: float, sl: float) -> int:
    """Calculate shares to buy such that max loss = risk_amount."""
    risk_amount = account_balance * (risk_pct / 100)
    sl_distance = abs(entry - sl)
    if sl_distance <= 0:
        return 0
    return max(1, math.floor(risk_amount / sl_distance))

def scan_penny_stocks(
    account_balance: float = 100000,
    risk_pct: float = 1.0,
    target_pct: float = 5.0,
    sl_pct: float = 2.0,
    max_proposals: int = 5
) -> list:
    """
    Screen PENNY_UNIVERSE for strong momentum signals.
    Returns a list of proposal dicts sorted by score descending.
    """
    proposals = []
    symbols_yf = [f"{s}.NS" for s in PENNY_UNIVERSE]

    try:
        # Download 5-day / 15-min data for all tickers at once
        df_15m = yf.download(
            " ".join(symbols_yf), period="1d", interval="15m",
            progress=False, group_by="ticker"
        )
        df_1d = yf.download(
            " ".join(symbols_yf), period="11d", interval="1d",
            progress=False, group_by="ticker"
        )
    except Exception as e:
        logger.error(f"Screener download error: {e}")
        return []

    for sym, yf_sym in zip(PENNY_UNIVERSE, symbols_yf):
        try:
            # --- 15-min intraday slice ---
            if len(symbols_yf) > 1:
                close_15 = df_15m[yf_sym]["Close"].dropna() if yf_sym in df_15m.columns.get_level_values(0) else None
                vol_15   = df_15m[yf_sym]["Volume"].dropna() if yf_sym in df_15m.columns.get_level_values(0) else None
                close_1d = df_1d[yf_sym]["Close"].dropna() if yf_sym in df_1d.columns.get_level_values(0) else None
                vol_1d   = df_1d[yf_sym]["Volume"].dropna() if yf_sym in df_1d.columns.get_level_values(0) else None
            else:
                close_15 = df_15m["Close"].dropna()
                vol_15   = df_15m["Volume"].dropna()
                close_1d = df_1d["Close"].dropna()
                vol_1d   = df_1d["Volume"].dropna()

            if close_15 is None or len(close_15) < 3:
                continue
            if close_1d is None or len(close_1d) < 5:
                continue

            price = float(close_15.iloc[-1])
            if price <= 0 or price > 150:  # Only stocks ≤ ₹150
                continue

            # --- Momentum: last 3 candles ---
            momentum = (float(close_15.iloc[-1]) - float(close_15.iloc[-3])) / float(close_15.iloc[-3]) * 100

            # --- Volume surge: today vs 10d avg ---
            avg_vol_10d = float(vol_1d.iloc[:-1].mean()) / 26  # daily avg / ~26 15m candles
            recent_vol  = float(vol_15.iloc[-3:].mean()) if vol_15 is not None and len(vol_15) >= 3 else 0
            vol_ratio   = recent_vol / avg_vol_10d if avg_vol_10d > 0 else 1.0

            # Only consider positive momentum with volume surge
            if momentum < 0.3 or vol_ratio < 1.2:
                continue

            score = momentum * vol_ratio

            sl_price     = round(price * (1 - sl_pct / 100), 2)
            target_price = round(price * (1 + target_pct / 100), 2)
            qty = calculate_quantity(account_balance, risk_pct, price, sl_price)

            order_params = get_order_params(price)

            proposals.append({
                "symbol": sym,
                "action": "BUY",
                "price": round(price, 2),
                "qty": qty,
                "target": target_price,
                "stop_loss": sl_price,
                "score": round(score, 3),
                "momentum_pct": round(momentum, 2),
                "vol_ratio": round(vol_ratio, 2),
                "reason": f"{momentum:.2f}% momentum with {vol_ratio:.1f}x volume surge",
                "variety": order_params["variety"],
                "order_type": order_params["order_type"],
                "limit_price": order_params["price"],
                "exchange": "NSE",
            })

        except Exception as e:
            logger.debug(f"Screener skip {sym}: {e}")
            continue

    proposals.sort(key=lambda x: x["score"], reverse=True)
    return proposals[:max_proposals]
