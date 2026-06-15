import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { inCooldown, nextSlot } from './throttle.ts';

const T0 = new Date('2026-06-15T12:00:00.000Z');

Deno.test('nextSlot: fila vazia agenda para agora', () => {
  assertEquals(nextSlot(T0, null, 3).getTime(), T0.getTime());
});

Deno.test('nextSlot: encadeia 3 min após o último agendado', () => {
  const last = new Date('2026-06-15T12:05:00.000Z');
  const slot = nextSlot(T0, last, 3);
  assertEquals(slot.toISOString(), '2026-06-15T12:08:00.000Z');
});

Deno.test('nextSlot: se o último já passou, agenda para agora', () => {
  const last = new Date('2026-06-15T11:50:00.000Z'); // +3min = 11:53, < agora
  assertEquals(nextSlot(T0, last, 3).getTime(), T0.getTime());
});

Deno.test('inCooldown: enviado há 1 min com gap 3 -> true', () => {
  const sent = new Date(T0.getTime() - 60_000);
  assertEquals(inCooldown(T0, sent, 3), true);
});

Deno.test('inCooldown: enviado há exatamente 3 min -> false', () => {
  const sent = new Date(T0.getTime() - 3 * 60_000);
  assertEquals(inCooldown(T0, sent, 3), false);
});

Deno.test('inCooldown: sem envio anterior -> false', () => {
  assertEquals(inCooldown(T0, null, 3), false);
});
