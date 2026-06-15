"""Funções puras de parsing — testáveis sem Playwright (F01 RN-05/06/07/08)."""

from __future__ import annotations

import re

# Domínios que NÃO contam como "site de verdade" — alvo da prospecção.
_NAO_SITE = ("instagram.com", "facebook.com", "fb.com", "linktr.ee", "wa.me", "api.whatsapp.com", "linktree")


def normalize_phone_br(raw: str | None) -> str | None:
    """Normaliza telefone BR para E.164 sem '+': 55 + DDD + número.

    Aceita formatos como '(85) 99999-9999', '+55 85 99999-9999', '8533334444'.
    Retorna None se não for um telefone BR plausível (10 ou 11 dígitos locais).
    """
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    # remove código do país se já vier
    if digits.startswith("55") and len(digits) >= 12:
        digits = digits[2:]
    # agora esperamos DDD(2) + número(8 ou 9)
    if len(digits) not in (10, 11):
        return None
    ddd = digits[:2]
    if not ("11" <= ddd <= "99"):
        return None
    return "55" + digits


def classify_website(url: str | None) -> dict:
    """Decide se a empresa TEM site de verdade ou só Instagram/redes.

    Retorna: {has_website, has_instagram, instagram_url}
    - sem url            -> sem site (lead válido)
    - instagram/facebook -> sem site de verdade (lead válido), marca instagram se for o caso
    - outro domínio      -> TEM site (descartar lead)
    """
    if not url:
        return {"has_website": False, "has_instagram": False, "instagram_url": None}
    u = url.strip().lower()
    if "instagram.com" in u:
        return {"has_website": False, "has_instagram": True, "instagram_url": url.strip()}
    if any(d in u for d in _NAO_SITE):
        return {"has_website": False, "has_instagram": False, "instagram_url": None}
    return {"has_website": True, "has_instagram": False, "instagram_url": None}


def parse_reviews(text: str | None) -> int | None:
    """'(1.234)' / '1.234 avaliações' / '12' -> int. None se não achar número."""
    if not text:
        return None
    m = re.search(r"[\d. ]+", text.replace(",", "."))
    if not m:
        return None
    num = re.sub(r"[^\d]", "", m.group())
    return int(num) if num else None


def parse_rating(text: str | None) -> float | None:
    """'4,8' / '4.8 estrelas' -> 4.8. None se inválido ou fora de 0..5."""
    if not text:
        return None
    m = re.search(r"(\d+[.,]\d+|\d+)", text)
    if not m:
        return None
    val = float(m.group(1).replace(",", "."))
    return val if 0.0 <= val <= 5.0 else None
