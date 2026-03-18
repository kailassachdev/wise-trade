from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from ..database import get_session
from ..models import User
from ..services.broker_service import broker_service
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/zerodha/login")
async def get_login_url():
    """
    Called by frontend to 'instruction' the backend to start the connection process.
    The backend prepares the URL and returns it.
    """
    if not broker_service.api_key:
        raise HTTPException(
            status_code=400, 
            detail="Zerodha API Key is not configured."
        )
    
    # Initialization: Log the attempt and verify credentials
    logger.info("Initializing Zerodha connection request from frontend...")
    
    login_url = f"https://kite.zerodha.com/connect/login?v=3&api_key={broker_service.api_key}"
    return {"login_url": login_url, "status": "initialized"}

@router.get("/zerodha/callback")
async def zerodha_callback(request_token: str = Query(...), session: Session = Depends(get_session)):
    """
    Handle callback from Zerodha with request_token, exchange it for access_token, 
    and store it for the user.
    """
    try:
        logger.info(f"Received Zerodha callback with request_token: {request_token}")
        
        # Exchange request_token for access_token
        data = broker_service.generate_session(request_token)
        access_token = data["access_token"]
        user_id = data.get("user_id", "unknown")
        user_name = data.get("user_name", "Kite User")
        
        logger.info(f"Successfully generated Zerodha session for user: {user_name} ({user_id})")
        
        # In a development environment, assume a single user (id=1) 
        # or find/create a user based on the kite user_id
        user = session.exec(select(User).where(User.username == user_id)).first()
        
        if not user:
            # Check if default user exists
            user = session.get(User, 1)
            if not user:
                # Create a new user if none exists
                user = User(
                    username=user_id, 
                    email=f"{user_id}@zerodha.user", 
                    hashed_password="oauth_managed"
                )
                session.add(user)
                session.commit()
                session.refresh(user)
        
        # Save the access token to the user record
        user.kite_access_token = access_token
        session.add(user)
        session.commit()
        
        logger.info(f"Zerodha access token saved for user {user.username}")
        
        # Redirect back to the frontend with success status
        return RedirectResponse(url="http://localhost:5173/?auth=success&broker=zerodha")
        
    except Exception as e:
        logger.error(f"Error during Zerodha authentication: {str(e)}")
        # Redirect back with error message
        return RedirectResponse(url=f"http://localhost:5173/?auth=error&message={str(e)}")

@router.get("/profile")
async def get_zerodha_profile(session: Session = Depends(get_session)):
    """
    Retrieve user profile details from Zerodha Kite.
    """
    try:
        # 1. Fetch the latest authenticated user to get the access token
        user = session.exec(select(User).order_by(User.id.desc())).first()
        if not user or not user.kite_access_token:
            raise HTTPException(status_code=401, detail="Kite not authenticated. Please login first.")

        # 2. Set the token on the broker service
        broker_service.set_access_token(user.kite_access_token)

        # 3. Fetch the profile details
        profile_data = broker_service.get_profile()

        # 4. Print the result in the terminal as requested
        import json
        print("\n" + "="*50)
        print("KITE USER PROFILE DATA")
        print("="*50)
        print(json.dumps(profile_data, indent=4))
        print("="*50 + "\n")

        return {"status": "success", "data": profile_data}

    except Exception as e:
        logger.error(f"Error fetching Kite profile: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login():
    return {"message": "Standard login placeholder"}
