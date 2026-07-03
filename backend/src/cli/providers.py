"""Provider gateway CLI commands."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import click

from ..providers import build_provider_registry


def _print_json(payload: Any) -> None:
    click.echo(json.dumps(payload, indent=2, sort_keys=True, default=str))


@click.group()
def providers_cli() -> None:
    """Inspect provider configuration, capabilities, and quotas."""


@providers_cli.command("doctor")
@click.option("--provider", "provider_id", default=None, help="Provider id to inspect")
def doctor(provider_id: str | None) -> None:
    async def run() -> None:
        _print_json(await build_provider_registry().doctor(provider_id))

    asyncio.run(run())


@providers_cli.command("capabilities")
@click.option("--provider", "provider_id", default=None, help="Provider id to inspect")
def capabilities(provider_id: str | None) -> None:
    async def run() -> None:
        registry = build_provider_registry()
        rows = await registry.get(provider_id).capabilities() if provider_id else await registry.capabilities()
        _print_json({"capabilities": [row.model_dump(mode="json") for row in rows]})

    asyncio.run(run())


@providers_cli.command("quota")
@click.option("--provider", "provider_id", default=None, help="Provider id to inspect")
def quota(provider_id: str | None) -> None:
    async def run() -> None:
        registry = build_provider_registry()
        if provider_id:
            values = {provider_id: await registry.get(provider_id).quota()}
        else:
            values = await registry.quota()
        _print_json({"quota": {name: value.model_dump(mode="json") for name, value in values.items()}})

    asyncio.run(run())


@providers_cli.command("status")
def status() -> None:
    """Summary health table: configured | missing | invalid | quota_exhausted | temporarily_unavailable."""
    async def run() -> None:
        registry = build_provider_registry()
        healths = await registry.health()
        rows = []
        for h in healths:
            if not h.enabled:
                state = "disabled"
            elif not h.configured:
                state = "missing"
            elif h.status.value in ("CIRCUIT_OPEN", "UNAVAILABLE"):
                state = "temporarily_unavailable"
            elif h.status.value in ("INVALID",):
                state = "invalid"
            elif h.status.value in ("RATE_LIMITED",):
                state = "quota_exhausted"
            else:
                # VERIFIED and CONFIGURED_UNVERIFIED both mean the credential
                # is present; only the live-probe result differs.
                state = "configured"
            rows.append({
                "provider": h.provider,
                "state": state,
                "configured": h.configured,
                "warnings": h.warnings,
            })
        _print_json({"status": rows})

    asyncio.run(run())


if __name__ == "__main__":
    providers_cli()
