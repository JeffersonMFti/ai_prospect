"""Enriquecimento local com IA (alternativa às Edge Functions p/ rodar sem deploy).

Faz o mesmo que score-leads + generate-messages, mas em Python, na sua máquina:
  1) pontua os leads 'novo' (nota 0-100 + niche_tier) -> 'pontuado'
  2) gera mensagem + justificativa para os melhores do dia -> 'pronto'

Uso:
    .venv/Scripts/python.exe enrich.py

Requer GEMINI_API_KEY no agent/.env. Prompts: specs/04-ai-prompts.md
"""

from __future__ import annotations

import json
import logging
import sys
import time

import httpx

from config import Config
from supabase_client import Store

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("enrich")

MODEL = "gemini-2.5-flash"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

SCORING_SYSTEM = """Você é um analista de prospecção B2B especializado em vender landing pages (R$ 797).
Recebe dados de empresas SEM site, captadas no Google Maps.
Dê uma NOTA de 0 a 100 (quão promissor é como cliente de landing page),
normalize o nicho, classifique o niche_tier e explique o porquê.

Fatos de mercado:
- QUENTES (alta conversão em LP, dependem de captar cliente): estética, beleza, harmonização,
  odontologia, clínicas/saúde, advocacia, academias, serviços de alto ticket.
- MORNOS: restaurantes, salões, pet shops, cursos, imobiliárias pequenas.
- FRIOS: varejo de baixo ticket, decoração, comércio sem agendamento.
- Muitas avaliações + boa nota + só Instagram (sem site) = lead muito quente.
- Sem telefone válido = nota baixa.

Responda SOMENTE JSON: {"results":[{"lead_id","score","niche","niche_tier","reasoning_score"}]}.
niche_tier deve ser "quente", "morno" ou "frio". reasoning_score em PT, 1-2 frases."""

MESSAGE_SYSTEM = """Você é copywriter de prospecção que vende landing pages para pequenas empresas via WhatsApp.
Produto: landing page por R$ 797 (ou 10x sem juros). Objetivo: mensagem curta, personalizada e
consultiva que gere RESPOSTA (não soa spam).

Regras:
- Use dados reais do lead (nome, nicho, nº de avaliações). Proibido template genérico.
- Conecte com a dor: só Instagram como site perde conversão (sem CTA, lento, não rankeia).
- Cite 1-2 benefícios de LP relevantes ao nicho. Fatos: vídeo +86%, mobile 54%,
  velocidade (cada 1s -4,4%), prova social +10-20%, CTA/form curto +120%.
- Tom humano, ~4-5 linhas, 1 CTA, inclua opção "responda SAIR".
- Personalização além do nome dobra a resposta. Seja específico.

Responda SOMENTE JSON: {"results":[{"lead_id","message","justification"}]}."""

TIERS = {"quente", "morno", "frio"}


def _call_gemini(api_key: str, system: str, user: str) -> dict:
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.7},
    }
    last_err: Exception | None = None
    for attempt in range(5):
        try:
            with httpx.Client(timeout=120) as client:
                r = client.post(f"{ENDPOINT}?key={api_key}", json=body)
            if r.status_code in (429, 500, 502, 503, 504):
                wait = 2 ** attempt
                log.warning("Gemini %s (sobrecarga). Tentando de novo em %ss…", r.status_code, wait)
                time.sleep(wait)
                continue
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except httpx.HTTPStatusError as e:
            last_err = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Gemini falhou após 5 tentativas: {last_err}")


def score(store: Store, api_key: str) -> int:
    res = store.db.table("leads").select("*").eq("status", "novo").limit(50).execute()
    leads = res.data or []
    if not leads:
        log.info("Nenhum lead 'novo' para pontuar.")
        return 0
    payload = [
        {
            "lead_id": l["id"],
            "name": l["name"],
            "category_maps": l.get("category_maps"),
            "rating": l.get("rating"),
            "num_reviews": l.get("num_reviews"),
            "has_instagram": l.get("has_instagram"),
            "phone_valido": bool(l.get("phone")),
        }
        for l in leads
    ]
    user = f"Pontue os leads. Devolva lead_id, score (0-100), niche, niche_tier, reasoning_score.\n\n{json.dumps(payload, ensure_ascii=False)}"
    out = _call_gemini(api_key, SCORING_SYSTEM, user)
    n = 0
    for r in out.get("results", []):
        if r.get("niche_tier") not in TIERS or not isinstance(r.get("score"), (int, float)):
            continue
        store.db.table("leads").update(
            {
                "score": int(round(r["score"])),
                "niche": r.get("niche"),
                "niche_tier": r["niche_tier"],
                "reasoning_score": r.get("reasoning_score"),
                "status": "pontuado",
            }
        ).eq("id", r["lead_id"]).eq("status", "novo").execute()
        n += 1
    log.info("Pontuados: %s", n)
    return n


def generate(store: Store, api_key: str) -> int:
    s = store.db.table("settings").select("*").eq("id", 1).single().execute().data or {}
    limit = s.get("daily_send_limit", 6)
    res = (
        store.db.table("leads")
        .select("*, messages(id)")
        .eq("status", "pontuado")
        .order("score", desc=True)
        .limit(limit * 3)
        .execute()
    )
    pend = [l for l in (res.data or []) if not l.get("messages")][:limit]
    if not pend:
        log.info("Nenhum lead 'pontuado' sem mensagem.")
        return 0
    payload = [
        {
            "lead_id": l["id"],
            "name": l["name"],
            "niche": l.get("niche"),
            "niche_tier": l.get("niche_tier"),
            "num_reviews": l.get("num_reviews"),
            "has_instagram": l.get("has_instagram"),
            "city": s.get("default_city") or "",
        }
        for l in pend
    ]
    user = (
        f"Escreva a mensagem para cada lead. Devolva lead_id, message, justification.\n\n"
        f"{json.dumps(payload, ensure_ascii=False)}\n"
        f"Assinatura: {s.get('message_signature', '')}\nPreço: {s.get('price_text', 'R$ 797 ou 10x sem juros')}"
    )
    out = _call_gemini(api_key, MESSAGE_SYSTEM, user)
    n = 0
    for r in out.get("results", []):
        if not r.get("lead_id") or not (r.get("message") or "").strip():
            continue
        store.db.table("messages").insert(
            {
                "lead_id": r["lead_id"],
                "text": r["message"].strip(),
                "justification": (r.get("justification") or "").strip(),
                "model_used": MODEL,
            }
        ).execute()
        store.db.table("leads").update({"status": "pronto"}).eq("id", r["lead_id"]).eq("status", "pontuado").execute()
        n += 1
    log.info("Mensagens geradas: %s", n)
    return n


def main() -> None:
    cfg = Config.load()
    if not cfg.gemini_api_key:
        log.error("GEMINI_API_KEY ausente. Cole sua chave no agent/.env e rode de novo.")
        sys.exit(1)
    store = Store(cfg.supabase_url, cfg.supabase_service_role_key)
    score(store, cfg.gemini_api_key)
    generate(store, cfg.gemini_api_key)
    log.info("Pronto! Veja os leads na aba Aprovação do dashboard.")


if __name__ == "__main__":
    main()
