@echo off
echo Starting Smart Trade AI Trading Platform...

:: Check for node_modules in frontend
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && npm install && cd ..
)

:: Check for virtual environment or dependencies in backend
:: Assuming python is in PATH and requirements.txt is at backend/requirements.txt
echo Installing backend dependencies...
pip install -r backend/requirements.txt

:: Start Backend in a new window
echo Starting FastAPI Backend...
:: Running uvicorn from root to support package imports
start cmd /k "python -m uvicorn backend.main:app --reload --port 8000"

:: Start Ollama AI Model in a new window
echo Starting Ollama (DeepSeek)...
start cmd /k "ollama run deepseek-v3.1:671b-cloud"

:: Start Frontend in a new window
echo Starting Frontend...
start cmd /k "cd frontend && npm run dev"

echo.
echo ======================================================
echo Smart Trade is running!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo ======================================================
pause
