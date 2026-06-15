"""Configuração lida do ambiente (.env). Nada hardcoded — Constitution §4."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "sim"}


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    gemini_api_key: str | None
    poll_interval_seconds: int
    headless: bool
    min_delay_ms: int
    max_delay_ms: int

    @staticmethod
    def load() -> "Config":
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. Configure agent/.env"
            )
        return Config(
            supabase_url=url,
            supabase_service_role_key=key,
            gemini_api_key=os.environ.get("GEMINI_API_KEY") or None,
            poll_interval_seconds=int(os.environ.get("POLL_INTERVAL_SECONDS", "5")),
            headless=_bool("HEADLESS", False),
            min_delay_ms=int(os.environ.get("MIN_DELAY_MS", "2000")),
            max_delay_ms=int(os.environ.get("MAX_DELAY_MS", "6000")),
        )
