from fastapi import APIRouter
from ..scheduler.agent_scheduler import agent_scheduler

router = APIRouter()

@router.post("/toggle")
async def toggle_agent(active: bool):
    if active:
        await agent_scheduler.start()
        status = "ON"
    else:
        await agent_scheduler.stop()
        status = "OFF"
    return {"status": status}

@router.get("/status")
async def get_status():
    return {"status": "ON" if agent_scheduler.is_running else "OFF"}
