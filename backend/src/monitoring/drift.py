import asyncio
import pandas as pd
from typing import Dict, Any
from opentelemetry import metrics
from httpx import AsyncClient
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset
from src.services.alerting import trigger_slack_drift_alert

meter = metrics.get_meter("sabiscore.mlops")
drift_counter = meter.create_counter(
    "sabiscore_data_drift_events",
    description="Number of confirmed data drift events post-FDR correction"
)

class DriftMonitor:
    def __init__(self, reference_path: str):
        self.reference_df = pd.read_parquet(reference_path)
        
    def _run_evidently_sync(self, current_df: pd.DataFrame) -> Dict[str, Any]:
        """
        CPU-bound operation isolated from the async event loop.
        Constructs a fresh Report instance per evaluation to prevent state corruption.
        """
        report = Report(metrics=[DataDriftPreset()])
        report.run(reference_data=self.reference_df, current_data=current_df)
        return report.as_dict()

    async def evaluate_batch(self, http_client: AsyncClient, current_batch_df: pd.DataFrame):
        """
        Executes drift evaluation securely off-thread and handles OTel/Slack integration.
        """
        batch_size = len(current_batch_df)
        
        # Offload the synchronous, CPU-heavy Evidently math
        report_dict = await asyncio.to_thread(self._run_evidently_sync, current_batch_df)
        
        dataset_drift = report_dict["metrics"][0]["result"]["dataset_drift"]
        
        if dataset_drift:
            # Note: Ensure Evidently's data drift preset is configured with the 
            # Benjamini-Hochberg FDR correction in its internal options.
            drifting_features = report_dict["metrics"][0]["result"]["drift_by_columns"]
            affected_columns = [col for col, data in drifting_features.items() if data.get("drift_detected")]
            
            # Record via OpenTelemetry
            drift_counter.add(1, {"severity": "advisory"})
            
            # Fire non-blocking Slack Alert via lifespan client
            await trigger_slack_drift_alert(
                http_client=http_client,
                affected_features=affected_columns,
                batch_size=batch_size
            )
            
        return report_dict
