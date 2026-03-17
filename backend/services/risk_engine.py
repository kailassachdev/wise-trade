from typing import Dict, Any

class RiskEngine:
    def __init__(self, 
                 max_allocation_pct: float = 0.1, 
                 daily_loss_limit_pct: float = 0.02,
                 stop_loss_pct: float = 0.015):
        self.max_allocation_pct = max_allocation_pct
        self.daily_loss_limit_pct = daily_loss_limit_pct
        self.stop_loss_pct = stop_loss_pct

    def validate_trade(self, 
                       decision: Dict[str, Any], 
                       margins: Dict[str, Any], 
                       current_positions: list) -> Dict[str, Any]:
        """
        Validates if a trade decision complies with risk constraints.
        """
        if decision["action"] == "HOLD":
            return {"valid": True, "action": "HOLD"}

        # 1. Check daily loss limit
        # (Simplified: logic to fetch today's PnL would go here)
        
        # 2. Check max allocation
        available_cash = margins.get("equity", {}).get("available", {}).get("cash", 0)
        total_equity = margins.get("equity", {}).get("net", 1) # Fallback to 1 to avoid div by zero
        
        # 3. Calculate quantity based on max allocation
        # (This is just a basic calculation)
        last_price = decision.get("indicators", {}).get("last_price", 1)
        max_position_value = total_equity * self.max_allocation_pct
        allocated_value = min(max_position_value, available_cash)
        
        quantity = int(allocated_value // last_price)
        
        if quantity <= 0:
            return {
                "valid": False, 
                "reason": "Insufficient margin or allocation limit reached"
            }

        # 4. Confidence Threshold Check
        if decision["confidence"] < 0.7:
             return {
                "valid": False, 
                "reason": f"Confidence {decision['confidence']} below threshold 0.7"
            }

        return {
            "valid": True,
            "quantity": quantity,
            "stop_loss": last_price * (1 - self.stop_loss_pct if decision["action"] == "BUY" else 1 + self.stop_loss_pct)
        }

risk_engine = RiskEngine()
