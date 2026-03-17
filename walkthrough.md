# Smart Trade AI Trading Platform Walkthrough

The "Smart Trade" platform is now fully implemented with a production-grade architecture.

## Architecture Overview

````mermaid
graph TD
    UI[React Dashboard] --> API[FastAPI Backend]
    API --> DE[Decision Engine]
    DE --> IE[Indicator Service]
    DE --> OS[Ollama Service - DeepSeek]
    DE --> RE[Risk Engine]
    DE --> BS[Broker Service - Zerodha]
    BS --> MK[NSE/BSE Market]
    API --> DB[(SQLite/AgentMemory)]
````

## Key Components

### 1. Decision Engine ([services/decision_engine.py](file:///c:/Users/KAILAS/OneDrive/Desktop/main/backend/services/decision_engine.py))
Implements the hybrid logic:
- **Deterministic Pre-filter**: Only calls the LLM if indicators (RSI, MACD) show a potential signal.
- **DeepSeek v3.1 Integration**: Uses the fixed `deepseek-v3.1:671b-cloud` model via Ollama for final reasoning.

### 2. Risk Engine ([services/risk_engine.py](file:///c:/Users/KAILAS/OneDrive/Desktop/main/backend/services/risk_engine.py))
- Enforces max allocation per trade.
- Checks confidence thresholds (min 0.7).
- Calculates stop-loss levels.

### 3. Zerodha Integration ([services/broker_service.py](file:///c:/Users/KAILAS/OneDrive/Desktop/main/backend/services/broker_service.py))
- Real-world order placement using `kite.place_order()`.
- Daily token generation flow.

### 4. Premium Dashboard ([frontend/src/App.tsx](file:///c:/Users/KAILAS/OneDrive/Desktop/main/frontend/src/App.tsx))
- Sleek dark-mode interface with "Glassmorphism" effects.
- Real-time portfolio monitoring.
- AI Reasoning panel showing agent intent.

## Implementation Details

### Backend Structure
- [models.py](file:///c:/Users/KAILAS/OneDrive/Desktop/main/backend/models.py): AgentMemory and TradeFeedback tables.
- [agent_scheduler.py](file:///c:/Users/KAILAS/OneDrive/Desktop/main/backend/scheduler/agent_scheduler.py): Core loop running every 60 seconds with LLM cooldown.

### Frontend Dashboard
- [index.css](file:///c:/Users/KAILAS/OneDrive/Desktop/main/frontend/src/index.css): Custom design system.
- [App.tsx](file:///c:/Users/KAILAS/OneDrive/Desktop/main/frontend/src/App.tsx): Main dashboard logic.

## How to Run

1. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Ollama**:
   Ensure Ollama is running with `deepseek-v3.1:671b-cloud`.

> [!IMPORTANT]
> This system executes real trades. Ensure your `ZERODHA_API_KEY` and `ZERODHA_API_SECRET` are set in `.env`.
