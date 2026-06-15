"""Scraper do Google Maps (Playwright, navegador REAL — Constitution: headless proibido).

Estratégia: abre a busca, percorre a lista de resultados, abre cada empresa e
extrai dados. Considera lead VÁLIDO apenas quem NÃO tem site de verdade (F01 RN-05).

⚠️ O DOM do Maps muda com frequência. Todos os seletores ficam em SELECTORS para
manutenção fácil. Se a captura zerar, é aqui que se ajusta.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass

from playwright.sync_api import Page, TimeoutError as PWTimeout, sync_playwright

try:
    from playwright_stealth import stealth_sync
except Exception:  # noqa: BLE001
    stealth_sync = None  # stealth é opcional

from . import human_behavior as hb
from . import parsers

log = logging.getLogger("agent.scraper")

# Seletores isolados para manutenção (podem precisar de ajuste se o Maps mudar).
SELECTORS = {
    "results_feed": 'div[role="feed"]',
    "result_card": 'div[role="feed"] a[href*="/maps/place/"]',
    "detail_name": 'h1.DUwDvf, h1',
    "website_btn": 'a[data-item-id="authority"]',
    "phone_btn": 'button[data-item-id^="phone"], a[data-item-id^="phone"]',
    "rating": 'div.F7nice span[aria-hidden="true"]',
    "reviews": 'div.F7nice span[aria-label*="avalia"], div.F7nice',
    "category": 'button[jsaction*="category"], div.fontBodyMedium button',
}

CAPTCHA_HINTS = ("/sorry/", "unusual traffic", "recaptcha", "tráfego incomum")


@dataclass
class CaptchaDetected(Exception):
    url: str


def _detail_text(page: Page, selector: str) -> str | None:
    try:
        el = page.query_selector(selector)
        return el.inner_text().strip() if el else None
    except Exception:  # noqa: BLE001
        return None


def _detail_attr(page: Page, selector: str, attr: str) -> str | None:
    try:
        el = page.query_selector(selector)
        return el.get_attribute(attr) if el else None
    except Exception:  # noqa: BLE001
        return None


def _check_captcha(page: Page) -> None:
    url = (page.url or "").lower()
    body = ""
    try:
        body = (page.content() or "").lower()[:5000]
    except Exception:  # noqa: BLE001
        pass
    if any(h in url or h in body for h in CAPTCHA_HINTS):
        raise CaptchaDetected(page.url)


def build_query(niche: str, city: str) -> str:
    return f"{niche} em {city}".strip()


def scrape(
    *,
    niche: str,
    city: str,
    target_count: int,
    headless: bool,
    min_delay_ms: int,
    max_delay_ms: int,
    on_lead: Callable[[dict], bool],
) -> int:
    """Roda o scraping. Chama on_lead(lead) para cada lead VÁLIDO encontrado.

    on_lead deve retornar True se o lead foi inserido (não duplicado).
    Retorna a quantidade de leads inseridos. Levanta CaptchaDetected em bloqueio.
    """
    inserted = 0
    query = build_query(niche, city)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            locale="pt-BR",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        if stealth_sync:
            try:
                stealth_sync(page)
            except Exception:  # noqa: BLE001
                pass

        try:
            page.goto(f"https://www.google.com/maps/search/{query}", wait_until="domcontentloaded")
            hb.human_pause(min_delay_ms, max_delay_ms)
            _check_captcha(page)

            try:
                page.wait_for_selector(SELECTORS["results_feed"], timeout=15000)
            except PWTimeout:
                log.warning("Lista de resultados não carregou para '%s'", query)
                return inserted

            seen_hrefs: set[str] = set()
            stale_rounds = 0

            while inserted < target_count and stale_rounds < 5:
                cards = page.query_selector_all(SELECTORS["result_card"])
                new_in_round = 0

                for card in cards:
                    if inserted >= target_count:
                        break
                    href = card.get_attribute("href")
                    if not href or href in seen_hrefs:
                        continue
                    seen_hrefs.add(href)
                    new_in_round += 1

                    try:
                        card.click()
                        hb.human_pause(min_delay_ms, max_delay_ms)
                        _check_captcha(page)
                        page.wait_for_selector(SELECTORS["detail_name"], timeout=8000)
                    except (PWTimeout, Exception):  # noqa: BLE001
                        continue

                    lead = _extract_detail(page, href)
                    if lead is None:
                        continue  # tem site de verdade, ou sem telefone -> descartado

                    lead["niche"] = niche
                    if on_lead(lead):
                        inserted += 1

                    hb.human_mouse_wiggle(page)

                # rolar para carregar mais
                hb.human_scroll(page, SELECTORS["results_feed"])
                stale_rounds = stale_rounds + 1 if new_in_round == 0 else 0

            return inserted
        finally:
            context.close()
            browser.close()


def _extract_detail(page: Page, maps_url: str) -> dict | None:
    """Extrai dados do painel de detalhe. Retorna None se deve descartar o lead."""
    name = _detail_text(page, SELECTORS["detail_name"])
    if not name:
        return None

    website = _detail_attr(page, SELECTORS["website_btn"], "href")
    site = parsers.classify_website(website)
    if site["has_website"]:
        return None  # F01 RN-05: tem site de verdade -> descartar

    raw_phone = None
    phone_el = page.query_selector(SELECTORS["phone_btn"])
    if phone_el:
        raw_phone = phone_el.get_attribute("aria-label") or phone_el.inner_text()
    phone = parsers.normalize_phone_br(raw_phone)
    if not phone:
        return None  # F01 RN-07: sem telefone válido -> inútil

    return {
        "name": name,
        "phone": phone,
        "raw_phone": (raw_phone or "").strip() or None,
        "category_maps": _detail_text(page, SELECTORS["category"]),
        "rating": parsers.parse_rating(_detail_text(page, SELECTORS["rating"])),
        "num_reviews": parsers.parse_reviews(_detail_text(page, SELECTORS["reviews"])),
        "has_instagram": site["has_instagram"],
        "instagram_url": site["instagram_url"],
        "has_website": False,
        "maps_url": maps_url,
        "status": "novo",
    }
