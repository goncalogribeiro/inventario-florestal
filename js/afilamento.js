// js/afilamento.js
// Etapa 2.2 — Afilamento Genérico (power taper)
// Modelo: d(h) = DAP · ((H − h) / (H − 1,3))^β
// Calibração: resolver V(β) = f · g · H por bissecção sobre k = 2β + 1
//
// Nota matemática: a integral usada para calibrar β é de 0 → H (fuste
// total, com extrapolação linear abaixo de 1,3 m como aproximação do
// toco). Isto faz V_integral coincidir com f·g·H — que é o critério de
// validação §4.5 do plano. A forma literal (1,3 → H) também está
// disponível como `volumeIntegralAcimaDap` para auditoria.

export const H_DAP = 1.30;
export const H_STUMP = 0.10;

export const BETA_FALLBACK = Object.freeze({
  Pinus: 0.60,
  Eucalipto: 0.55,
});

const BETA_MIN = 0.05;
const BETA_MAX = 3.00;
const K_MIN = 1.005; // k = 2β+1; β≈0.0025 (cilindro)
const K_MAX = 8.00;  // β=3.5 (muito afilado)
const TOL = 1e-9;
const MAX_ITER = 60;

// ---------------------------------------------------------------------------
// Integrais
// ---------------------------------------------------------------------------

/**
 * Volume do fuste (m³) integrando o perfil power taper de h=0 até h=H.
 * Corresponde ao volume total (com toco aproximado por extrapolação) e
 * coincide com f·g·H quando β foi calibrado por `calibrarBeta`.
 */
export function volumeIntegral(beta, dap, altura) {
  if (!Number.isFinite(beta) || !Number.isFinite(dap) || !Number.isFinite(altura)) return 0;
  if (dap <= 0 || altura <= H_DAP || beta < 0) return 0;
  const g = (Math.PI / 4) * Math.pow(dap / 100, 2);
  const k = 2 * beta + 1;
  const u0 = altura / (altura - H_DAP);
  const u0k = Math.pow(u0, k);
  if (!Number.isFinite(u0k)) return 0;
  return g * (altura - H_DAP) / k * u0k;
}

/**
 * Volume acima do DAP (1,3 m → H), forma literal do plano.
 * Usado apenas para auditoria; NÃO é a referência de calibração.
 */
export function volumeIntegralAcimaDap(beta, dap, altura) {
  if (!Number.isFinite(beta) || !Number.isFinite(dap) || !Number.isFinite(altura)) return 0;
  if (dap <= 0 || altura <= H_DAP || beta < 0) return 0;
  const g = (Math.PI / 4) * Math.pow(dap / 100, 2);
  return g * (altura - H_DAP) / (2 * beta + 1);
}

// ---------------------------------------------------------------------------
// Calibração de β
// ---------------------------------------------------------------------------

function _calibrarBetaInterno(dap, altura, fatorForma) {
  if (!Number.isFinite(dap) || !Number.isFinite(altura) || !Number.isFinite(fatorForma)) {
    return { beta: null, motivo: 'invalido' };
  }
  if (dap <= 0 || fatorForma <= 0 || fatorForma >= 1 || altura <= H_DAP) {
    return { beta: null, motivo: 'fora_de_dominio' };
  }

  const g = (Math.PI / 4) * Math.pow(dap / 100, 2);
  const alvo = fatorForma * g * altura;
  const u0 = altura / (altura - H_DAP);

  const V = (k) => {
    const u0k = Math.pow(u0, k);
    if (!Number.isFinite(u0k)) return Infinity;
    return g * (altura - H_DAP) / k * u0k;
  };

  let kLo = K_MIN;
  let kHi = K_MAX;
  let FLo = V(kLo) - alvo;
  const FHi = V(kHi) - alvo;
  if (!Number.isFinite(FLo) || !Number.isFinite(FHi) || FLo * FHi > 0) {
    return { beta: null, motivo: 'sem_raiz' };
  }

  for (let i = 0; i < MAX_ITER; i++) {
    const kMid = (kLo + kHi) / 2;
    const FMid = V(kMid) - alvo;
    if (Math.abs(FMid) < TOL) { kLo = kMid; kHi = kMid; break; }
    if (FLo * FMid < 0) { kHi = kMid; }
    else { kLo = kMid; FLo = FMid; }
  }

  const k = (kLo + kHi) / 2;
  const beta = (k - 1) / 2;
  if (!Number.isFinite(beta) || beta < BETA_MIN || beta > BETA_MAX) {
    return { beta: null, motivo: 'fora_de_intervalo' };
  }
  return { beta, motivo: null };
}

