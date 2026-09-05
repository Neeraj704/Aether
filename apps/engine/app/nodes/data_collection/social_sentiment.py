from typing import Any, Dict, Optional
from ..base import NodeContext
from .news_stream import NewsStreamNode

class SocialSentimentNode:
    """
    Social Sentiment Node.
    Uses aggregate news sentiment as an honest proxy for market social mood in the
    absence of a live Twitter/Reddit firehose integration.
    """
    component_id = "social-sentiment"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._delegate = NewsStreamNode(self.config)

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        output = await self._delegate.run(ctx, config)
        output["sourceNote"] = "Derived from news headline sentiment (no live social media firehose integrated yet)."
        return output
