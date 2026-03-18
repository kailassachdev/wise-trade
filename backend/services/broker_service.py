from kiteconnect import KiteConnect
import logging
from typing import Dict, Any, List, Optional
import os
from dotenv import load_dotenv

load_dotenv("env")

logger = logging.getLogger(__name__)

class BrokerService:
    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        self.api_key = (api_key or os.getenv("ZERODHA_API_KEY", "")).strip()
        self.api_secret = (api_secret or os.getenv("ZERODHA_API_SECRET", "")).strip()
        self.kite = None
        if self.api_key:
            logger.info(f"Initializing Kite with API Key: {self.api_key[:4]}...{self.api_key[-4:] if len(self.api_key) > 4 else ''}")
            # Increase timeout to 30 seconds for slower connections
            self.kite = KiteConnect(api_key=self.api_key)
            self.kite.timeout = 30
        else:
            logger.warning("Kite API Key not found in environment variables.")

    def set_access_token(self, access_token: str):
        if self.kite:
            self.kite.set_access_token(access_token)

    def generate_session(self, request_token: str) -> Dict[str, Any]:
        """
        Generate access token using request_token.
        """
        if not self.kite or not self.api_secret:
            raise ValueError("Kite api_key or api_secret not set")
            
        data = self.kite.generate_session(request_token, api_secret=self.api_secret)
        self.set_access_token(data["access_token"])
        return data

    def _make_httpx_request(self, endpoint: str) -> Any:
        """Helper to make direct httpx calls to Zerodha, bypassing the SDK wrapper."""
        if not self.kite or not self.kite.access_token:
            raise ValueError("Kite client or access token not initialized")
            
        import httpx
        url = f"https://api.kite.trade{endpoint}"
        headers = {
            "X-Kite-Version": "3",
            "Authorization": f"token {self.api_key}:{self.kite.access_token}"
        }
        
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"Zerodha API Error on {endpoint}: {response.text}")
                response.raise_for_status()
            
            data = response.json()
            if data.get("status") == "success":
                return data.get("data", {})
            return data

    def get_margins(self) -> Dict[str, Any]:
        try:
            return self._make_httpx_request("/user/margins")
        except Exception as e:
            logger.error(f"Failed to fetch margins: {e}")
            return {}

    def get_positions(self) -> Dict[str, Any]:
        try:
            return self._make_httpx_request("/portfolio/positions")
        except Exception as e:
            logger.error(f"Failed to fetch positions: {e}")
            return {"net": [], "day": []}

    def get_holdings(self) -> List[Dict[str, Any]]:
        try:
            return self._make_httpx_request("/portfolio/holdings")
        except Exception as e:
            logger.error(f"Failed to fetch holdings: {e}")
            return []

    def place_order(self, 
                    variety: str, 
                    exchange: str, 
                    tradingsymbol: str, 
                    transaction_type: str, 
                    quantity: int, 
                    product: str, 
                    order_type: str, 
                    price: Optional[float] = None, 
                    trigger_price: Optional[float] = None,
                    disclosed_quantity: Optional[int] = None,
                    validity: str = "DAY",
                    stoploss: Optional[float] = None) -> str:
        """
        Place an order using Zerodha Kite explicitly bypassing the SDK to enforce custom headers 
        and circumvent brittle SDK Keep-Alive RemoteDisconnected bugs.
        """
        if not self.kite or not self.kite.access_token:
            raise ValueError("Kite client or access token not initialized")
            
        import httpx
        url = f"https://api.kite.trade/orders/{variety}"
        headers = {
            "X-Kite-Version": "3",
            "Authorization": f"token {self.api_key}:{self.kite.access_token}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # Build payload explicitly without 'variety' (it goes into URL)
        payload = {
            "exchange": exchange,
            "tradingsymbol": tradingsymbol,
            "transaction_type": transaction_type,
            "quantity": quantity,
            "product": product,
            "order_type": order_type,
            "validity": validity,
        }
        if price is not None: payload["price"] = price
        if trigger_price is not None: payload["trigger_price"] = trigger_price
        if disclosed_quantity is not None: payload["disclosed_quantity"] = disclosed_quantity
        if stoploss is not None: payload["stoploss"] = stoploss
            
        logger.info(f"Placing pure HTTPX order to {url} payload: {payload}")
        
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, headers=headers, data=payload)
            
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    err_msg = error_data.get("message", response.text)
                except:
                    err_msg = response.text
                logger.error(f"Order API Error: {err_msg}")
                raise ValueError(err_msg)
                
            data = response.json()
            if data.get("status") == "success":
                return data.get("data", {}).get("order_id", "UNKNOWN_ORDER_ID")
            
            raise ValueError(f"Zerodha Order Failed: {data.get('message', 'Unknown Error')}")

    def get_profile(self) -> Dict[str, Any]:
        """
        Get the user profile from Zerodha Kite explicitly bypassing the SDK to enforce custom headers.
        """
        try:
            return self._make_httpx_request("/user/profile")
        except Exception as e:
            logger.error(f"Profile API Error: {e}")
            return {}

broker_service = BrokerService()
