from ntscraper import Nitter
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class TwitterService:
    def __init__(self):
        self.nitter = Nitter(log_level=1)
        # List of reliable Nitter instances if needed, but ntscraper handles this
        
    def get_tweets_by_keyword(self, keyword: str, limit: int = 15) -> List[Dict[str, Any]]:
        """
        Scrapes tweets for a given keyword/hashtag/cashtag using Nitter.
        """
        try:
            logger.info(f"Scraping tweets for: {keyword}")
            # mode='term' for general search, 'hashtag' for #, 'user' for @
            # For stocks, 'term' is best for $CASHTAGS
            results = self.nitter.get_tweets(keyword, mode='term', number=limit)
            
            tweets = []
            if 'tweets' in results:
                for t in results['tweets']:
                    tweets.append({
                        "text": t.get('text'),
                        "date": t.get('date'),
                        "user": t.get('user', {}).get('name'),
                        "link": t.get('link'),
                        "stats": t.get('stats', {})
                    })
            return tweets
        except Exception as e:
            logger.error(f"Error scraping Twitter for {keyword}: {e}")
            return []

    def get_stock_mentions(self, symbol: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Specifically searches for stock cashtags (e.g., $RELIANCE).
        """
        cashtag = f"${symbol}"
        return self.get_tweets_by_keyword(cashtag, limit=limit)

twitter_service = TwitterService()
