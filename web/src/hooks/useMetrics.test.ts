import { describe, it, expect } from 'vitest';
import { computeMetrics } from './useMetrics';
import type { LeadStatus } from '../lib/types';

const mk = (status: LeadStatus, niche: string | null = 'estética') => ({ status, niche });

describe('computeMetrics', () => {
  it('retorna zeros e null em base vazia (divisão por zero tratada)', () => {
    const m = computeMetrics([]);
    expect(m.garimpados).toBe(0);
    expect(m.taxaResposta).toBeNull();
    expect(m.taxaFechamento).toBeNull();
    expect(m.receita).toBe(0);
  });

  it('conta o funil corretamente (enviado inclui quem avançou)', () => {
    const m = computeMetrics([
      mk('novo'),
      mk('pronto'),
      mk('enviado'),
      mk('respondeu'),
      mk('fechou'),
    ]);
    expect(m.garimpados).toBe(5);
    expect(m.prontos).toBe(1);
    // enviado + respondeu + fechou = 3 contam como "enviados"
    expect(m.enviados).toBe(3);
    // respondeu + fechou = 2 contam como "responderam"
    expect(m.responderam).toBe(2);
    expect(m.fecharam).toBe(1);
  });

  it('calcula taxas e receita', () => {
    const m = computeMetrics([mk('enviado'), mk('enviado'), mk('respondeu'), mk('fechou')]);
    // enviados = 4 (todos enviado/respondeu/fechou), responderam = 2, fecharam = 1
    expect(m.enviados).toBe(4);
    expect(m.taxaResposta).toBeCloseTo(0.5);
    expect(m.taxaFechamento).toBeCloseTo(0.25);
    expect(m.receita).toBe(797);
  });

  it('agrupa por nicho', () => {
    const m = computeMetrics([mk('fechou', 'estética'), mk('novo', 'estética'), mk('novo', 'odonto')]);
    const est = m.porNicho.find((n) => n.niche === 'estética');
    expect(est?.total).toBe(2);
    expect(est?.fechou).toBe(1);
  });
});
