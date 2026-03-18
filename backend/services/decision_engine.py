from .ollama_service import ollama_service
from .indicator_service import indicator_service
from .news_service import news_service
from .twitter_service import twitter_service
from .trade_request_service import trade_request_service
from typing import Dict, Any, List, Optional
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class DecisionEngine:
    async def get_decision(self, market_data: pd.DataFrame, user_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Flow: Indicators -> Deterministic Filter -> Optional LLM -> Risk Check
        """
        # 1. Calculate Indicators
        indicators = indicator_service.get_all_indicators(market_data)
        
        # 2. Deterministic Pre-filter (Minimal LLM usage)
        rsi = indicators["rsi"]
        macd = indicators["macd"]
        
        strong_signal = False
        if rsi < 30 or rsi > 70:
            strong_signal = True
        if abs(macd["hist"]) > 0.5:
            strong_signal = True
            
        if not strong_signal:
            return {
                "action": "HOLD",
                "confidence": 0.4,
                "reason": "No strong indicator signal. Skipping LLM for performance."
            }

        # 3. Optional LLM Call (DeepSeek via Ollama)
        prompt = self._build_prompt(indicators, user_config)
        llm_decision = await ollama_service.generate_decision(prompt)
        
        # 4. Integrate indicators into decision record
        llm_decision["indicators"] = indicators
        return llm_decision

    async def process_news_and_trade(self) -> List[Dict[str, Any]]:
        """
        Fetch news, analyze with LLM, and submit trade requests via backend API.
        """
        results = []
        announcements = news_service.get_latest_announcements()
        
        for ann in announcements[:5]:
            news_str = news_service.format_announcement_for_llm(ann)
            analysis = await ollama_service.analyze_news(news_str)
            
            action = analysis.get("action", "HOLD")
            confidence = analysis.get("confidence", 0)
            
            result = {
                "stock": ann.get("SLONGNAME"),
                "headline": ann.get("NEWSSUB"),
                "analysis": analysis
            }
            
            if action in ["BUY", "SELL"] and confidence > 0.7:
                order_params = analysis.get("order_params", {})
                # SECURE: Submit via backend API instead of direct broker call
                api_response = await trade_request_service.submit_trade_request(
                    symbol=order_params.get("tradingsymbol", "UNKNOWN"),
                    transaction_type=order_params.get("transaction_type", action),
                    quantity=order_params.get("quantity", 1),
                    exchange=order_params.get("exchange", "BSE"),
                    product=order_params.get("product", "CNC"),
                    order_type=order_params.get("order_type", "MARKET"),
                    source="news_agent",
                    reason=f"BSE News: {ann.get('NEWSSUB', 'N/A')[:100]}"
                )
                result["api_response"] = api_response
            
            results.append(result)
            
        return results

    async def process_social_media_and_trade(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """
        Fetch social media data, analyze with LLM, and submit trade requests via backend API.
        """
        results = []
        for symbol in symbols:
            tweets = twitter_service.get_stock_mentions(symbol, limit=10)
            if not tweets:
                continue

            analysis = await ollama_service.analyze_social_media(symbol, tweets)
            
            action = analysis.get("action", "HOLD")
            confidence = analysis.get("confidence", 0)
            
            result = {
                "symbol": symbol,
                "source": "Twitter",
                "analysis": analysis
            }
            
            if action in ["BUY", "SELL"] and confidence > 0.8:
                order_params = analysis.get("order_params", {})
                # SECURE: Submit via backend API instead of direct broker call
                api_response = await trade_request_service.submit_trade_request(
                    symbol=symbol,
                    transaction_type=order_params.get("transaction_type", action),
                    quantity=order_params.get("quantity", 1),
                    exchange=order_params.get("exchange", "NSE"),
                    product=order_params.get("product", "MIS"),
                    order_type=order_params.get("order_type", "MARKET"),
                    source="social_agent",
                    reason=analysis.get("reason", "Social media sentiment")[:100]
                )
                result["api_response"] = api_response
            
            results.append(result)
            
        return results

    def _build_prompt(self, indicators: Dict[str, Any], user_config: Dict[str, Any]) -> str:
        return f"""
        Market Data Snapshot:
        RSI: {indicators['rsi']:.2f}
        MACD: {indicators['macd']['macd']:.2f} (Signal: {indicators['macd']['signal']:.2f})
        Regime: {indicators['regime']}
        Current Price: {indicators['last_price']}
        
        User Strategy: {user_config.get('risk_level', 'MEDIUM')} risk
        
        Analyze the market condition and decide: BUY, SELL, or HOLD.
        You MUST return valid JSON format:
        {{
            "action": "BUY/SELL/HOLD",
            "confidence": float (0-1),
            "reason": "string"
        }}
        """

decision_engine = DecisionEngine()

