from fastapi import APIRouter, HTTPException, Query
from ..scheduler.agent_scheduler import agent_scheduler
from ..services.agent_service import agent_service
from ..services.screener_service import scan_penny_stocks
from ..services.broker_service import broker_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/toggle")
async def toggle_agent(active: bool):
    if active:
        await agent_scheduler.start()
        agent_service.start_monitor()
        status = "ON"
    else:
        await agent_scheduler.stop()
        agent_service.stop_monitor()
        status = "OFF"
    return {"status": status}


@router.get("/status")
async def get_status():
    return {"status": "ON" if agent_scheduler.is_running else "OFF"}


@router.post("/scan")
def scan_market(
    account_balance: float = Query(100000, description="Total trading capital in INR"),
    risk_pct:        float = Query(1.0,    description="Risk per trade as % of capital"),
    target_pct:      float = Query(5.0,    description="Target profit % per trade"),
    sl_pct:          float = Query(2.0,    description="Stop-loss % per trade"),
    max_proposals:   int   = Query(5,      description="Max number of proposals to return"),
):
    """Run penny stock screener and store proposals for approval."""
    try:
        proposals = scan_penny_stocks(
            account_balance=account_balance,
            risk_pct=risk_pct,
            target_pct=target_pct,
            sl_pct=sl_pct,
            max_proposals=max_proposals,
        )
        ids = agent_service.add_proposals(proposals)
        return {
            "status": "success",
            "count": len(proposals),
            "proposals": agent_service.get_proposals(),
        }
    except Exception as e:
        logger.error(f"Scan error: {e}")
        return {"status": "error", "message": str(e), "proposals": []}


@router.get("/proposals")
def get_proposals():
    """List all pending proposals."""
    return {"proposals": agent_service.get_proposals()}


@router.post("/approve/{proposal_id}")
def approve_proposal(proposal_id: str):
    """Execute a proposal by placing the actual order via the broker."""
    proposal = agent_service.proposals.get(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Proposal is already {proposal['status']}")

    try:
        action = proposal["action"]
        price = proposal["limit_price"] if proposal["order_type"] == "LIMIT" else 0

        result = broker_service.place_order(
            variety=proposal["variety"],
            exchange=proposal["exchange"],
            tradingsymbol=proposal["symbol"],
            transaction_type=action,
            quantity=proposal["qty"],
            product=proposal.get("product", "MIS"),
            order_type=proposal["order_type"],
            price=price if price else None,
            trigger_price=None,
            disclosed_quantity=0,
            validity="DAY",
        )
        agent_service.mark_approved(proposal_id)
        return {"status": "success", "order_result": result}
    except Exception as e:
        logger.error(f"Approve order error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reject/{proposal_id}")
def reject_proposal(proposal_id: str):
    """Reject and remove a proposal."""
    ok = agent_service.reject_proposal(proposal_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"status": "rejected"}


@router.get("/monitor")
def get_monitor():
    """Return live position watch data + activity log."""
    try:
        positions_data = broker_service.get_positions()
        net = positions_data.get("net", [])
    except Exception:
        net = []

    return {
        "positions": net,
        "log": agent_service.get_log(),
        "proposals": agent_service.get_proposals(),
    }
