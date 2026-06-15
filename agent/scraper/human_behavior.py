"""Comportamento humano para o scraper (F01 RN-04): delays, scroll, mouse."""

from __future__ import annotations

import random
import time


def jitter_ms(min_ms: int, max_ms: int) -> int:
    """Retorna um atraso aleatório (ms) dentro da faixa [min_ms, max_ms]."""
    lo, hi = sorted((max(0, min_ms), max(0, max_ms)))
    return random.randint(lo, hi)


def human_pause(min_ms: int, max_ms: int) -> None:
    time.sleep(jitter_ms(min_ms, max_ms) / 1000.0)


def human_scroll(page, container_selector: str, steps: int = 3, min_ms: int = 600, max_ms: int = 1600) -> None:
    """Scroll incremental num container (lista de resultados do Maps)."""
    for _ in range(steps):
        try:
            page.eval_on_selector(
                container_selector,
                "(el) => el.scrollBy(0, el.clientHeight * (0.6 + Math.random() * 0.4))",
            )
        except Exception:  # noqa: BLE001
            break
        human_pause(min_ms, max_ms)


def human_mouse_wiggle(page, min_ms: int = 100, max_ms: int = 400) -> None:
    """Pequenos movimentos de mouse para parecer humano."""
    try:
        page.mouse.move(random.randint(100, 800), random.randint(100, 600), steps=random.randint(3, 8))
    except Exception:  # noqa: BLE001
        pass
    human_pause(min_ms, max_ms)
