// js/tabelas/taper-referencia.js
// Referência Schöepfer para Pinus taeda, Santa Catarina.
// Fonte: Santos et al. (2019). Biofix Scientific Journal 4(1):35-42.
//        "Modelos de volume e afilamento para florestas de Pinus taeda L."
//        Coeficientes do "conjunto total" — R²aj = 0.988, Syx% = 7.28 %.
//
// ⚠ DIRETRIZ v2.8.2: USO EXCLUSIVO de validação e diagnóstico visual.
// NÃO entra no motor de traçamento. O pipeline oficial usa o
// Power Taper calibrado (§11 das Premissas) com a calibração comercial.
//
// As primitivas matemáticas vivem em schoeffer-primitivas.js (módulo de
// folha), evitando ciclos de importação com tracamento.js.

import { volumeSegmento } from '../tracamento.js';
import { alturaComercial, H_STUMP } from '../afilamento.js';
import {
  SCHOEPFER_COEF,
  diametroSchoeffer,
  volumeSchoeffer,
  alturaOndeDiametroIgual,
} from './schoeffer-primitivas.js';

// ---------------------------------------------------------------------------
// Compatibilidade com a API anterior (consumidores externos)
// ---------------------------------------------------------------------------

export const SCHOEPFER_SC = Object.freeze({ conjuntoTotal: SCHOEPFER_COEF });
export const diametroSchoefferSC = diametroSchoeffer;
export const volumeSchoefferSC   = volumeSchoeffer;

// ---------------------------------------------------------------------------
// Bandas de referência SC (corte final, 20-22 anos)
// ---------------------------------------------------------------------------

export const REFERENCIA_SC = Object.freeze([
  Object.freeze({
    ordem: 1,
    nome: 'S1 — Laminação / Nobre',
    dpfMin: 35,
    pctMin: 40, pctMax: 48,
    fonte: '§2C (Corte Final, 20-22 anos)',
  }),
  Object.freeze({
    ordem: 2,
    nome: 'S2 — Serraria Média/Grande',
    dpfMin: 25,
    pctMin: 30, pctMax: 35,
    fonte: '§2C (Corte Final, 20-22 anos)',
  }),
  Object.freeze({
    ordem: 3,
    nome: 'S3 — Serraria Fina',
    dpfMin: 18,
    pctMin: 10, pctMax: 15,
    fonte: '§2C (Corte Final, 20-22 anos)',
  }),
  Object.freeze({
    ordem: 4,
    nome: 'S4 — Celulose / MDF',
    dpfMin: 8,
    pctMin: 5, pctMax: 8,
    fonte: '§2C (Corte Final, 20-22 anos)',
  }),
  Object.freeze({
    ordem: 5,
    nome: 'Resíduo / Ponteira',
    dpfMin: 0,
    pctMin: 3, pctMax: 5,
    fonte: '§2C (Corte Final, 20-22 anos)',
  }),
]);

const THRESHOLDS_REF = [35, 25, 18, 8, 0];

// ---------------------------------------------------------------------------
// Distribuições (por threshold de referência, NÃO por cenário)
// ---------------------------------------------------------------------------

function _consolidarClasses(volAcima, volTotal) {
  const classes = [];
  let prevAcima = 0;
  for (let i = 0; i < THRESHOLDS_REF.length; i++) {
    const acima = volAcima[i];
    const volClasse = Math.max(0, acima - prevAcima);
    prevAcima = acima;
    const ref = REFERENCIA_SC[i];
    classes.push({
      ordem: i + 1,
      dpfMin: THRESHOLDS_REF[i],
      nome: ref?.nome ?? `S${i + 1}`,
      pctMin: ref?.pctMin ?? 0,
      pctMax: ref?.pctMax ?? 100,
      volume: volClasse,
      pct: volTotal > 0 ? (volClasse / volTotal) * 100 : 0,
    });
  }
  return classes;
}

/**
 * Distribuição física do povoamento segundo o perfil Schöepfer-SC.
 * Thresholds de referência: 35 / 25 / 18 / 8 cm.
 * USO: diagnóstico apenas.
 */
export function distribuicaoSchoeffer(arvores) {
  const volAcima = THRESHOLDS_REF.map(() => 0);
  let volTotal = 0;
  let nUsadas = 0;

  for (const a of arvores) {
    if (!Number.isFinite(a.dap) || !Number.isFinite(a.altura)) continue;
    if (a.dap <= 0 || a.altura <= 1.3) continue;
    nUsadas++;

    const vCom = volumeSchoeffer(a.dap, a.altura, H_STUMP, a.altura);
    volTotal += vCom;

    for (let i = 0; i < THRESHOLDS_REF.length; i++) {
      const thr = THRESHOLDS_REF[i];
      if (thr === 0) {
        volAcima[i] += vCom;
        continue;
      }
      const hT = alturaOndeDiametroIgual(a.dap, a.altura, thr);
      if (hT > H_STUMP) {
        volAcima[i] += volumeSchoeffer(a.dap, a.altura, H_STUMP, hT);
      }
    }
  }

  return {
    classes: _consolidarClasses(volAcima, volTotal),
    volTotalComercial: volTotal,
    nUsadas,
  };
}

/**
 * Distribuição física do povoamento segundo o power taper (referência).
 * Mesmos thresholds; serve apenas para comparação.
 */
export function distribuicaoPowerTaperReferencia(arvores) {
  const volAcima = THRESHOLDS_REF.map(() => 0);
  let volTotal = 0;
  let nUsadas = 0;

  for (const a of arvores) {
    if (!Number.isFinite(a.beta) || !Number.isFinite(a.dap) || !Number.isFinite(a.altura)) continue;
    if (a.dap <= 0 || a.altura <= 1.3) continue;
    nUsadas++;

    const vCom = volumeSegmento(a.beta, a.dap, a.altura, H_STUMP, a.altura);
    volTotal += vCom;

    for (let i = 0; i < THRESHOLDS_REF.length; i++) {
      const thr = THRESHOLDS_REF[i];
      if (thr === 0) {
        volAcima[i] += vCom;
        continue;
      }
      if (a.dap <= thr) continue;
      const hC = alturaComercial(a.beta, a.dap, a.altura, thr);
      if (Number.isFinite(hC) && hC > H_STUMP) {
        volAcima[i] += volumeSegmento(a.beta, a.dap, a.altura, H_STUMP, hC);
      }
    }
  }

  return {
    classes: _consolidarClasses(volAcima, volTotal),
    volTotalComercial: volTotal,
    nUsadas,
  };
}