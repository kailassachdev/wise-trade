"""
Agent Service
Manages the proposal store and background position monitor.
"""
import uuid
import logging
import threading
import time as time_module
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger(__name__)


class AgentService:
    def __init__(self):
        self.proposals: Dict[str, Dict[str, Any]] = {}   # id -> proposal
        self.activity_log: list = []                      # most recent first
        self._monitor_thread: threading.Thread | None = None
        self._monitoring = False
        self.auto_approve = False

    # ── Proposal CRUD ──────────────────────────────────────────────────────────

    def add_proposals(self, proposals: list) -> list:
        """Store new proposals, removing stale ones first. Returns ids."""
        # Clear old proposals before adding fresh ones
        self.proposals = {}
        ids = []
        for p in proposals:
            pid = str(uuid.uuid4())[:8]
            self.proposals[pid] = {**p, "id": pid, "status": "pending", "created_at": datetime.now().isoformat()}
            ids.append(pid)
        self._log(f"Screener returned {len(proposals)} proposals.")
        return ids

    def add_proposal(self, p: dict) -> str:
        """Add a single proposal (used by background AI scheduler)"""
        pid = str(uuid.uuid4())[:8]
        self.proposals[pid] = {
            **p, 
            "id": pid, 
            "status": "pending", 
            "created_at": datetime.now().isoformat()
        }
        sym = p.get("symbol", "?")
        action = p.get("action", "?")
        reason = p.get("reason", "")
        self._log(f"🧠 AI Agent generated {action} proposal for {sym}: {reason[:50]}...")
        return pid

    def get_proposals(self) -> list:
        return [p for p in self.proposals.values() if p["status"] == "pending"]

    def reject_proposal(self, pid: str) -> bool:
        if pid in self.proposals:
            self.proposals[pid]["status"] = "rejected"
            sym = self.proposals[pid].get("symbol", "?")
            self._log(f"Rejected proposal for {sym}.")
            return True
        return False

    def mark_approved(self, pid: str):
        if pid in self.proposals:
            self.proposals[pid]["status"] = "approved"
            sym = self.proposals[pid]["symbol"]
            action = self.proposals[pid]["action"]
            self._log(f"Approved {action} order for {sym}.")

    def auto_approve_proposals(self, pids: list):
        """Helper to auto approve a list of proposal ids"""
        # Note: We need to import approve_proposal or place the order directly here
        from .broker_service import broker_service
        for pid in pids:
            proposal = self.proposals.get(pid)
            if not proposal or proposal["status"] != "pending":
                continue
            try:
                action = proposal["action"]
                price = proposal["limit_price"] if proposal["order_type"] == "LIMIT" else 0
                
                result = broker_service.place_order(
                    variety=proposal["variety"],
                    exchange=proposal["exchange"],
                    tradingsymbol=proposal["symbol"],
                    transaction_type=action,
                    quantity=proposal["qty"],
                    product=proposal.get("product", "MIS"),
                    order_type=proposal["order_type"],
                    price=price if price else None,
                    trigger_price=None,
                    disclosed_quantity=0,
                    validity="DAY",
                )
                self.mark_approved(pid)
                self._log(f"✅ Auto-approved {action} for {proposal['symbol']}")
            except Exception as e:
                self._log(f"❌ Auto-approve failed for {proposal['symbol']}: {e}")

    # ── Activity Log ───────────────────────────────────────────────────────────

    def _log(self, message: str):
        entry = {"time": datetime.now().strftime("%H:%M:%S"), "msg": message}
        self.activity_log.insert(0, entry)
        self.activity_log = self.activity_log[:50]  # Keep last 50 entries
        logger.info(f"[AGENT] {message}")

    def get_log(self) -> list:
        return self.activity_log

    # ── Background Position Monitor ────────────────────────────────────────────

    def start_monitor(self):
        if self._monitoring:
            return
        self._monitoring = True
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()
        self._log("Position monitor started (30s interval).")

    def stop_monitor(self):
        self._monitoring = False
        self._log("Position monitor stopped.")

    def _monitor_loop(self):
        """Runs every 30 seconds and checks open positions against target/SL."""
        import yfinance as yf
        from .broker_service import broker_service

        while self._monitoring:
            try:
                positions_data = broker_service.get_positions()
                net_positions = positions_data.get("net", [])

                if net_positions:
                    syms = [p["tradingsymbol"] for p in net_positions if p.get("quantity", 0) != 0]
                    if syms:
                        yf_syms = [f"{s}.NS" for s in syms]
                        tickers = yf.download(" ".join(yf_syms), period="1d", interval="1m", progress=False)

                        for pos in net_positions:
                            qty = pos.get("quantity", 0)
                            if qty == 0:
                                continue
                            sym = pos["tradingsymbol"]
                            avg_price = pos.get("average_price", 0)
                            if avg_price <= 0:
                                continue

                            # Get LTP
                            try:
                                yf_sym = f"{sym}.NS"
                                if len(syms) > 1:
                                    ltp = float(tickers[yf_sym]["Close"].iloc[-1])
                                else:
                                    ltp = float(tickers["Close"].iloc[-1])
                            except Exception:
                                ltp = pos.get("last_price", avg_price)

                            pct_change = ((ltp - avg_price) / avg_price) * 100

                            # Look for approved/known proposals that match this position
                            for p in self.proposals.values():
                                if p.get("symbol") == sym and p.get("status") == "approved" and p.get("action") == "BUY":
                                    target = p.get("target", avg_price * 1.05)
                                    sl = p.get("stop_loss", avg_price * 0.98)

                                    # Generate SELL proposal if conditions met
                                    if ltp >= target:
                                        self._generate_sell_proposal(sym, qty, ltp, "TARGET HIT", pos.get("exchange", "NSE"), pos.get("product", "MIS"))
                                    elif ltp <= sl:
                                        self._generate_sell_proposal(sym, qty, ltp, "STOP-LOSS HIT", pos.get("exchange", "NSE"), pos.get("product", "MIS"))

            except Exception as e:
                logger.error(f"Monitor loop error: {e}")

            time_module.sleep(30)

    def _generate_sell_proposal(self, symbol: str, qty: int, price: float, reason: str, exchange: str, product: str):
        """Create a SELL proposal — avoids duplicates."""
        for p in self.proposals.values():
            if p.get("symbol") == symbol and p.get("action") == "SELL" and p.get("status") == "pending":
                return  # Already have a pending sell for this stock

        from .screener_service import get_order_params
        order_params = get_order_params(price)

        pid = str(uuid.uuid4())[:8]
        self.proposals[pid] = {
            "id": pid,
            "symbol": symbol,
            "action": "SELL",
            "price": round(price, 2),
            "qty": qty,
            "target": None,
            "stop_loss": None,
            "score": 0,
            "reason": reason,
            "variety": order_params["variety"],
            "order_type": order_params["order_type"],
            "limit_price": order_params["price"],
            "exchange": exchange,
            "product": product,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        }
        self._log(f"🚨 SELL proposal created for {symbol} — {reason}")
        if self.auto_approve:
            self.auto_approve_proposals([pid])


# Singleton
agent_service = AgentService()
