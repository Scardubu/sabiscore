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


if __name__ == "__main__":
    providers_cli()