/**
 * Calibra o expoente de afilamento β para uma árvore.
 * @returns {number} β calibrado (ou fallback se o solver falhar)
 */
export function calibrarBeta(dap, altura, fatorForma, fallback = BETA_FALLBACK.Pinus) {
  const r = _calibrarBetaInterno(dap, altura, fatorForma);
  return r.beta ?? fallback;
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

/**
 * Diâmetro (cm) à altura h (m).
 * Abaixo de 1,3 m: devolve DAP (secção do toco ≈ cilíndrica).
 * Em h ≥ H: devolve 0.
 */
export function diametroAAltura(beta, dap, altura, h) {
  if (!Number.isFinite(h) || !Number.isFinite(beta) || !Number.isFinite(dap) || !Number.isFinite(altura)) return 0;
  if (dap <= 0 || altura <= H_DAP) return 0;
  if (h < 0) return 0;
  if (h < H_DAP) return dap;
  if (h >= altura) return 0;
  const razao = (altura - h) / (altura - H_DAP);
  return dap * Math.pow(razao, beta);
}

/**
 * Altura comercial (m) onde d(h) = dMin.
 * H_c = H − (dMin/DAP)^(1/β) · (H − 1,3)
 */
export function alturaComercial(beta, dap, altura, dMin) {
  if (!Number.isFinite(beta) || !Number.isFinite(dap) || !Number.isFinite(altura) || !Number.isFinite(dMin)) return null;
  if (dap <= 0 || altura <= H_DAP || beta <= 0) return null;
  if (dMin <= 0) return altura;
  if (dMin >= dap) return H_DAP;
  const razao = dMin / dap;
  const factor = Math.pow(razao, 1 / beta);
  const hc = altura - factor * (altura - H_DAP);
  return Math.max(H_DAP, Math.min(altura, hc));
}

// ---------------------------------------------------------------------------
// Enriquecimento das árvores
// ---------------------------------------------------------------------------

/**
 * Adiciona a cada árvore: `beta`, `betaFallback`, `alturaComercial[dMin]`
 * e `volumeIntegral`. Muta o array.
 *
 * @returns {Object} contagens para log:
 *   { nTotal, nCalibrados, nFallback, nIgnorados, dMinimos }
 */
export function enriquecerComAfilamento(arvores, especie, fatorForma, dMinimos = [6, 8]) {
  const fallback = BETA_FALLBACK[especie] ?? BETA_FALLBACK.Pinus;
  const stats = {
    nTotal: arvores.length,
    nCalibrados: 0,
    nFallback: 0,
    nIgnorados: 0,
    dMinimos: [...dMinimos],
  };

  for (const a of arvores) {
    a.beta = null;
    a.betaFallback = false;
    a.alturaComercial = {};
    for (const dMin of dMinimos) a.alturaComercial[dMin] = null;
    a.volumeIntegral = null;

    if (!Number.isFinite(a.dap) || !Number.isFinite(a.altura) || a.altura <= H_DAP || a.dap <= 0) {
      stats.nIgnorados++;
      continue;
    }

    const r = _calibrarBetaInterno(a.dap, a.altura, fatorForma);
    if (r.beta === null) {
      a.beta = fallback;
      a.betaFallback = true;
      stats.nFallback++;
    } else {
      a.beta = r.beta;
      stats.nCalibrados++;
    }

    for (const dMin of dMinimos) {
      a.alturaComercial[dMin] = alturaComercial(a.beta, a.dap, a.altura, dMin);
    }
    a.volumeIntegral = volumeIntegral(a.beta, a.dap, a.altura);
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Agregações
// ---------------------------------------------------------------------------

function _media(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null; }
function _min(arr) { return arr.length ? Math.min(...arr) : null; }
function _max(arr) { return arr.length ? Math.max(...arr) : null; }

/**
 * Resumo por parcela: β médio/min/max e H_c médio/min/max para cada dMin.
 */
export function agregarAfilamentoPorParcela(arvores, dMinimos = [6, 8]) {
  const porParcela = new Map();

  for (const a of arvores) {
    if (a.parcela === undefined || a.parcela === null) continue;
    const key = String(a.parcela);
    if (!porParcela.has(key)) {
      const bucket = { nTotal: 0, betas: [], alturasCom: {} };
      for (const dMin of dMinimos) bucket.alturasCom[dMin] = [];
      porParcela.set(key, bucket);
    }
    const b = porParcela.get(key);
    b.nTotal++;
    if (Number.isFinite(a.beta) && !a.betaFallback) b.betas.push(a.beta);
    for (const dMin of dMinimos) {
      const hc = a.alturaComercial?.[dMin];
      if (Number.isFinite(hc)) b.alturasCom[dMin].push(hc);
    }
  }

  const resultado = {};
  for (const [key, b] of porParcela) {
    const r = {
      nTotal: b.nTotal,
      nCalibrados: b.betas.length,
      betaMedio: _media(b.betas),
      betaMin: _min(b.betas),
      betaMax: _max(b.betas),
      alturaComercialMedio: {},
      alturaComercialMin: {},
      alturaComercialMax: {},
    };
    for (const dMin of dMinimos) {
      r.alturaComercialMedio[dMin] = _media(b.alturasCom[dMin]);
      r.alturaComercialMin[dMin] = _min(b.alturasCom[dMin]);
      r.alturaComercialMax[dMin] = _max(b.alturasCom[dMin]);
    }
    resultado[key] = r;
  }
  return resultado;
}

/**
 * Resumo do povoamento inteiro (mesmas métricas que agregarPorParcela).
 */
export function resumoAfilamentoPovoamento(arvores, dMinimos = [6, 8]) {
  const betas = [];
  const alturasCom = Object.fromEntries(dMinimos.map(d => [d, []]));

  for (const a of arvores) {
    if (Number.isFinite(a.beta) && !a.betaFallback) betas.push(a.beta);
    for (const dMin of dMinimos) {
      const hc = a.alturaComercial?.[dMin];
      if (Number.isFinite(hc)) alturasCom[dMin].push(hc);
    }
  }

  const r = {
    nCalibrados: betas.length,
    betaMedio: _media(betas),
    betaMin: _min(betas),
    betaMax: _max(betas),
    alturaComercialMedio: {},
    alturaComercialMin: {},
    alturaComercialMax: {},
  };
  for (const dMin of dMinimos) {
    r.alturaComercialMedio[dMin] = _media(alturasCom[dMin]);
    r.alturaComercialMin[dMin] = _min(alturasCom[dMin]);
    r.alturaComercialMax[dMin] = _max(alturasCom[dMin]);
  }
  return r;
}

// ---------------------------------------------------------------------------
// Validação (auditoria)
// ---------------------------------------------------------------------------

/**
 * Verifica se volumeIntegral(β) coincide com f·g·H para cada árvore.
 * Devolve { nVerificados, erros: [{parcela, arvore, vRef, vInt, erroRel}] }.
 * Tolerância: 0,1 % (o plano pede concordância a 3 casas decimais em m³).
 */
export function validarIntegral(arvores, fatorForma) {
  const erros = [];
  let nVerificados = 0;

  for (const a of arvores) {
    if (!Number.isFinite(a.beta) || a.betaFallback) continue;
    nVerificados++;
    const g = (Math.PI / 4) * Math.pow(a.dap / 100, 2);
    const vRef = fatorForma * g * a.altura;
    const vInt = a.volumeIntegral;
    if (!Number.isFinite(vInt) || vRef <= 0) continue;
    const erroRel = Math.abs(vInt - vRef) / vRef;
    if (erroRel > 1e-3) {
      erros.push({ parcela: a.parcela, arvore: a.arvore, vRef, vInt, erroRel });
    }
  }
  return { nVerificados, erros };
}