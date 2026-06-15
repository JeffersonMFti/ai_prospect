"""Scraper do Google Maps (Playwright, navegador REAL — Constitution: headless proibido).

Estratégia em 2 fases (mais robusta que clicar card a card):
  Fase 1 — na lista de resultados, rola e COLETA (nome via aria-label + href) de cada empresa.
  Fase 2 — abre cada empresa pela URL, extrai telefone/site e decide se é lead válido
           (F01 RN-05: só quem NÃO tem site de verdade).

⚠️ O DOM do Maps muda com frequência. Seletores isolados em SELECTORS.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from playwright.sync_api import Page, TimeoutError as PWTimeout, sync_playwright

try:
    from playwright_stealth import stealth_sync
except Exception:  # noqa: BLE001
    stealth_sync = None

from . import human_behavior as hb
from . import parsers

log = logging.getLogger("agent.scraper")

SELECTORS = {
    "results_feed": 'div[role="feed"]',
    "result_link": 'a[href*="/maps/place/"]',
    "detail_name": "h1.DUwDvf",
    "website_btn": 'a[data-item-id="authority"]',
    "phone_btn": '[data-item-id^="phone:tel:"]',
    "rating": "div.F7nice span[aria-hidden='true']",
    "reviews": "div.F7nice span[aria-label*='avalia']",
    "category": "button.DkEaL",
}

CAPTCHA_HINTS = ("/sorry/", "unusual traffic", "recaptcha", "tráfego incomum")
BAD_NAMES = {"resultados", "results", ""}


class CaptchaDetected(Exception):
    def __init__(self, url: str) -> None:
        self.url = url
        super().__init__(url)


def build_query(niche: str, city: str) -> str:
    return f"{niche} em {city}".strip()


def _text(page: Page, selector: str) -> str | None:
    try:
        el = page.query_selector(selector)
        return el.inner_text().strip() if el else None
    except Exception:  # noqa: BLE001
        return None


def _attr(page: Page, selector: str, attr: str) -> str | None:
    try:
        el = page.query_selector(selector)
        return el.get_attribute(attr) if el else None
    except Exception:  # noqa: BLE001
        return None


def _check_captcha(page: Page) -> None:
    url = (page.url or "").lower()
    if any(h in url for h in CAPTCHA_HINTS):
        raise CaptchaDetected(page.url)


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
            # ---- Fase 1: coletar candidatos (nome + href) da lista ----
            page.goto(f"https://www.google.com/maps/search/{query}", wait_until="domcontentloaded")
            hb.human_pause(min_delay_ms, max_delay_ms)
            _check_captcha(page)

            try:
                page.wait_for_selector(SELECTORS["results_feed"], timeout=20000)
            except PWTimeout:
                log.warning("Lista de resultados não carregou para '%s'", query)
                return inserted

            candidates = _collect_candidates(page, target_count, min_delay_ms, max_delay_ms)
            log.info("Coletados %s candidatos na lista.", len(candidates))

            # ---- Fase 2: abrir cada empresa e extrair ----
            for name, href in candidates:
                if inserted >= target_count:
                    break
                try:
                    page.goto(href, wait_until="domcontentloaded")
                    hb.human_pause(min_delay_ms, max_delay_ms)
                    _check_captcha(page)
                    page.wait_for_selector(SELECTORS["detail_name"], timeout=8000)
                except CaptchaDetected:
                    raise
                except Exception:  # noqa: BLE001
                    continue

                lead = _extract_detail(page, href, fallback_name=name)
                if lead is None:
                    continue
                lead["niche"] = niche
                if on_lead(lead):
                    inserted += 1
                hb.human_mouse_wiggle(page)

            return inserted
        finally:
            context.close()
            browser.close()


def _collect_candidates(
    page: Page, target_count: int, min_delay_ms: int, max_delay_ms: int
) -> list[tuple[str, str]]:
    """Rola a lista e coleta (nome, href) únicos. Coleta ~2x a meta (muitos têm site)."""
    want = max(target_count * 2, target_count + 10)
    seen: dict[str, str] = {}  # href -> name
    stale = 0

    while len(seen) < want and stale < 6:
        links = page.query_selector_all(f'{SELECTORS["results_feed"]} {SELECTORS["result_link"]}')
        before = len(seen)
        for link in links:
            try:
                href = link.get_attribute("href")
                name = (link.get_attribute("aria-label") or "").strip()
            except Exception:  # noqa: BLE001
                continue
            if href and href not in seen and name.lower() not in BAD_NAMES:
                seen[href] = name
        stale = stale + 1 if len(seen) == before else 0
        hb.human_scroll(page, SELECTORS["results_feed"])
        hb.human_pause(min_delay_ms // 2, max_delay_ms // 2)

    return [(name, href) for href, name in seen.items()]


def _extract_detail(page: Page, maps_url: str, *, fallback_name: str) -> dict | None:
    """Extrai dados da página de detalhe. Retorna None se deve descartar o lead."""
    name = _text(page, SELECTORS["detail_name"]) or fallback_name
    if not name or name.strip().lower() in BAD_NAMES:
        return None

    website = _attr(page, SELECTORS["website_btn"], "href")
    site = parsers.classify_website(website)
    if site["has_website"]:
        return None  # tem site de verdade -> descartar

    # telefone: aria-label do botão de telefone (ex.: "Telefone: (85) 3333-4444")
    raw_phone = None
    el = page.query_selector(SELECTORS["phone_btn"])
    if el:
        raw_phone = el.get_attribute("aria-label") or el.inner_text()
    phone = parsers.normalize_phone_br(raw_phone)
    if not phone:
        return None  # sem telefone válido -> inútil

    return {
        "name": name.strip(),
        "phone": phone,
        "raw_phone": (raw_phone or "").strip() or None,
        "category_maps": _text(page, SELECTORS["category"]),
        "rating": parsers.parse_rating(_text(page, SELECTORS["rating"])),
        "num_reviews": parsers.parse_reviews(_text(page, SELECTORS["reviews"])),
        "has_instagram": site["has_instagram"],
        "instagram_url": site["instagram_url"],
        "has_website": False,
        "maps_url": maps_url,
        "status": "novo",
    }
