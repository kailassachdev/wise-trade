import asyncio
import logging
from ..services.decision_engine import decision_engine
from ..services.risk_engine import risk_engine
from ..services.memory_service import memory_service
from ..services.trade_request_service import trade_request_service
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
                # 1. Fetch Market Data (Placeholder)
                symbol = "RELIANCE"
                df = pd.DataFrame({
                    "close": [2500, 2510, 2505, 2520, 2515] * 4
                })

                # 2. Get AI/Deterministic Decision
                user_config = {"risk_level": "MEDIUM"}
                decision = await decision_engine.get_decision(df, user_config)
                
                # 3. If action needed, submit via secure backend API
                if decision["action"] != "HOLD" and decision.get("confidence", 0) >= 0.7:
                    api_response = await trade_request_service.submit_trade_request(
                        symbol=symbol,
                        transaction_type=decision["action"],
                        quantity=1,  # Default; risk engine can adjust via API later
                        exchange="NSE",
                        product="MIS",
                        order_type="MARKET",
                        source="technical_agent",
                        reason=decision.get("reason", "Technical indicators signal")[:100]
                    )
                    logger.info(f"Technical trade submitted: {api_response}")

                # 4. News-driven trading (also uses secure API internally)
                try:
                    news_results = await decision_engine.process_news_and_trade()
                    if news_results:
                        logger.info(f"Processed {len(news_results)} news items.")
                except Exception as news_e:
                    logger.error(f"News loop error: {news_e}")

                # 5. Social Media Analysis (also uses secure API internally)
                social_symbols = ["RELIANCE", "TCS", "INFY"]
                try:
                    social_results = await decision_engine.process_social_media_and_trade(social_symbols)
                    if social_results:
                        logger.info(f"Processed social media for {len(social_symbols)} symbols.")
                except Exception as social_e:
                    logger.error(f"Social media loop error: {social_e}")

                # 6. Cooldown
                await asyncio.sleep(60)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Trading loop error: {e}")
                await asyncio.sleep(10)

agent_scheduler = AgentScheduler()

