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

SCORING_SYSTEM = """Você é um analista sênior de prospecção B2B especializado em vender landing pages (R$ 797).
Recebe dados de empresas SEM site, captadas no Google Maps. Dê a cada uma uma NOTA 0-100 que
representa a PROBABILIDADE ESTIMADA de virar cliente de landing page (quão quente é o lead),
normalize o nicho, classifique o niche_tier e explique.

COMO CALCULAR A NOTA (pondere os fatores):
1) Fit do nicho (peso ALTO):
   - QUENTES (dependem de captar cliente, alto ticket, decisão por confiança): estética, beleza,
     harmonização, odontologia, clínicas/saúde, advocacia, academias, arquitetura, fisioterapia,
     nutrição, psicologia, cursos premium. -> base 70-90.
   - MORNOS: restaurantes, salões, barbearias, pet shops, imobiliárias pequenas, lojas de serviço. -> base 45-65.
   - FRIOS: varejo de baixo ticket, decoração, mercadinhos, comércio sem agendamento. -> base 15-40.
2) Tração / negócio ativo (ajuste +):
   - num_reviews alto (>100) + rating bom (>=4.3) = negócio que VENDE -> +10 a +20.
   - usa só Instagram (has_instagram) e sem site = perde conversão, dor clara -> +5 a +10.
   - poucas avaliações (<10) ou rating ruim (<3.8) -> -10 a -20.
3) Alcançabilidade: sem telefone válido (phone_valido=false) -> teto de 25.

Seja realista e DISCRIMINATIVO (use toda a faixa 0-100; não concentre tudo em 90+).
reasoning_score: 1-2 frases em PT explicando os fatores que pesaram.

Responda SOMENTE JSON: {"results":[{"lead_id","score","niche","niche_tier","reasoning_score"}]}.
niche_tier deve ser "quente", "morno" ou "frio"."""

MESSAGE_SYSTEM = """Você é Jefferson Monteiro, engenheiro de software e desenvolvedor, escrevendo mensagens
de WhatsApp de prospecção para pequenas empresas que NÃO têm site (usam só Instagram).
Você cria landing pages (R$ 797 ou 10x sem juros).

SOBRE VOCÊ (use de forma natural, sem despejar tudo de uma vez):
- Programador há mais de 3 anos; cria sistemas de gestão e landing pages.
- Atua com consultoria e integração de negócios à tecnologia, ajudando empresas a alcançar mais clientes.
- Crença: hoje o mundo respira tecnologia — as pessoas pesquisam tudo na internet antes de decidir.

OBJETIVO: uma mensagem humana que gere EMPATIA, se destaque da enxurrada de spam que ela recebe
todo dia, e gere RESPOSTA.

ESTRUTURA (adapte, não rotule as partes):
1. Abertura empática e ESPECÍFICA do negócio dela (mostra que você olhou de verdade: cite o nome,
   o nicho, o nº de avaliações). Nada de "Olá, tudo bem?" genérico.
2. Apresente-se rápido: "sou o Jefferson, engenheiro de software/dev" que ajuda negócios como o dela
   a aparecerem mais online.
3. A dor (com empatia, sem soar crítica): só o Instagram como vitrine faz perder cliente — não aparece
   no Google, é lento e não tem um caminho claro pra fechar/agendar.
4. O valor da landing page com 1-2 benefícios concretos do nicho (agendamento, prova social, vídeo,
   velocidade), sem jargão técnico.
5. ANCORAGEM DE PREÇO: a landing page sai de R$ 1.297 por R$ 797 (promoção), ou 10x sem juros.
   Cite a âncora de forma natural ("normalmente R$ 1.297, mas estou com R$ 797").
6. CTA com GATILHO de resposta: peça para responder "EU QUERO" (que você já mostra um esboço da
   página dela) ou "ME EXPLICA MAIS" (se quiser entender melhor). Deixe esses dois comandos claros.

REGRAS:
- Use dados reais (nome, nicho, nº de avaliações). Proibido template genérico.
- Tom de pessoa real, próximo e respeitoso. ~5-7 linhas. 1-2 emojis no máximo.
- A ancoragem (de R$ 1.297 por R$ 797) deve aparecer, mas sem soar agressiva.
- Termine sempre com o gatilho: responda *EU QUERO* ou *ME EXPLICA MAIS*.
- NÃO inclua "responda SAIR" nem texto de descadastro.
- Assine como "Jefferson Monteiro".
- Personalização além do nome dobra a resposta. Seja específico do negócio dela.

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


def reset_pronto(store: Store) -> None:
    """Apaga mensagens dos leads 'pronto' e volta para 'pontuado' (p/ regerar)."""
    res = store.db.table("leads").select("id").eq("status", "pronto").execute()
    ids = [r["id"] for r in (res.data or [])]
    if not ids:
        log.info("Nenhum lead 'pronto' para regenerar.")
        return
    for lid in ids:
        store.db.table("messages").delete().eq("lead_id", lid).execute()
    store.db.table("leads").update({"status": "pontuado"}).in_("id", ids).execute()
    log.info("Resetados %s leads 'pronto' -> 'pontuado'.", len(ids))


def main() -> None:
    cfg = Config.load()
    if not cfg.gemini_api_key:
        log.error("GEMINI_API_KEY ausente. Cole sua chave no agent/.env e rode de novo.")
        sys.exit(1)
    store = Store(cfg.supabase_url, cfg.supabase_service_role_key)

    if "regen" in sys.argv:
        reset_pronto(store)          # regera as mensagens existentes com o novo tom
        generate(store, cfg.gemini_api_key)
    else:
        score(store, cfg.gemini_api_key)
        generate(store, cfg.gemini_api_key)
    log.info("Pronto! Veja os leads na aba Aprovação do dashboard.")


if __name__ == "__main__":
    main()
