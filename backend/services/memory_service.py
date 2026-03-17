from sqlmodel import Session, select
from ..models import AgentMemory, TradeFeedback, User
from ..database import engine
from .ollama_service import ollama_service
from datetime import datetime
from typing import Dict, Any, List
import json

class MemoryService:
    def get_agent_memory(self, user_id: int) -> AgentMemory:
        with Session(engine) as session:
            statement = select(AgentMemory).where(AgentMemory.user_id == user_id)
            memory = session.exec(statement).first()
            if not memory:
                memory = AgentMemory(user_id=user_id)
                session.add(memory)
                session.commit()
                session.refresh(memory)
            return memory

    def store_trade_feedback(self, trade_data: Dict[str, Any]):
        with Session(engine) as session:
            feedback = TradeFeedback(**trade_data)
            session.add(feedback)
            session.commit()
            
            # Check if we should trigger reflection (every 5 trades)
            self._check_and_reflect(trade_data["user_id"])

    def _check_and_reflect(self, user_id: int):
        with Session(engine) as session:
            statement = select(TradeFeedback).where(TradeFeedback.user_id == user_id).order_by(TradeFeedback.timestamp.desc()).limit(10)
            trades = session.exec(statement).all()
            
            if len(trades) >= 5:
                # Prepare trade history for LLM
                trade_history = []
                for t in trades:
                    trade_history.append({
                        "symbol": t.symbol,
                        "side": t.side,
                        "outcome": t.outcome,
                        "reason": t.llm_reason
                    })
                
                # Call LLM for reflection
                # Note: In a real app, this should be async or handled by a worker
                # self.reflect_async(user_id, trade_history)
                pass

    async def reflect_on_performance(self, user_id: int, trade_history: List[Dict[str, Any]]):
        history_str = json.dumps(trade_history)
        reflection_json = await ollama_service.reflect_on_trades(history_str)
        reflection = json.loads(reflection_json)
        
        with Session(engine) as session:
            statement = select(AgentMemory).where(AgentMemory.user_id == user_id)
            memory = session.exec(statement).first()
            if memory:
                # Update memory based on AI reflection
                # This is a placeholder for actual adjustment logic
                memory.strategy_weights = reflection.get("adjustments", {})
                memory.last_updated = datetime.utcnow()
                session.add(memory)
                session.commit()

memory_service = MemoryService()
