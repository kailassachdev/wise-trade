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

    def get_margins(self) -> Dict[str, Any]:
        return self.kite.margins() if self.kite else {}

    def get_positions(self) -> List[Dict[str, Any]]:
        return self.kite.positions() if self.kite else []

    def get_holdings(self) -> List[Dict[str, Any]]:
        return self.kite.holdings() if self.kite else []

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
        Place an order using Zerodha Kite API.
        """
        if not self.kite:
            raise ValueError("Kite client not initialized")
            
        kwargs = {
            "variety": variety,
            "exchange": exchange,
            "tradingsymbol": tradingsymbol,
            "transaction_type": transaction_type,
            "quantity": quantity,
            "product": product,
            "order_type": order_type,
            "validity": validity,
        }
        if price is not None: kwargs["price"] = price
        if trigger_price is not None: kwargs["trigger_price"] = trigger_price
        if disclosed_quantity is not None: kwargs["disclosed_quantity"] = disclosed_quantity
        if stoploss is not None: kwargs["stoploss"] = stoploss
            
        order_id = self.kite.place_order(**kwargs)
        return order_id

    def get_profile(self) -> Dict[str, Any]:
        """
        Get the user profile from Zerodha Kite explicitly bypassing the SDK to enforce custom headers.
        """
        if not self.kite or not self.kite.access_token:
            raise ValueError("Kite client or access token not initialized")
            
        import httpx
        url = "https://api.kite.trade/user/profile"
        headers = {
            "X-Kite-Version": "3",
            "Authorization": f"token {self.api_key}:{self.kite.access_token}"
        }
        
        logger.info(f"Fetching profile with headers: {headers}")
        
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"Profile API Error: {response.text}")
                response.raise_for_status()
                
            data = response.json()
            if data.get("status") == "success":
                return data.get("data", {})
            return data

broker_service = BrokerService()
