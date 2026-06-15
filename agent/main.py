"""Agente local — loop principal.

Fica escutando a fila scrape_jobs no Supabase. Quando aparece um job, abre o
navegador (real), raspa empresas SEM site no Google Maps e alimenta os leads,
atualizando o contador found_count ao vivo (o dashboard escuta via Realtime).

Uso:
    python main.py        # liga o agente; deixe rodando enquanto for mapear
"""

from __future__ import annotations

import logging
import time

from config import Config
from scraper import maps_scraper
from supabase_client import Store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("agent")


def run_job(cfg: Config, store: Store, job: dict) -> None:
    job_id = job["id"]
    niche, city, target = job["niche"], job["city"], job.get("target_count", 50)
    log.info("Job %s | %s em %s | meta %s", job_id[:8], niche, city, target)

    found = 0

    def on_lead(lead: dict) -> bool:
        nonlocal found
        lead["job_id"] = job_id
        if store.insert_lead(lead):
            found += 1
            store.set_progress(job_id, found)
            log.info("  + %s (%s)  [%s/%s]", lead["name"], lead["phone"], found, target)
            return True
        return False

    try:
        maps_scraper.scrape(
            niche=niche,
            city=city,
            target_count=target,
            headless=cfg.headless,
            min_delay_ms=cfg.min_delay_ms,
            max_delay_ms=cfg.max_delay_ms,
            on_lead=on_lead,
        )
        store.finish_job(job_id, "done")
        log.info("Job %s concluído: %s leads.", job_id[:8], found)
    except maps_scraper.CaptchaDetected as e:
        store.finish_job(job_id, "error", "Bloqueio/CAPTCHA detectado. Tente mais tarde.")
        log.warning("Job %s: CAPTCHA em %s", job_id[:8], e.url)
    except Exception as e:  # noqa: BLE001
        store.finish_job(job_id, "error", f"Erro inesperado: {e}")
        log.exception("Job %s falhou", job_id[:8])


def main() -> None:
    cfg = Config.load()
    store = Store(cfg.supabase_url, cfg.supabase_service_role_key)
    log.info("Agente local ligado. Escutando a fila a cada %ss… (Ctrl+C para sair)", cfg.poll_interval_seconds)

    while True:
        try:
            job = store.claim_next_job()
            if job:
                run_job(cfg, store, job)
            else:
                time.sleep(cfg.poll_interval_seconds)
        except KeyboardInterrupt:
            log.info("Encerrando agente.")
            break
        except Exception:  # noqa: BLE001
            log.exception("Erro no loop principal; aguardando e retomando…")
            time.sleep(cfg.poll_interval_seconds)


if __name__ == "__main__":
    main()
