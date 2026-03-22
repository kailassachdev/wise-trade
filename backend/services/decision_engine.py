from .ollama_service import ollama_service
from .indicator_service import indicator_service
from .news_service import news_service
from .twitter_service import twitter_service
from .agent_service import agent_service
from .screener_service import get_order_params
from typing import Dict, Any, List, Optional
import pandas as pd
import logging
import asyncio

logger = logging.getLogger(__name__)

class DecisionEngine:
    async def get_decision(self, market_data: pd.DataFrame, user_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Flow: Indicators -> Deterministic Filter -> Optional LLM -> Risk Check
        """
        # 1. Calculate Indicators
        indicators = await asyncio.to_thread(indicator_service.get_all_indicators, market_data)
        
        # 2. Skip Deterministic Filter as requested — Use LLM Model
        # (Pass the indicators directly to DeepSeek)

        # 3. LLM Call (DeepSeek via Ollama)
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
        announcements = await asyncio.to_thread(news_service.get_latest_announcements)
        
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
                sym = order_params.get("tradingsymbol", "UNKNOWN")
                
                # Fetch recent ltp or put a placeholder price
                # For a real app, query market snapshot. Assuming 0 for now so order_params can handle it
                price = order_params.get("price", 0) 
                
                pid = agent_service.add_proposal({
                    "symbol": sym,
                    "action": action,
                    "price": price,
                    "qty": order_params.get("quantity", 1),
                    "target": None,
                    "stop_loss": None,
                    "score": confidence,
                    "reason": f"News Catalyst: {ann.get('NEWSSUB', 'N/A')[:100]}",
                    "variety": "regular",
                    "order_type": order_params.get("order_type", "MARKET"),
                    "limit_price": price,
                    "exchange": order_params.get("exchange", "BSE"),
                    "product": order_params.get("product", "CNC")
                })
                
                if agent_service.auto_approve:
                    agent_service.auto_approve_proposals([pid])
                
                result["api_response"] = {"status": "proposal_created", "pid": pid}
            
            results.append(result)
            
        return results

    async def process_social_media_and_trade(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """
        Fetch social media data, analyze with LLM, and submit trade requests via backend API.
        """
        results = []
        for symbol in symbols:
            tweets = await asyncio.to_thread(twitter_service.get_stock_mentions, symbol, limit=10)
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
                price = order_params.get("price", 0)
                
                pid = agent_service.add_proposal({
                    "symbol": symbol,
                    "action": action,
                    "price": price,
                    "qty": order_params.get("quantity", 1),
                    "target": None,
                    "stop_loss": None,
                    "score": confidence,
                    "reason": f"Twitter Sentiment: {analysis.get('reason', 'Positive social media sentiment')[:100]}",
                    "variety": "regular",
                    "order_type": order_params.get("order_type", "MARKET"),
                    "limit_price": price,
                    "exchange": order_params.get("exchange", "NSE"),
                    "product": order_params.get("product", "MIS")
                })
                
                if agent_service.auto_approve:
                    agent_service.auto_approve_proposals([pid])
                    
                result["api_response"] = {"status": "proposal_created", "pid": pid}
            
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
        Available Capital: ₹{user_config.get('capital', 10000.0):.2f}
        
        Analyze the market condition carefully. Look aggressively for ANY growth potential or bounce opportunities, even if the market is SIDEWAYS or OVERSOLD. 
        If there is a chance for future price growth or a breakout, you must strongly consider recommending a BUY action.
        Only recommend HOLD if the stock shows zero potential for short-term growth.
        
        You MUST return ONLY valid JSON format with NO markdown wrappers or conversational text:
        {{
            "action": "BUY/SELL/HOLD",
            "confidence": float (0-1),
            "reason": "string explaining exactly why this has growth potential"
        }}
        """

decision_engine = DecisionEngine()

