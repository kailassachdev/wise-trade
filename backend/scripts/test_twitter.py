import asyncio
import sys
import os

# Add the parent directory to sys.path to import services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.twitter_service import twitter_service
from services.ollama_service import ollama_service

async def test_scraping():
    print("Testing Twitter scraping for $RELIANCE...")
    tweets = twitter_service.get_stock_mentions("RELIANCE", limit=5)
    if not tweets:
        print("No tweets found. This might be due to Nitter instance rate limits or connectivity issues.")
        return
    
    print(f"Found {len(tweets)} tweets.")
    for i, t in enumerate(tweets):
        print(f"{i+1}. [{t['user']}]: {t['text'][:100]}...")

    print("\nTesting DeepSeek analysis of tweets...")
    analysis = await ollama_service.analyze_social_media("RELIANCE", tweets)
    print("Analysis Result:")
    print(analysis)

if __name__ == "__main__":
    asyncio.run(test_scraping())
