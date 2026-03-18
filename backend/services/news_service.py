import requests
import datetime
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class NewsService:
    def __init__(self):
        self.url = "https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w"
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": "https://www.bseindia.com",
            "Referer": "https://www.bseindia.com/",
        })

    def get_latest_announcements(self, fetch_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetches corporate announcements from BSE.
        If fetch_date is not provided, uses today's date (YYYYMMDD).
        """
        # Try to visit the main page first to get cookies if needed
        try:
            self.session.get("https://www.bseindia.com/", timeout=5)
        except:
            pass

        date_str = fetch_date or datetime.datetime.now().strftime("%Y%m%d")
        params = {
            "pageno": "1",
            "strCat": "-1",
            "strPrevDate": date_str, 
            "strToDate": date_str,
            "strType": "C"
        }

        try:
            response = self.session.get(self.url, params=params, timeout=10)
            response.raise_for_status()
            try:
                announcements = response.json()
                if "Table" in announcements:
                    return announcements["Table"]
                return []
            except Exception as json_err:
                logger.error(f"JSON Decode Error from BSE API: {json_err}")
                if "<html>" in response.text.lower():
                    logger.warning("BSE API returned HTML instead of JSON. Likely a block or redirect.")
                logger.debug(f"Raw Response: {response.text[:500]}...")
                return []
        except Exception as e:
            logger.error(f"Error fetching BSE announcements: {e}")
            return []

    def format_announcement_for_llm(self, announcement: Dict[str, Any]) -> str:
        """
        Formats a single announcement into a string for LLM analysis.
        """
        stock_name = announcement.get('SLONGNAME', 'Unknown')
        headline = announcement.get('NEWSSUB', 'No Headline')
        attachment = announcement.get('ATTACHMENTNAME', '')
        pdf_link = f"https://www.bseindia.com/xml-data/corpfiling/AttachLive/{attachment}" if attachment else "No PDF available"
        
        return f"Stock: {stock_name}\nHeadline: {headline}\nPDF Link: {pdf_link}"

news_service = NewsService()
