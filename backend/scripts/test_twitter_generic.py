import asyncio
import sys
import os

# Add the parent directory to sys.path to import services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.twitter_service import twitter_service

async def test_generic():
    print("Testing Twitter scraping for #StockMarket...")
    tweets = twitter_service.get_tweets_by_keyword("#StockMarket", limit=5)
    if not tweets:
        print("No tweets found again. Nitter instances might be down.")
        return
    
    print(f"Found {len(tweets)} tweets.")
    for i, t in enumerate(tweets):
        print(f"{i+1}. [{t['user']}]: {t['text'][:100]}...")

if __name__ == "__main__":
    asyncio.run(test_generic())
