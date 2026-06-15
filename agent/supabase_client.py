"""Acesso ao Supabase pelo agente (service_role). Implementa o contrato C5.

Protocolo da fila (specs/03-api-contracts.md §Agente local):
  - claim atômico de scrape_jobs pending -> running
  - incremento de found_count por lead inserido
  - dedupe de leads por telefone (on conflict do nothing)
  - finalização do job (done/error)
"""

from __future__ import annotations

import logging
from typing import Any

from supabase import Client, create_client

log = logging.getLogger("agent.supabase")


class Store:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.db: Client = create_client(url, service_role_key)

    # ---- fila ----------------------------------------------------------------
    def claim_next_job(self) -> dict[str, Any] | None:
        """Pega o job pending mais antigo e marca running (claim atômico simples)."""
        pending = (
            self.db.table("scrape_jobs")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(1)
            .execute()
        )
        if not pending.data:
            return None
        job = pending.data[0]
        # claim: só vence se ainda estiver pending
        claimed = (
            self.db.table("scrape_jobs")
            .update({"status": "running", "started_at": "now()"})
            .eq("id", job["id"])
            .eq("status", "pending")
            .execute()
        )
        if not claimed.data:
            return None  # outro processo pegou primeiro
        return claimed.data[0]

    def set_progress(self, job_id: str, found_count: int) -> None:
        self.db.table("scrape_jobs").update({"found_count": found_count}).eq("id", job_id).execute()

    def finish_job(self, job_id: str, status: str, error_message: str | None = None) -> None:
        self.db.table("scrape_jobs").update(
            {"status": status, "finished_at": "now()", "error_message": error_message}
        ).eq("id", job_id).execute()

    # ---- leads ---------------------------------------------------------------
    def insert_lead(self, lead: dict[str, Any]) -> bool:
        """Insere um lead. Retorna True se inseriu, False se era duplicado (telefone).

        Usa insert simples e trata violação de unicidade como duplicado — compatível
        com o índice único parcial em phone (on_conflict não funciona com índice parcial).
        """
        try:
            res = self.db.table("leads").insert(lead).execute()
            return bool(res.data)
        except Exception as e:  # noqa: BLE001
            msg = str(e).lower()
            if "23505" in msg or "duplicate" in msg or "unique" in msg:
                return False  # telefone já existe -> duplicado, ok
            log.warning("Falha ao inserir lead %s: %s", lead.get("name"), e)
            return False
