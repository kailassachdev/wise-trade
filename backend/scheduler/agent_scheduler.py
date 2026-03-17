import asyncio
import logging
from ..services.decision_engine import decision_engine
from ..services.broker_service import broker_service
from ..services.risk_engine import risk_engine
from ..services.memory_service import memory_service
import pandas as pd

logger = logging.getLogger(__name__)

class AgentScheduler:
    def __init__(self):
        self.is_running = False
        self.loop_task = None

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.loop_task = asyncio.create_task(self.trading_loop())
        logger.info("Agent Scheduler started.")

    async def stop(self):
        self.is_running = False
        if self.loop_task:
            self.loop_task.cancel()
        logger.info("Agent Scheduler stopped.")

    async def trading_loop(self):
        while self.is_running:
            try:
                # 1. Fetch Market Data (Placeholder - would come from Zerodha WebSocket or API)
                # For high performance, we'd use KiteTicker here.
                # Here we simulate fetching data for one symbol.
                symbol = "RELIANCE"
                # market_data = broker_service.get_historical_data(symbol)
                # Simulated dataframe for now:
                df = pd.DataFrame({
                    "close": [2500, 2510, 2505, 2520, 2515] * 4 # Need enough data for indicators
                })

                # 2. Get AI/Deterministic Decision
                user_config = {"risk_level": "MEDIUM"} # Assume fetched from DB
                decision = await decision_engine.get_decision(df, user_config)
                
                # 3. Risk Check
                if decision["action"] != "HOLD":
                    margins = broker_service.get_margins()
                    positions = broker_service.get_positions()
                    
                    risk_check = risk_engine.validate_trade(decision, margins, positions)
                    
                    if risk_check["valid"]:
                        # 4. Execute Order
                        order_id = broker_service.place_order(
                            variety="regular",
                            exchange="NSE",
                            tradingsymbol=symbol,
                            transaction_type=decision["action"],
                            quantity=risk_check["quantity"],
                            product="MIS",
                            order_type="MARKET"
                        )
                        
                        # 5. Store Feedback
                        memory_service.store_trade_feedback({
                            "user_id": 1, # Placeholder
                            "broker_order_id": order_id,
                            "symbol": symbol,
                            "side": decision["action"],
                            "price": df["close"].iloc[-1],
                            "quantity": risk_check["quantity"],
                            "status": "SUCCESS",
                            "llm_reason": decision["reason"],
                            "indicators_snapshot": decision.get("indicators", {})
                        })
                    else:
                        logger.info(f"Risk Reject: {risk_check['reason']}")

                # 5. Cooldown (Minimizing LLM calls as requested)
                await asyncio.sleep(60) # 60 second cycle

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Trading loop error: {e}")
                await asyncio.sleep(10)

agent_scheduler = AgentScheduler()
