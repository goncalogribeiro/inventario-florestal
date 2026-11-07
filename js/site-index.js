// js/site-index.js
// Etapa 2.5.2 — Ajuste e ranking de equações de índice de sítio.
//
// Modelos:
//  · Chapman-Richards: H = b0 (1 - exp(-b1 A))^b2   (não linear, LM)
//  · Bailey-Clutter:    H = exp(b0 + b1/A)           (linearizável, OLS)
//  · Schumacher:        H = exp(b0 + b1/A)           (linearizável, OLS)
//
// Idade índice default: 15 anos (padrão EMBRAPA/SisPinus).
// Ranking: soma de ranks por R²aj, Syx% e |Viés| (mesmo critério da hipsometria).

import { fitOLS, fitLM } from './regressao.js';
import { metricasModelo } from './estatistica.js';

export const IDADE_INDICE_DEFAULT = 15;

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

export const MODELOS_SITIO = [
  {
    id: 'CR',
    nome: 'Chapman-Richards',
    p: 3,
    naoLinear: true,
    fModel: (beta, { A }) => beta[0] * Math.pow(1 - Math.exp(-beta[1] * A), beta[2]),
    chuteInicial: [40, 0.06, 0.8],
    // Inversa: S = H * [(1-exp(-b1*Iref))/(1-exp(-b1*A))]^b2
    indiceSitio: (H, A, beta, Iref = IDADE_INDICE_DEFAULT) =>
      H * Math.pow(
        (1 - Math.exp(-beta[1] * Iref)) / (1 - Math.exp(-beta[1] * A)),
        beta[2]
      ),
  },
  {
    id: 'BC',
    nome: 'Bailey-Clutter',
    p: 2,
    naoLinear: false,
    buildX: ({ A }) => [1, 1 / A],
    transformY: ({ H }) => Math.log(H),
    inverseY: (yhat) => Math.exp(yhat),
    // Inversa: b0 = ln(H) - b1/A; S = exp(b0 + b1/Iref)
    indiceSitio: (H, A, beta, Iref = IDADE_INDICE_DEFAULT) => {
      const b0 = Math.log(H) - beta[1] / A;
      return Math.exp(b0 + beta[1] / Iref);
    },
  },
  {
    id: 'SCH',
    nome: 'Schumacher',
    p: 2,
    naoLinear: false,
    buildX: ({ A }) => [1, 1 / A],
    transformY: ({ H }) => Math.log(H),
    inverseY: (yhat) => Math.exp(yhat),
    indiceSitio: (H, A, beta, Iref = IDADE_INDICE_DEFAULT) => {
      const b0 = Math.log(H) - beta[1] / A;
      return Math.exp(b0 + beta[1] / Iref);
    },
  },
];

// ---------------------------------------------------------------------------
// Ajuste e ranking
// ---------------------------------------------------------------------------

/**
 * @param {Array} pares - [{ A: idade, H: altura_dominante }]
 */
export function ajustarModelosSitio(pares) {
  const resultados = [];

  for (const modelo of MODELOS_SITIO) {
    try {
      let fit, beta, cf = 1;

      if (modelo.naoLinear) {
        fit = fitLM(modelo.fModel, pares, pares.map(p => p.H), modelo.chuteInicial);
        beta = fit.beta;
      } else {
        const X = pares.map(modelo.buildX);
        const y = pares.map(modelo.transformY);
        fit = fitOLS(X, y);
        beta = fit.beta;
      }

      const previstos = pares.map((p, i) => {
        if (modelo.naoLinear) return modelo.fModel(beta, p);
        return modelo.inverseY(fit.yPred[i]) * cf;
      });
      const observados = pares.map(p => p.H);
      const metricas = metricasModelo(observados, previstos, modelo.p);

      resultados.push({ modelo, beta, metricas });
    } catch (err) {
      resultados.push({ modelo, erro: err.message });
    }
  }

  return resultados;
}

/**
 * Ranking por soma de ranks (R²aj desc, Syx% asc, |Viés| asc).
 * Devolve { vencedor, rankeados, rejeitados }.
 */
export function ranquearSitio(resultados) {
  const validos = resultados.filter(r => !r.erro && r.metricas.R2aj >= 0.40);
  const rejeitados = resultados.filter(r => r.erro || r.metricas.R2aj < 0.40);

  if (validos.length === 0) return { vencedor: null, rankeados: [], rejeitados };

  const porR2 = [...validos].sort((a, b) => b.metricas.R2aj - a.metricas.R2aj);
  const porSyx = [...validos].sort((a, b) => a.metricas.SyxPct - b.metricas.SyxPct);
  const porVies = [...validos].sort((a, b) => Math.abs(a.metricas.vies) - Math.abs(b.metricas.vies));

  const somaRanks = new Map();
  validos.forEach(v => somaRanks.set(v, 0));
  porR2.forEach((v, i) => somaRanks.set(v, somaRanks.get(v) + i + 1));
  porSyx.forEach((v, i) => somaRanks.set(v, somaRanks.get(v) + i + 1));
  porVies.forEach((v, i) => somaRanks.set(v, somaRanks.get(v) + i + 1));

  const rankeados = [...validos].sort(
    (a, b) => somaRanks.get(a) - somaRanks.get(b));

  return { vencedor: rankeados[0], rankeados, rejeitados };
}