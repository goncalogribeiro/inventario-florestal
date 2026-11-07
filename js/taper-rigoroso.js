// js/taper-rigoroso.js
// Fase 2 — Ferramenta de DIAGNÓSTICO por Schöepfer-SC.
//
// ⚠ DIRETRIZ v2.8.2: NÃO é motor principal. O pipeline oficial (traçamento,
// receita, CEO, IC, sensibilidade) usa SEMPRE o Power Taper Calibrado.
// Este módulo apenas enriquece as árvores e agrega métricas para o painel
// de comparação (Painel 7).

import {
  SCHOEPFER_COEF,
  diametroSchoeffer,
  volumeSchoeffer,
  alturaOndeDiametroIgual,
} from './tabelas/schoeffer-primitivas.js';

export const MODELOS_TAPER = Object.freeze({
  POWER_TAPER: 'power-taper',
  SCHOEPFER:   'schoeffer',
});

export const LABEL_MODELO_CURTO = Object.freeze({
  'power-taper': 'Power Taper',
  'schoeffer':   'Schöepfer-SC',
});

// Re-exports úteis para consumidores que precisem das primitivas
export { SCHOEPFER_COEF, diametroSchoeffer, volumeSchoeffer, alturaOndeDiametroIgual };

// ---------------------------------------------------------------------------
// Enriquecimento diagnóstico (paralelo ao enriquecimento do power taper)
// ---------------------------------------------------------------------------

export function enriquecerComSchoeffer(arvores, dMinimos = [6, 8]) {
  const stats = {
    nTotal: arvores.length,
    nUsadas: 0,
    nIgnoradas: 0,
    dMinimos: [...dMinimos],
  };

  for (const a of arvores) {
    a.volumeIntegralSchoeffer = null;
    a.alturaComercialSchoeffer = {};
    for (const d of dMinimos) a.alturaComercialSchoeffer[d] = null;

    if (!Number.isFinite(a.dap) || !Number.isFinite(a.altura) || a.altura <= 1.3 || a.dap <= 0) {
      stats.nIgnoradas++;
      continue;
    }

    stats.nUsadas++;
    a.volumeIntegralSchoeffer = volumeSchoeffer(a.dap, a.altura, 0, a.altura);
    for (const d of dMinimos) {
      a.alturaComercialSchoeffer[d] = d > 0
        ? alturaOndeDiametroIgual(a.dap, a.altura, d)
        : a.altura;
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Agregações Schöepfer (para diagnóstico no Painel 4)
// ---------------------------------------------------------------------------
const _media = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
const _min   = (arr) => arr.length ? Math.min(...arr) : null;
const _max   = (arr) => arr.length ? Math.max(...arr) : null;

export function agregarAfilamentoSchoefferPorParcela(arvores, dMinimos = [6, 8]) {
  const buckets = new Map();

  for (const a of arvores) {
    if (a.parcela == null) continue;
    const key = String(a.parcela);
    if (!buckets.has(key)) {
      const b = { nTotal: 0, alturas: {} };
      for (const d of dMinimos) b.alturas[d] = [];
      buckets.set(key, b);
    }
    const b = buckets.get(key);
    b.nTotal++;
    for (const d of dMinimos) {
      const hc = a.alturaComercialSchoeffer?.[d];
      if (Number.isFinite(hc)) b.alturas[d].push(hc);
    }
  }

  const out = {};
  for (const [key, b] of buckets) {
    const r = {
      nTotal: b.nTotal,
      alturaComercialMedio: {},
      alturaComercialMin: {},
      alturaComercialMax: {},
    };
    for (const d of dMinimos) {
      const arr = b.alturas[d];
      r.alturaComercialMedio[d] = _media(arr);
      r.alturaComercialMin[d]   = _min(arr);
      r.alturaComercialMax[d]   = _max(arr);
    }
    out[key] = r;
  }
  return out;
}

export function resumoAfilamentoSchoefferPovoamento(arvores, dMinimos = [6, 8]) {
  const alturas = Object.fromEntries(dMinimos.map(d => [d, []]));

  for (const a of arvores) {
    for (const d of dMinimos) {
      const hc = a.alturaComercialSchoeffer?.[d];
      if (Number.isFinite(hc)) alturas[d].push(hc);
    }
  }

  const r = {
    nUsadas: arvores.length,
    alturaComercialMedio: {},
    alturaComercialMin: {},
    alturaComercialMax: {},
  };
  for (const d of dMinimos) {
    const arr = alturas[d];
    r.alturaComercialMedio[d] = _media(arr);
    r.alturaComercialMin[d]   = _min(arr);
    r.alturaComercialMax[d]   = _max(arr);
  }
  return r;
}