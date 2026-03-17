from fastapi import APIRouter, Depends
from ..services.broker_service import broker_service

router = APIRouter()

@router.get("/")
async def get_portfolio():
    try:
        margins = broker_service.get_margins()
        positions = broker_service.get_positions()
        holdings = broker_service.get_holdings()
        
        return {
            "margins": margins,
            "positions": positions,
            "holdings": holdings
        }
    except Exception as e:
        return {"error": str(e), "holdings": [], "positions": [], "margins": {}}
