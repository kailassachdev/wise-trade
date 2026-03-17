from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from .database import create_db_and_tables, get_session
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Smart Trade AI Trading Platform")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

@app.get("/api/health")
def health_check():
    return {"status": "ok", "backend": "FastAPI", "version": "1.0.0"}

@app.get("/")
def read_root():
    return {"message": "Welcome to Smart Trade AI API"}

if __name__ == "__main__":
    import uvicorn
    print("Starting Smart Trade Backend Debug Mode...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

# Routers will be included here
from .routers import auth, trade, portfolio, agent
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(trade.router, prefix="/api/trade", tags=["Trading"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(agent.router, prefix="/api/agent", tags=["Agent Management"])
