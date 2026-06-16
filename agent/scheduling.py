"""Lógica pura de janela de horário comercial e follow-up.

Pura e testável — será usada pelo sender local (onda do WhatsApp) para:
  - só disparar dentro do horário comercial;
  - decidir quando reenviar (follow-up) para quem não respondeu.
"""

from __future__ import annotations

from datetime import datetime, timedelta


def is_within_business_hours(dt: datetime, start_hour: int, end_hour: int) -> bool:
    """True se a hora de `dt` está em [start_hour, end_hour)."""
    return start_hour <= dt.hour < end_hour


def next_business_time(dt: datetime, start_hour: int, end_hour: int) -> datetime:
    """Retorna o próximo instante dentro do horário comercial.

    - Dentro da janela -> o próprio dt.
    - Antes do início   -> hoje às start_hour.
    - Depois do fim     -> amanhã às start_hour.
    """
    if is_within_business_hours(dt, start_hour, end_hour):
        return dt
    if dt.hour < start_hour:
        return dt.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    nxt = dt + timedelta(days=1)
    return nxt.replace(hour=start_hour, minute=0, second=0, microsecond=0)


def should_follow_up(
    last_contact_at: datetime | None,
    follow_up_count: int,
    now: datetime,
    follow_up_days: int,
    max_follow_ups: int,
) -> bool:
    """Decide se um lead (que não respondeu) deve receber follow-up agora."""
    if last_contact_at is None:
        return False
    if follow_up_count >= max_follow_ups:
        return False
    return now - last_contact_at >= timedelta(days=follow_up_days)
