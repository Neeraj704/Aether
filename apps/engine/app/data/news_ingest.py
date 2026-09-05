import argparse
import asyncio
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from email.utils import parsedate_to_datetime
import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from ..config import settings
from ..db.session import AsyncSessionLocal, engine
from ..db.models import NewsItemModel

_analyzer: Optional[SentimentIntensityAnalyzer] = None

def get_sentiment_analyzer() -> SentimentIntensityAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = SentimentIntensityAnalyzer()
    return _analyzer

def extract_symbols(categories_str: str, title_str: str, body_str: str) -> List[str]:
    """
    Extracts BTC and/or ETH symbols from categories, title, and body text.
    Returns list of tagged symbols, e.g. ['BTC'], ['ETH'], ['BTC', 'ETH'], or [].
    """
    haystack = f"{categories_str} {title_str} {body_str}".upper()
    symbols = []
    
    if "BTC" in haystack or "BITCOIN" in haystack:
        symbols.append("BTC")
        
    if "ETH" in haystack or "ETHEREUM" in haystack:
        symbols.append("ETH")
        
    return symbols

async def fetch_cryptocompare_news(api_key: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetches news from CryptoCompare min-api if API key is supplied."""
    url = "https://min-api.cryptocompare.com/data/v2/news/?lang=EN"
    headers = {"User-Agent": "AETHER-Execution-Engine/1.0"}
    if api_key:
        headers["authorization"] = f"Apikey {api_key}"

    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                raw_articles = data.get("Data", [])
                formatted = []
                for item in raw_articles[:limit]:
                    ext_id = str(item.get("id") or item.get("guid") or "")
                    pub_on = item.get("published_on")
                    pub_dt = datetime.fromtimestamp(int(pub_on), tz=timezone.utc) if pub_on else datetime.now(timezone.utc)
                    formatted.append({
                        "source": str(item.get("source") or "cryptocompare"),
                        "external_id": ext_id,
                        "title": str(item.get("title", "")).strip(),
                        "body": str(item.get("body", "")).strip(),
                        "url": str(item.get("url", "")),
                        "published_at": pub_dt,
                        "categories": str(item.get("categories", "")),
                    })
                return formatted
    except Exception as e:
        print(f"[News Ingest] CryptoCompare fetch note: {e}")
    return []

async def fetch_rss_news(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetches real-time crypto wire news from top primary feeds (CoinTelegraph, Decrypt).
    """
    rss_feeds = [
        ("cointelegraph", "https://cointelegraph.com/rss"),
        ("decrypt", "https://decrypt.co/feed"),
    ]
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    articles = []

    for source_name, feed_url in rss_feeds:
        try:
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                resp = await client.get(feed_url)
                if resp.status_code == 200:
                    root = ET.fromstring(resp.text)
                    items = root.findall(".//item")
                    for item in items:
                        title_el = item.find("title")
                        link_el = item.find("link")
                        desc_el = item.find("description")
                        pub_el = item.find("pubDate")
                        guid_el = item.find("guid")

                        title = title_el.text.strip() if title_el is not None and title_el.text else ""
                        link = link_el.text.strip() if link_el is not None and link_el.text else ""
                        desc = desc_el.text.strip() if desc_el is not None and desc_el.text else ""
                        # Strip html tags from description if needed
                        if "<" in desc and ">" in desc:
                            import re
                            desc = re.sub("<[^<]+?>", "", desc)

                        guid = guid_el.text.strip() if guid_el is not None and guid_el.text else link
                        if not guid:
                            guid = hashlib.sha256(f"{title}_{link}".encode()).hexdigest()[:24]

                        if pub_el is not None and pub_el.text:
                            try:
                                pub_dt = parsedate_to_datetime(pub_el.text)
                                if pub_dt.tzinfo is None:
                                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                                else:
                                    pub_dt = pub_dt.astimezone(timezone.utc)
                            except Exception:
                                pub_dt = datetime.now(timezone.utc)
                        else:
                            pub_dt = datetime.now(timezone.utc)

                        categories_list = [c.text for c in item.findall("category") if c.text]
                        categories_str = "|".join(categories_list)

                        if title:
                            articles.append({
                                "source": source_name,
                                "external_id": str(guid),
                                "title": title,
                                "body": desc,
                                "url": link,
                                "published_at": pub_dt,
                                "categories": categories_str,
                            })
        except Exception as e:
            print(f"[News Ingest] RSS fetch error for {source_name}: {e}")

    # Sort descending by published_at
    articles.sort(key=lambda x: x["published_at"], reverse=True)
    return articles[:limit]

async def fetch_latest_news(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetches latest crypto news. Tries CryptoCompare first; if unauthenticated,
    seamlessly ingests from primary crypto wire RSS feeds (CoinTelegraph, Decrypt).
    """
    # 1. Try CryptoCompare if key present
    cc_key = getattr(settings, "CRYPTOCOMPARE_API_KEY", None)
    cc_articles = await fetch_cryptocompare_news(api_key=cc_key, limit=limit)
    if cc_articles:
        return cc_articles

    # 2. Wire RSS aggregator
    return await fetch_rss_news(limit=limit)

async def ingest_news_batch(session: AsyncSession, limit: int = 50) -> int:
    """
    Fetches latest news, scores each article with VADER NLP, and upserts into news_items.
    Safe and idempotent with on_conflict_do_nothing on (source, external_id).
    Returns number of newly inserted articles.
    """
    raw_articles = await fetch_latest_news(limit=limit)
    if not raw_articles:
        return 0

    analyzer = get_sentiment_analyzer()
    newly_inserted = 0

    for item in raw_articles:
        ext_id = str(item.get("external_id") or "")
        if not ext_id:
            continue

        source_name = str(item.get("source") or "crypto_feed")
        title = str(item.get("title", "")).strip()
        body = str(item.get("body", "")).strip()
        url = str(item.get("url", ""))
        pub_dt = item.get("published_at") or datetime.now(timezone.utc)

        categories = str(item.get("categories", ""))
        symbols = extract_symbols(categories, title, body)

        snippet = body[:500]
        text_to_score = f"{title}. {snippet}" if snippet else title
        polarity = analyzer.polarity_scores(text_to_score)

        stmt = (
            pg_insert(NewsItemModel)
            .values(
                source=source_name,
                external_id=ext_id,
                title=title,
                body_snippet=snippet,
                url=url,
                published_at=pub_dt,
                symbols=symbols,
                sentiment_compound=polarity.get("compound"),
                sentiment_pos=polarity.get("pos"),
                sentiment_neg=polarity.get("neg"),
                sentiment_neu=polarity.get("neu"),
                fetched_at=datetime.now(timezone.utc),
            )
            .on_conflict_do_nothing(
                index_elements=["source", "external_id"]
            )
        )
        res = await session.execute(stmt)
        if res.rowcount > 0:
            newly_inserted += 1

    await session.commit()
    return newly_inserted

async def ingest_news_batch_job():
    """
    Scheduled job helper executed by AsyncIOScheduler every 15 minutes.
    Catches and logs errors without crashing the engine.
    """
    try:
        async with AsyncSessionLocal() as session:
            count = await ingest_news_batch(session, limit=50)
            if count > 0:
                print(f"[News Ingest Scheduled] Ingested and VADER-scored {count} new headlines.")
    except Exception as e:
        print(f"[News Ingest Scheduled] Job warning: {e}")

async def main():
    parser = argparse.ArgumentParser(description="AETHER News Ingestion and VADER Sentiment Scoring")
    parser.add_argument("--limit", type=int, default=50, help="Number of articles to fetch")
    args = parser.parse_args()

    print(f"[News Ingest] Fetching up to {args.limit} headlines from live crypto feeds...")
    async with AsyncSessionLocal() as session:
        count = await ingest_news_batch(session, limit=args.limit)
        print(f"[News Ingest] Finished. Successfully ingested and VADER-scored {count} new articles.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
