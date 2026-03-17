from kiteconnect import KiteConnect
import logging
from typing import Dict, Any, List, Optional
import os

logger = logging.getLogger(__name__)

class BrokerService:
    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        self.api_key = api_key or os.getenv("ZERODHA_API_KEY")
        self.api_secret = api_secret or os.getenv("ZERODHA_API_SECRET")
        self.kite = None
        if self.api_key:
            self.kite = KiteConnect(api_key=self.api_key)

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
                    stoploss: Optional[float] = None) -> str:
        """
        Place an order using Zerodha Kite API.
        """
        if not self.kite:
            raise ValueError("Kite client not initialized")
            
        order_id = self.kite.place_order(
            variety=variety,
            exchange=exchange,
            tradingsymbol=tradingsymbol,
            transaction_type=transaction_type,
            quantity=quantity,
            product=product,
            order_type=order_type,
            price=price,
            stoploss=stoploss
        )
        return order_id

broker_service = BrokerService()
