"""Deprecated health router placeholder.

The consolidated monitoring router (``monitoring.py``) now provides all
health/readiness/metrics/startup endpoints. This module is intentionally kept
minimal to avoid import errors for legacy code paths while preventing duplicate
route registration.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])
