// Lógica pura de throttle (F04 RN-SEND-01 + cooldown). Testável sem rede/DB.

/**
 * Calcula o scheduled_at do próximo envio dado o maior scheduled_at já na fila.
 * Garante 1 envio a cada `intervalMin` minutos mesmo aprovando vários de uma vez.
 *
 * @param now            instante atual
 * @param lastScheduled  maior scheduled_at entre sends 'agendado' (ou null se fila vazia)
 * @param intervalMin    intervalo em minutos (settings.send_interval_minutes)
 */
export function nextSlot(now: Date, lastScheduled: Date | null, intervalMin: number): Date {
  const gapMs = intervalMin * 60_000;
  if (!lastScheduled) return new Date(now);
  const candidate = new Date(lastScheduled.getTime() + gapMs);
  return candidate > now ? candidate : new Date(now);
}

/**
 * Há cooldown ativo? (último envio feito há menos de `intervalMin` minutos)
 * @param lastSentAt instante do último send 'enviado' (ou null)
 */
export function inCooldown(now: Date, lastSentAt: Date | null, intervalMin: number): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - lastSentAt.getTime() < intervalMin * 60_000;
}
