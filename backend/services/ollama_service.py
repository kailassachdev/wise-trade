import ollama
import json
from typing import Dict, Any, Optional, List
import asyncio
import re

class OllamaService:
    def __init__(self, model: str = "deepseek-v3.1:671b-cloud"):
        self.model = model

    async def generate_decision(self, prompt: str) -> Dict[str, Any]:
        """
        Sends a structured prompt to Ollama and enforces strict JSON response.
        """
        try:
            print(f"🤖 [Ollama] Querying Technical Data on {self.model}... (Expect delay)")
            response = await asyncio.to_thread(
                ollama.generate,
                model=self.model,
                prompt=prompt,
                format="json"
            )
            
            # Parse the response content
            content = response.get('response', '')
            print(f"🤖 [Ollama] Technical Analysis complete. Payload: {content[:100]}...")
            
            clean_content = self._extract_json(content)
            try:
                decision = json.loads(clean_content)
                # Basic validation of keys
                required_keys = ["action", "confidence", "reason"]
                if all(key in decision for key in required_keys):
                    return decision
                else:
                    return self._fallback_decision("Invalid response structure from LLM")
            except json.JSONDecodeError:
                return self._fallback_decision("Failed to parse LLM JSON output")
                
        except Exception as e:
            print(f"Ollama Error: {e}")
            return self._fallback_decision(str(e))

    def _fallback_decision(self, reason: str) -> Dict[str, Any]:
        return {
            "action": "HOLD",
            "confidence": 0.0,
            "reason": f"Fallback due to error: {reason}"
        }

    def _extract_json(self, text: str) -> str:
        """Extracts JSON block from chatty LLM responses."""
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return match.group(0)
        return text

    async def reflect_on_trades(self, trade_history: str) -> str:
        """
        Analyze past trades for adaptation.
        """
        prompt = f"""
        Analyze the following past trades:
        {trade_history}
        
        What worked? What failed? What should be avoided?
        Provide specific adjustments for risk level and strategy.
        Return your analysis in structured JSON with keys: 'analysis', 'adjustments'.
        """
        try:
            print(f"🤖 [Ollama] Analyzing Trade History on {self.model}...")
            response = await asyncio.to_thread(
                ollama.generate,
                model=self.model,
                prompt=prompt,
                format="json"
            )
            print("🤖 [Ollama] Trade Reflection complete.")
            clean_content = self._extract_json(response.get('response', '{}'))
            return clean_content
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def analyze_news(self, news_content: str) -> Dict[str, Any]:
        """
        Analyze corporate announcements and suggest trading actions.
        """
        prompt = f"""
        You are an expert financial analyst. Analyze the following corporate announcement:
        {news_content}
        
        Decide if this news is Bullish, Bearish, or Neutral for the stock.
        If it's Bullish, suggest a BUY action.
        If it's Bearish, suggest a SELL action.
        If it's Neutral, suggest a HOLD action.
        
        Provide Zerodha Kite compatible parameters for the action.
        Return your response in STRICT JSON format:
        {{
            "action": "BUY/SELL/HOLD",
            "confidence": float (0-1),
            "reason": "short explanation",
            "order_params": {{
                "tradingsymbol": "string (BSESYMBOL if possible, else the short name)",
                "exchange": "BSE",
                "transaction_type": "BUY/SELL",
                "quantity": int (suggested based on confidence),
                "product": "CNC",
                "order_type": "MARKET"
            }}
        }}
        """
        try:
            print(f"🤖 [Ollama] Analyzing corporate news on {self.model}...")
            response = await asyncio.to_thread(
                ollama.generate,
                model=self.model,
                prompt=prompt,
                format="json"
            )
            content = response.get('response', '')
            print(f"🤖 [Ollama] News Analysis complete. Output: {content[:150]}...")
            clean_content = self._extract_json(content)
            return json.loads(clean_content)
        except Exception as e:
            print(f"Ollama News Analysis Error: {e}")
            return self._fallback_decision(str(e))

    async def analyze_social_media(self, symbol: str, tweets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze social media sentiment and provide trading recommendations.
        """
        if not tweets:
            return self._fallback_decision("No tweets found for analysis")

        # Format tweets for the prompt
        tweet_summary = "\n---\n".join([f"User: {t['user']}\nText: {t['text']}" for t in tweets[:10]])
        
        prompt = f"""
        You are an expert social media sentiment analyst for the stock market.
        Analyze the following recent tweets about ${symbol}:
        
        {tweet_summary}
        
        Tasks:
        1. Identify the overall sentiment (Bullish, Bearish, or Neutral).
        2. Detect if there's any significant news or just "noise/hype".
        3. Provide a trading action (BUY, SELL, HOLD).
        
        Return your response in STRICT JSON format:
        {{
            "action": "BUY/SELL/HOLD",
            "confidence": float (0-1),
            "reason": "short explanation of sentiment and source",
            "social_metrics": {{
                "sentiment_score": float (-1 to 1),
                "is_hype": boolean
            }},
            "order_params": {{
                "tradingsymbol": "{symbol}",
                "exchange": "NSE",
                "transaction_type": "BUY/SELL",
                "quantity": 1,
                "product": "MIS",
                "order_type": "MARKET"
            }}
        }}
        """
        try:
            print(f"🤖 [Ollama] Analyzing tweets for ${symbol} on {self.model}...")
            response = await asyncio.to_thread(
                ollama.generate,
                model=self.model,
                prompt=prompt,
                format="json"
            )
            content = response.get('response', '')
            print(f"🤖 [Ollama] Social Media Analysis complete. Sentiment: {content[:150]}...")
            clean_content = self._extract_json(content)
            return json.loads(clean_content)
        except Exception as e:
            print(f"Ollama Social Media Analysis Error: {e}")
            return self._fallback_decision(str(e))

ollama_service = OllamaService()
