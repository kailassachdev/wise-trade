from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..database import get_session
from ..models import User
from ..services.broker_service import broker_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_portfolio(session: Session = Depends(get_session)):
    try:
        # Load the latest access token from the latest logged-in user (for local dev)
        user = session.exec(select(User).order_by(User.id.desc())).first()
        
        if not user or not user.kite_access_token:
            return {"error": "Kite not authenticated", "holdings": [], "positions": [], "margins": {}}
        
        # Set the token on our broker service
        broker_service.set_access_token(user.kite_access_token)
        
        margins = broker_service.get_margins()
        positions = broker_service.get_positions()
        holdings = broker_service.get_holdings()
        
        return {
            "margins": margins,
            "positions": positions,
            "holdings": holdings,
            "user": user.username
        }
    except Exception as e:
        logger.error(f"Error fetching portfolio: {str(e)}")
        return {"error": str(e), "holdings": [], "positions": [], "margins": {}}
