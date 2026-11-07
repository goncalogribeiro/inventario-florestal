// js/calibracao-classificacao.js
// Etapa 2.3.5 — Calibração da classificação comercial.
// Etapa 2.3.6b — bisseção sobre o VOLUME REAL TRAÇADO (pós-bucking).
// Etapa 2.3.7 — factor de referência ÚNICO.
//
// ⚠ DIRETRIZ v2.8.2: aceita `opcoes.processarFn` (default = power-taper) para
// permitir calibração paralela em modo diagnóstico (Schöepfer). O pipeline
// oficial usa SEMPRE o default.

import { processarCenario, volumeSegmento } from './tracamento.js';

export const ALVOS_DEFAULT = [43, 33, 12, 8, 4];
export const LIMITE_FACTOR = { min: 0.85, max: 1.50 };
export const CENARIO_REFERENCIA_DEFAULT = 'Realista';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function volumeTotalFisico(arvores) {
  let total = 0;
  for (const a of arvores) {
    if (!Number.isFinite(a.beta) || !Number.isFinite(a.dap) || !Number.isFinite(a.altura)) continue;
    total += volumeSegmento(a.beta, a.dap, a.altura, 0, a.altura);
  }
  return total;
}

function emptyResult(avisos = []) {
  return {
    factorPorRank: [],
    factorPorClasse: {},
    dapMinEfetivo: {},
    cumTargets: [],
    cumActual: [],
    classPctActual: [],
    vTotal: 0,
    avisos,
    cenarioCalibrado: null,
    resultadoCalibrado: null,
  };
}

// ---------------------------------------------------------------------------
// Cálculo do factor de referência
// ---------------------------------------------------------------------------

