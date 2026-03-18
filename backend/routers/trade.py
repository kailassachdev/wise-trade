from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select
from ..database import get_session
from ..models import User, TradeFeedback
from ..services.broker_service import broker_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class OrderRequest(BaseModel):
    exchange: str = "NSE"
    symbol: str
    transaction_type: str # BUY or SELL
    quantity: int
    product: str = "CNC" # CNC for delivery, MIS for intraday
    order_type: str = "MARKET"
    price: Optional[float] = None

@router.post("/execute")
async def execute_trade(order: OrderRequest, session: Session = Depends(get_session)):
    """
    Endpoint for AI or Frontend to trigger a trade execution.
    """
    try:
        # 1. Get the latest authenticated user to get the access token
        user = session.exec(select(User).order_by(User.id.desc())).first()
        if not user or not user.kite_access_token:
            raise HTTPException(status_code=401, detail="Broker not authenticated")

        # 2. Set token on service
        broker_service.set_access_token(user.kite_access_token)

        # 3. Place order through Zerodha
        logger.info(f"Executing {order.transaction_type} order for {order.symbol} x {order.quantity}")
        
        order_id = broker_service.place_order(
            variety="regular",
            exchange=order.exchange,
            tradingsymbol=order.symbol,
            transaction_type=order.transaction_type,
            quantity=order.quantity,
            product=order.product,
            order_type=order.order_type,
            price=order.price
        )

        # 4. Save trade to local history for AI learning
        trade_log = TradeFeedback(
            user_id=user.id,
            broker_order_id=order_id,
            symbol=order.symbol,
            side=order.transaction_type,
            price=0.0, # Will be updated via websocket/callback in real app
            quantity=order.quantity,
            status="SUCCESS",
            llm_reason="Triggered by AI Decision Engine"
        )
        session.add(trade_log)
        session.commit()

        return {
            "status": "success",
            "order_id": order_id,
            "message": f"Successfully placed {order.transaction_type} order"
        }

    except Exception as e:
        logger.error(f"Trade Execution Failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders")
async def get_orders(session: Session = Depends(get_session)):
    """Fetch all orders (open + executed) for the day from Zerodha."""
    try:
        user = session.exec(select(User).order_by(User.id.desc())).first()
        if not user or not user.kite_access_token:
            raise HTTPException(status_code=401, detail="Broker not authenticated")
        broker_service.set_access_token(user.kite_access_token)
        orders = broker_service.kite.orders()
        return {"status": "success", "orders": orders or []}
    except Exception as e:
        logger.error(f"Get orders failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/trades")
async def get_trades(session: Session = Depends(get_session)):
    """Fetch all executed trades for the day from Zerodha."""
    try:
        user = session.exec(select(User).order_by(User.id.desc())).first()
        if not user or not user.kite_access_token:
            raise HTTPException(status_code=401, detail="Broker not authenticated")
        broker_service.set_access_token(user.kite_access_token)
        trades = broker_service.kite.trades()
        return {"status": "success", "trades": trades or []}
    except Exception as e:
        logger.error(f"Get trades failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
