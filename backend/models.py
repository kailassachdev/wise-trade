from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    
    # Zerodha specific
    kite_api_key: Optional[str] = None
    kite_api_secret: Optional[str] = None
    kite_access_token: Optional[str] = None
    
    agent_memory: "AgentMemory" = Relationship(back_populates="user")
    trades: List["TradeFeedback"] = Relationship(back_populates="user")

class AgentMemory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    strategy_weights: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    risk_level: str = Field(default="MEDIUM")
    confidence_threshold: float = Field(default=0.7)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    
    user: User = Relationship(back_populates="agent_memory")

class TradeFeedback(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    broker_order_id: Optional[str] = None
    symbol: str
    side: str # BUY/SELL
    price: float
    quantity: int
    status: str # SUCCESS/FAILED
    outcome: Optional[float] = None # Profit/Loss
    market_condition: Optional[str] = None # Trending/Sideways/Volatile
    indicators_snapshot: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    llm_reason: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    user: User = Relationship(back_populates="trades")