export function calcularFatorReferencia(arvores, cenarioRef, alvos, opcoes = {}) {
  const processarFn = opcoes.processarFn
    ?? ((a, c, f) => processarCenario(a, c, f));

  const avisos = [];

  if (!Array.isArray(cenarioRef?.classes) || cenarioRef.classes.length === 0) {
    return emptyResult(['Cenário de referência sem classes.']);
  }

  const somaAlvos = alvos.reduce(
    (s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0);
  if (somaAlvos <= 0) {
    return emptyResult(['Alvos inválidos (soma = 0). Calibração ignorada.']);
  }
  if (Math.abs(somaAlvos - 100) > 0.1) {
    avisos.push(`Alvos somam ${somaAlvos.toFixed(1)}% (esperado 100%). Normalizados.`);
  }
  const alvosNorm = alvos.map(
    v => (Number.isFinite(v) && v > 0 ? v : 0) / somaAlvos * 100);

  const classesOrd = [...cenarioRef.classes].sort((a, b) => b.dapMin - a.dapMin);
  const n = classesOrd.length;

  if (n !== alvos.length) {
    avisos.push(`Cenário de referência "${cenarioRef.nome}" tem ${n} classes, alvos tem ${alvos.length}. Uso min(posições).`);
  }

  const vTotal = volumeTotalFisico(arvores);
  if (!(vTotal > 0)) {
    return emptyResult(['Volume total nulo — calibração ignorada.']);
  }

  const cumTargets = [];
  let acc = 0;
  for (let k = 0; k < n; k++) {
    acc += alvosNorm[k] ?? 0;
    cumTargets.push(Math.min(100, acc));
  }

  const factors = new Array(n).fill(1.0);
  const nomeParaIdx = {};
  classesOrd.forEach((c, i) => { nomeParaIdx[c.nome] = i; });

  function buildCenarioRef(factors) {
    const cen = JSON.parse(JSON.stringify(cenarioRef));
    const classesCopia = [...cen.classes].sort((a, b) => b.dapMin - a.dapMin);
    let prevEff = Infinity;
    for (let i = 0; i < classesCopia.length; i++) {
      const idx = nomeParaIdx[classesCopia[i].nome];
      let dapEff = classesCopia[i].dapMin * factors[idx];
      if (dapEff >= prevEff) dapEff = Math.max(0.01, prevEff - 0.01);
      prevEff = dapEff;
      const dapOrig = cenarioRef.classes.find(c => c.nome === classesCopia[i].nome)?.dapMin;
      classesCopia[i]._dapMinOriginal = dapOrig;
      classesCopia[i]._factorCalibracao = factors[idx];
      classesCopia[i]._rankAlvo = i;
      classesCopia[i].dapMin = dapEff;
    }
    cen.classes = classesCopia;
    return cen;
  }

  function cumPctForK(k, factorK, factorsCurrent) {
    const testFactors = [...factorsCurrent];
    testFactors[k] = factorK;
    const cen = buildCenarioRef(testFactors);
    const r = processarFn(arvores, cen, 1.0);
    const rec = r.receitaComEnergia;
    const vTot = rec.volComercial || 1;
    let acc = 0;
    for (let i = 0; i <= k; i++) {
      acc += rec.porClasse[classesOrd[i].nome]?.volume ?? 0;
    }
    return (acc / vTot) * 100;
  }

  const MAX_OUTER = 5;
  const MAX_BISECT = 10;
  const TOL_CONVERGENCIA = 0.03;

  for (let outer = 0; outer < MAX_OUTER; outer++) {
    let maxChange = 0;
    for (let k = 0; k < n - 1; k++) {
      if (classesOrd[k].dapMin <= 0) continue;
      const target = cumTargets[k];
      let lo = LIMITE_FACTOR.min;
      let hi = LIMITE_FACTOR.max;
      for (let bis = 0; bis < MAX_BISECT; bis++) {
        const mid = (lo + hi) / 2;
        const actual = cumPctForK(k, mid, factors);
        if (actual > target) lo = mid;
        else hi = mid;
      }
      const newFactor = (lo + hi) / 2;
      const change = Math.abs(newFactor - factors[k]);
      if (change > maxChange) maxChange = change;
      factors[k] = newFactor;
    }
    if (maxChange < TOL_CONVERGENCIA) break;
  }

  const cenFinal = buildCenarioRef(factors);
  const rFinal = processarFn(arvores, cenFinal, 1.0);
  const recFinal = rFinal.receitaComEnergia;
  const vTotFinal = recFinal.volComercial || 1;

  const cumActual = [];
  const classPctActual = [];
  let accFinal = 0;
  let accAnterior = 0;
  for (let k = 0; k < n; k++) {
    const volClasse = recFinal.porClasse[classesOrd[k].nome]?.volume ?? 0;
    accFinal += volClasse;
    cumActual.push((accFinal / vTotFinal) * 100);
    classPctActual.push(((accFinal - accAnterior) / vTotFinal) * 100);
    accAnterior = accFinal;
  }

  const factorPorRank = [...factors];
  const factorPorClasse = {};
  const dapMinEfetivo = {};
  for (let k = 0; k < n; k++) {
    const nome = classesOrd[k].nome;
    factorPorClasse[nome] = factors[k];
    dapMinEfetivo[nome] = classesOrd[k].dapMin * factors[k];

    if (classesOrd[k].dapMin > 0 &&
        (Math.abs(factors[k] - LIMITE_FACTOR.min) < 1e-6 ||
         Math.abs(factors[k] - LIMITE_FACTOR.max) < 1e-6)) {
      avisos.push(
        `Classe "${nome}": factor ${factors[k].toFixed(3)} no limite ` +
        `[${LIMITE_FACTOR.min}, ${LIMITE_FACTOR.max}]. ` +
        `Alvo ${alvosNorm[k].toFixed(1)}% pode não ser atingível.`);
    }
  }

  return {
    factorPorRank,
    factorPorClasse,
    dapMinEfetivo,
    cumTargets,
    cumActual,
    classPctActual,
    vTotal: vTotFinal,
    avisos,
    cenarioCalibrado: cenFinal,
    resultadoCalibrado: rFinal,
  };
}

// ---------------------------------------------------------------------------
// Aplicação do factor a QUALQUER cenário
// ---------------------------------------------------------------------------

export function aplicarFatorGlobal(cenario, factorPorRank) {
  if (!Array.isArray(factorPorRank) || factorPorRank.length === 0) {
    const clone = JSON.parse(JSON.stringify(cenario));
    const sorted = [...clone.classes].sort((a, b) => b.dapMin - a.dapMin);
    sorted.forEach((cls, k) => {
      cls._dapMinOriginal = cls.dapMin;
      cls._factorCalibracao = 1;
      cls._rankAlvo = k;
    });
    return clone;
  }

  const clone = JSON.parse(JSON.stringify(cenario));
  const sorted = [...clone.classes].sort((a, b) => b.dapMin - a.dapMin);
  let prevEff = Infinity;
  for (let k = 0; k < sorted.length; k++) {
    const cls = sorted[k];
    const f = factorPorRank[k];
    const dapOrig = cls.dapMin;
    const factor = Number.isFinite(f) ? f : 1;
    let dapEff = dapOrig * factor;
    if (dapEff >= prevEff) dapEff = Math.max(0.01, prevEff - 0.01);
    prevEff = dapEff;
    cls._dapMinOriginal = dapOrig;
    cls._factorCalibracao = factor;
    cls._rankAlvo = k;
    cls.dapMin = dapEff;
  }
  return clone;
}

// ---------------------------------------------------------------------------
// Distribuição (para log e UI)
// ---------------------------------------------------------------------------

export function distribuicaoFisica(resultadoCenario) {
  const rec = resultadoCenario.receitaComEnergia;
  const total = rec.volComercial || 1;
  const out = {};
  for (const [nome, c] of Object.entries(rec.porClasse)) {
    out[nome] = { pct: (c.volume / total) * 100, volume: c.volume };
  }
  return out;
}