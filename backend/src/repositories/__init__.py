"""Persistence repositories for SabiScore domain queries.

Repositories keep database selection rules out of scripts and services so the
same settled-fixture definition is reused by evaluation, drift baselines, and
result-settlement workflows.
"""

from .fixtures import get_settled_fixtures

__all__ = ["get_settled_fixtures"]
