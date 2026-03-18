import asyncio
import sys
import os
import logging
import datetime

# Configure logging to see output from services
logging.basicConfig(level=logging.DEBUG, format='%(levelname)s: %(message)s')

# Add the project root to sys.path to allow relative imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.services.decision_engine import decision_engine
from backend.services.news_service import news_service

async def test_news_flow():
    print("--- Starting News-Driven Trading Flow Test ---")
    
    # 1. Fetch latest announcements
    print("Fetching announcements from BSE for today...")
    announcements = news_service.get_latest_announcements()
    
    if not announcements:
        yesterday = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y%m%d")
        print(f"No announcements for today. Trying yesterday ({yesterday})...")
        announcements = news_service.get_latest_announcements(fetch_date=yesterday)
    
    print(f"Found {len(announcements)} announcements.")
    
    if not announcements:
        print("Still no announcements found. The API might be working but has no data for these dates.")
        return

    # 2. Process and analyze (Mocking the broker part if needed, but decision_engine.process_news_and_trade handles it)
    print("\nProcessing top 3 announcements...")
    results = await decision_engine.process_news_and_trade()
    
    for i, res in enumerate(results):
        print(f"\n[{i+1}] Stock: {res.get('stock')}")
        print(f"Headline: {res.get('headline')}")
        analysis = res.get('analysis', {})
        print(f"Action: {analysis.get('action')} (Confidence: {analysis.get('confidence')})")
        print(f"Reason: {analysis.get('reason')}")
        
        if "order_id" in res:
            print(f"SUCCESS: Order placed! ID: {res['order_id']}")
        elif "error" in res:
            print(f"ERROR placing order: {res['error']}")
        else:
            print("No order placed (Action was HOLD or confidence too low).")

if __name__ == "__main__":
    asyncio.run(test_news_flow())
