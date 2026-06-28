"""Provider gateway discovery, health, capabilities, and quota endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...providers import ProviderRegistry
from ...providers.registry import get_provider_registry

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("")
async def list_providers(
    registry: ProviderRegistry = Depends(get_provider_registry),
) -> dict[str, Any]:
    providers = []
    for provider in registry.list():
        health = await provider.health()
        providers.append(
            {
                "id": provider.provider_id,
                "name": provider.display_name,
                "enabled": health.enabled,
                "configured": health.configured,
                "status": health.status.value,
                "trust_tier": health.trust_tier.value,
                "requires_key": provider.requires_key,
            }
        )
    return {"providers": providers, "generated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/health")
async def providers_health(
    provider: str | None = Query(default=None),
    registry: ProviderRegistry = Depends(get_provider_registry),
) -> dict[str, Any]:
    try:
        rows = [await registry.get(provider).health()] if provider else await registry.health()
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider") from exc
    return {
        "providers": [row.model_dump(mode="json") for row in rows],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/capabilities")
async def providers_capabilities(
    provider: str | None = Query(default=None),
    registry: ProviderRegistry = Depends(get_provider_registry),
) -> dict[str, Any]:
    try:
        rows = await registry.get(provider).capabilities() if provider else await registry.capabilities()
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider") from exc
    return {
        "capabilities": [row.model_dump(mode="json") for row in rows],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/quota")
async def providers_quota(
    provider: str | None = Query(default=None),
    registry: ProviderRegistry = Depends(get_provider_registry),
) -> dict[str, Any]:
    try:
        if provider:
            quotas = {provider: await registry.get(provider).quota()}
        else:
            quotas = await registry.quota()
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider") from exc
    return {
        "quota": {name: quota.model_dump(mode="json") for name, quota in quotas.items()},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
