import asyncio
import logging
from ..services.decision_engine import decision_engine
from ..services.risk_engine import risk_engine
from ..services.memory_service import memory_service
from ..services.agent_service import agent_service
from ..services.screener_service import get_order_params, calculate_quantity
from ..services.broker_service import broker_service
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
                import yfinance as yf
                # Fetch actual account balance to calculate proper trade quantity
                account_balance = 100000.0  # Default fallback
                try:
                    margins = broker_service.get_margins()
                    if margins and "equity" in margins:
                        available = margins["equity"].get("available", {})
                        account_balance = float(available.get("live_balance", 100000))
                except Exception as e:
                    logger.debug(f"Could not fetch real balance for quantity sizing: {e}")

                from ..services.screener_service import PENNY_UNIVERSE
                import random
                
                # Dynamically pick 5 different stocks from the curated universe every cycle
                scan_basket = random.sample(PENNY_UNIVERSE, min(5, len(PENNY_UNIVERSE)))
                agent_service._log(f"🔄 AI selected new dynamic basket for this cycle: {', '.join(scan_basket)}")
                
                for symbol in scan_basket:
                    if not self.is_running:
                        break
                        
                    try:
                        # 1. Fetch live technical data from Yahoo Finance
                        yf_sym = f"{symbol}.NS"
                        df = await asyncio.to_thread(yf.download, yf_sym, period="1mo", interval="1d", progress=False)
                        
                        if df.empty or len(df) < 15:
                            continue
                            
                        # Clean column indexing to match the indicator service
                        if isinstance(df.columns, pd.MultiIndex):
                            df.columns = df.columns.droplevel(1)
                        df.columns = df.columns.str.lower()
                        
                        # 2. Get AI Decision (passes real df data to LLM model)
                        user_config = {
                            "risk_level": "MEDIUM",
                            "capital": account_balance
                        }
                        decision = await decision_engine.get_decision(df, user_config)
                        
                        # 3. If action needed, create a proposal
                        if decision["action"] != "HOLD" and decision.get("confidence", 0) >= 0.7:
                            price = float(df["close"].iloc[-1]) if not df.empty else 0
                            order_params = get_order_params(price)
                            
                            sl_price = round(price * 0.98, 2) if price else 0
                            target_price = round(price * 1.05, 2) if price else 0
                            
                            dynamic_qty = calculate_quantity(account_balance, risk_pct=1.0, entry=price, sl=sl_price)
                            
                            pid = agent_service.add_proposal({
                                "symbol": symbol,
                                "action": decision["action"],
                                "price": round(price, 2),
                                "qty": dynamic_qty,
                                "target": target_price if price else None,
                                "stop_loss": sl_price if price else None,
                                "score": decision.get("confidence", 0),
                                "reason": f"AI Technical Insight: {decision.get('reason', 'Strong signal')} ({decision.get('confidence', 0)} conf)",
                                "variety": order_params["variety"],
                                "order_type": order_params["order_type"],
                                "limit_price": order_params["price"],
                                "exchange": "NSE",
                                "product": "MIS"
                            })
                            
                            if agent_service.auto_approve:
                                agent_service.auto_approve_proposals([pid])
                        else:
                            # Push a clean, tiny status log to the UI 
                            agent_service._log(f"✅ AI scanned {symbol} -> HOLD")
                    except Exception as scan_e:
                        logger.error(f"Error scanning {symbol}: {scan_e}")

                # 4. News-driven trading (also uses secure API internally)
                try:
                    news_results = await decision_engine.process_news_and_trade()
                    if news_results:
                        logger.info(f"Processed {len(news_results)} news items.")
                        agent_service._log(f"📰 AI analyzed {len(news_results)} news events.")
                except Exception as news_e:
                    logger.error(f"News loop error: {news_e}")

                # 5. Social Media Analysis (also uses secure API internally)
                social_symbols = scan_basket[:3]
                try:
                    social_results = await decision_engine.process_social_media_and_trade(social_symbols)
                    if social_results:
                        logger.info(f"Processed social media for {len(social_symbols)} symbols.")
                        agent_service._log(f"🐦 AI analyzed social media volume for {len(social_symbols)} stocks.")
                except Exception as social_e:
                    logger.error(f"Social media loop error: {social_e}")

                # 6. Cooldown
                # Set cool down to 120 secs to handle LLM load over multiple stocks
                await asyncio.sleep(120)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Trading loop error: {e}")
                await asyncio.sleep(10)

agent_scheduler = AgentScheduler()

