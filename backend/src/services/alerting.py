import os
import logging
from typing import List
from httpx import AsyncClient

logger = logging.getLogger("sabiscore.alerts")
SLACK_WEBHOOK_URL = os.getenv("SLACK_DRIFT_WEBHOOK_URL")

async def trigger_slack_drift_alert(
    http_client: AsyncClient, 
    affected_features: List[str], 
    batch_size: int
) -> None:
    """
    Dispatches a structured alert to Slack utilizing the lifespan-managed HTTP client.
    """
    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_DRIFT_WEBHOOK_URL unset. Skipping Slack notification.")
        return

    feature_list = "\n".join([f"• `{col}`" for col in affected_features[:5]])
    if len(affected_features) > 5:
        feature_list += f"\n• ...and {len(affected_features) - 5} more"

    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚨 SabiScore Data Drift Advisory",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Batch Size Evaluated:* {batch_size} fixtures\n\nStatistical data drift detected. This is a non-blocking advisory signal; automated verdicts and stakes remain unchanged pending operator review."
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Drifting Features (Benjamini–Hochberg corrected):*\n{feature_list}"
                }
            }
        ]
    }

    try:
        response = await http_client.post(SLACK_WEBHOOK_URL, json=payload)
        response.raise_for_status()
        logger.info("Drift advisory successfully dispatched via lifespan client.")
    except Exception as e:
        logger.error(f"Alert dispatch failed: {str(e)}")
