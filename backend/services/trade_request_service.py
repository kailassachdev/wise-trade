import httpx
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Internal API base URL — same server
TRADE_API_URL = "http://localhost:8000/api/trade/execute"


class TradeRequestService:
    """
    Secure trade request service.
    Instead of calling broker_service.place_order() directly,
    all trade requests go through the backend's /api/trade/execute endpoint.
    This ensures every order goes through auth, validation, and logging.
    """

    async def submit_trade_request(
        self,
        symbol: str,
        transaction_type: str,
        quantity: int,
        exchange: str = "NSE",
        product: str = "CNC",
        order_type: str = "MARKET",
        price: Optional[float] = None,
        source: str = "agent",
        reason: str = "AI Decision"
    ) -> Dict[str, Any]:
        """
        Submits a trade request to the backend trade API.
        Returns the API response dict with order_id on success.
        """
        payload = {
            "symbol": symbol,
            "transaction_type": transaction_type,
            "quantity": quantity,
            "exchange": exchange,
            "product": product,
            "order_type": order_type,
            "price": price,
            "source": source,
            "reason": reason,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                logger.info(
                    f"[TradeRequest] {source} → {transaction_type} {symbol} x{quantity} "
                    f"on {exchange} ({product}/{order_type})"
                )
                response = await client.post(TRADE_API_URL, json=payload)

                if response.status_code == 200:
                    result = response.json()
                    logger.info(
                        f"[TradeRequest] SUCCESS — Order ID: {result.get('order_id')}"
                    )
                    return result
                else:
                    error_detail = response.json().get("detail", response.text)
                    logger.error(
                        f"[TradeRequest] REJECTED by backend ({response.status_code}): "
                        f"{error_detail}"
                    )
                    return {"status": "error", "detail": error_detail}

        except httpx.ConnectError:
            logger.error("[TradeRequest] Cannot reach backend at %s", TRADE_API_URL)
            return {"status": "error", "detail": "Backend unreachable"}
        except Exception as e:
            logger.error(f"[TradeRequest] Unexpected error: {e}")
            return {"status": "error", "detail": str(e)}


trade_request_service = TradeRequestService()
