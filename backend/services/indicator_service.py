import pandas as pd
import numpy as np
from typing import Dict, Any

class IndicatorService:
    @staticmethod
    def calculate_rsi(data: pd.Series, period: int = 14) -> float:
        delta = data.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.iloc[-1]

    @staticmethod
    def calculate_macd(data: pd.Series) -> Dict[str, float]:
        exp1 = data.ewm(span=12, adjust=False).mean()
        exp2 = data.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=9, adjust=False).mean()
        return {
            "macd": macd.iloc[-1],
            "signal": signal.iloc[-1],
            "hist": macd.iloc[-1] - signal.iloc[-1]
        }

    @staticmethod
    def detect_market_regime(data: pd.DataFrame) -> str:
        """
        Classify market as Trending, Sideways, or Volatile.
        """
        # Simple implementation: 
        # Volatile if std dev is high
        # Trending if price is consistently above/below EMA
        # Sideways otherwise
        returns = data['close'].pct_change()
        volatility = returns.std()
        
        ema = data['close'].ewm(span=20).mean()
        diff = data['close'] - ema
        
        if volatility > returns.std() * 1.5:
            return "VOLATILE"
        elif abs(diff.iloc[-1] / data['close'].iloc[-1]) > 0.02:
            return "TRENDING"
        else:
            return "SIDEWAYS"

    def get_all_indicators(self, market_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculates all indicators for a given dataframe.
        """
        close_prices = market_data['close']
        return {
            "rsi": self.calculate_rsi(close_prices),
            "macd": self.calculate_macd(close_prices),
            "regime": self.detect_market_regime(market_data),
            "last_price": close_prices.iloc[-1]
        }

indicator_service = IndicatorService()
