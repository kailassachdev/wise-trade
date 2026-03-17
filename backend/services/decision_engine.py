from .ollama_service import ollama_service
from .indicator_service import indicator_service
from .broker_service import broker_service
from typing import Dict, Any, Optional
import pandas as pd

class DecisionEngine:
    async def get_decision(self, market_data: pd.DataFrame, user_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Flow: Indicators -> Deterministic Filter -> Optional LLM -> Risk Check
        """
        # 1. Calculate Indicators
        indicators = indicator_service.get_all_indicators(market_data)
        
        # 2. Deterministic Pre-filter (Minimal LLM usage)
        # Only call LLM if RSI is oversold/overbought or MACD crossover exists
        rsi = indicators["rsi"]
        macd = indicators["macd"]
        
        strong_signal = False
        if rsi < 30 or rsi > 70:
            strong_signal = True
        if abs(macd["hist"]) > 0.5: # Arbitrary threshold for crossover strength
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
