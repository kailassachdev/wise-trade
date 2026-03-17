import ollama
import json
from typing import Dict, Any, Optional

class OllamaService:
    def __init__(self, model: str = "deepseek-v3.1:671b-cloud"):
        self.model = model

    async def generate_decision(self, prompt: str) -> Dict[str, Any]:
        """
        Sends a structured prompt to Ollama and enforces strict JSON response.
        """
        try:
            response = ollama.generate(
                model=self.model,
                prompt=prompt,
                format="json"
            )
            
            # Parse the response content
            content = response.get('response', '')
            try:
                decision = json.loads(content)
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
            response = ollama.generate(
                model=self.model,
                prompt=prompt,
                format="json"
            )
            return response.get('response', '{}')
        except Exception as e:
            return json.dumps({"error": str(e)})

ollama_service = OllamaService()
