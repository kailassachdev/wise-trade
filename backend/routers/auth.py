from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from ..database import get_session
from ..models import User, AgentMemory
from ..services.broker_service import broker_service
import os

router = APIRouter()

@router.get("/zerodha/login")
async def get_login_url():
    """
    Get the Zerodha Kite login URL.
    """
    if not broker_service.api_key or "your_api_key" in broker_service.api_key or "derthrawrxc8sokx" in broker_service.api_key:
        raise HTTPException(
            status_code=400, 
            detail="Zerodha API Key is not configured. Please update the .env file with your real credentials."
        )
    
    login_url = f"https://kite.zerodha.com/connect/login?v=3&api_key={broker_service.api_key}"
    return {"login_url": login_url}

from fastapi.responses import RedirectResponse

@router.get("/zerodha/callback")
async def zerodha_callback(request_token: str = Query(...), session: Session = Depends(get_session)):
    """
    Handle callback from Zerodha with request_token.
    """
    try:
        data = broker_service.generate_session(request_token)
        access_token = data["access_token"]
        
        # In a real app, identify current user (e.g., via JWT)
        # For now, we assume a single user with ID 1
        user = session.exec(select(User).where(User.id == 1)).first()
        if not user:
            # Create default user for demo
            user = User(username="admin", email="admin@example.com", hashed_password="hashed_placeholder")
            session.add(user)
            session.commit()
            session.refresh(user)
            
        user.kite_access_token = access_token
        session.add(user)
        session.commit()
        
        # Redirect back to the frontend dashboard
        return RedirectResponse(url="http://localhost:5173/?auth=success")
    except Exception as e:
        # On error, redirect back with error message
        return RedirectResponse(url=f"http://localhost:5173/?auth=error&message={str(e)}")

@router.post("/login")
async def login():
    return {"message": "Standard login placeholder"}
