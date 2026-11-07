/**
 * Catálogo de modelos hipsométricos.
 * Cada modelo declara: buildX, transformY, inverseY, needsSmearing, logBase.
 * Os coeficientes NÃO estão aqui — são sempre estimados por OLS ou LM.
 */

/**
 * Modelos lineares (OLS). Todos os 20 de Pinus + 8 adicionais de Eucalipto.
 * 'inverseY' converte Ŷ (escala transformada) para H em metros.
 * 'needsSmearing' indica que a retro-transformação requer correção.
 */
export const MODELOS_LINEARES = [
  // ===== PINUS (1–20) =====
  { id: 1, nome: 'Berkhout', especie: ['Pinus'], p: 2,
    expressao: 'h = β0 + β1·DAP',
    buildX: r => [1, r.dap],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false },

  { id: 2, nome: 'Kopezsky-Gehrhardt', especie: ['Pinus'], p: 2,
    expressao: 'h = β0 + β1·DAP²',
    buildX: r => [1, r.dap ** 2],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false },

  { id: 3, nome: 'Parábola', especie: ['Pinus', 'Eucalipto'], p: 3,
    expressao: 'h = β0 + β1·DAP + β2·DAP²',
    buildX: r => [1, r.dap, r.dap ** 2],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false },

  { id: 4, nome: 'Polinômio 4º grau', especie: ['Pinus'], p: 5,
    expressao: 'h = β0 + β1·DAP + … + β4·DAP⁴',
    buildX: r => [1, r.dap, r.dap ** 2, r.dap ** 3, r.dap ** 4],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false },

  { id: 5, nome: 'Hendricksen I', especie: ['Pinus'], p: 2,
    expressao: 'h = β0 + β1·log10(DAP)',
    buildX: r => [1, Math.log10(r.dap)],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false },

  { id: 6, nome: 'Hendricksen II', especie: ['Pinus', 'Eucalipto'], p: 2,
    expressao: 'h = β0 + β1·ln(DAP)',
    buildX: r => [1, Math.log(r.dap)],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false },

  { id: 7, nome: 'Trorey', especie: ['Pinus'], p: 3,
    expressao: 'h = 1.3 + β1·DAP + β2·DAP²',
    buildX: r => [r.dap, r.dap ** 2],
    transformY: r => r.altura - 1.3,
    inverseY: y => y + 1.3,
    needsSmearing: false },

  { id: 8, nome: 'Marinheski I', especie: ['Pinus'], p: 5,
    expressao: '1.3 + ln(h) = β0 + … + β4·DAP⁴',
    buildX: r => [1, r.dap, r.dap ** 2, r.dap ** 3, r.dap ** 4],
    transformY: r => 1.3 + Math.log(r.altura),
    inverseY: y => Math.exp(y - 1.3),
    needsSmearing: true, logBase: 'ln' },

  { id: 9, nome: 'Hiperbólico 5', especie: ['Pinus'], p: 2,
    expressao: '1/h = β0 + β1·(1/DAP²)',
    buildX: r => [1, 1 / r.dap ** 2],
    transformY: r => 1 / r.altura,
    inverseY: y => 1 / y,
    needsSmearing: false },

  { id: 10, nome: 'Marinheski II', especie: ['Pinus'], p: 2,
    expressao: '√h = β0 + β1·DAP',
    buildX: r => [1, r.dap],
    transformY: r => Math.sqrt(r.altura),
    inverseY: y => y ** 2,
    needsSmearing: false },

  { id: 11, nome: 'Petterson', especie: ['Pinus'], p: 2,
    expressao: '1/√(h−1.3) = β0 + β1/DAP',
    buildX: r => [1, 1 / r.dap],
    transformY: r => 1 / Math.sqrt(r.altura - 1.3),
    inverseY: y => 1.3 + (1 / y) ** 2,
    needsSmearing: false },

  { id: 12, nome: 'Curtis', especie: ['Pinus', 'Eucalipto'], p: 2,
    expressao: 'ln(h) = β0 + β1/DAP',
    buildX: r => [1, 1 / r.dap],
    transformY: r => Math.log(r.altura),
    inverseY: y => Math.exp(y),
    needsSmearing: true, logBase: 'ln' },

  { id: 13, nome: 'Curtis II', especie: ['Pinus', 'Eucalipto'], p: 2,
    expressao: 'ln(h) = β0 + β1/DAP²',
    buildX: r => [1, 1 / r.dap ** 2],
    transformY: r => Math.log(r.altura),
    inverseY: y => Math.exp(y),
    needsSmearing: true, logBase: 'ln' },

  { id: 14, nome: 'Stoffels', especie: ['Pinus', 'Eucalipto'], p: 2,
    expressao: 'ln(h) = β0 + β1·ln(DAP)',
    buildX: r => [1, Math.log(r.dap)],
    transformY: r => Math.log(r.altura),
    inverseY: y => Math.exp(y),
    needsSmearing: true, logBase: 'ln' },

  { id: 15, nome: 'Stoffels-Schneider', especie: ['Pinus'], p: 2,
    expressao: 'ln(h) = β0 + β1·ln(DAP/(1+DAP))',
    buildX: r => [1, Math.log(r.dap / (1 + r.dap))],
    transformY: r => Math.log(r.altura),
    inverseY: y => Math.exp(y),
    needsSmearing: true, logBase: 'ln' },

  { id: 16, nome: 'Korsun', especie: ['Pinus'], p: 3,
    expressao: 'ln(h) = β0 + β1·ln(DAP) + β2·(ln(DAP))²',
    buildX: r => { const ln = Math.log(r.dap); return [1, ln, ln * ln]; },
    transformY: r => Math.log(r.altura),
    inverseY: y => Math.exp(y),
    needsSmearing: true, logBase: 'ln' },

  { id: 17, nome: 'Polinômio 6º grau', especie: ['Pinus'], p: 7,
    expressao: 'ln(h) = β0 + β1·DAP + … + β6·DAP⁶',
    buildX: r => [1, r.dap, r.dap ** 2, r.dap ** 3, r.dap ** 4, r.dap ** 5, r.dap ** 6],
    transformY: r => Math.log(r.altura),
    inverseY: y => Math.exp(y),
    needsSmearing: true, logBase: 'ln' },

  { id: 18, nome: 'Assmann', especie: ['Pinus', 'Eucalipto'], p: 2,
    expressao: 'h = β0 + β1/DAP',
    buildX: r => [1, 1 / r.dap],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false },

  { id: 19, nome: 'Prodan2', especie: ['Pinus'], p: 2,
    expressao: 'DAP²/h = β0 + β1·DAP',
    buildX: r => [1, r.dap],
    transformY: r => (r.dap ** 2) / r.altura,
    inverseY: (y, dap) => (dap ** 2) / y,
    needsSmearing: false },

  { id: 20, nome: 'Azevedo', especie: ['Pinus'], p: 2,
    expressao: 'DAP/√h = β0 + β1·DAP',
    buildX: r => [1, r.dap],
    transformY: r => r.dap / Math.sqrt(r.altura),
    inverseY: (y, dap) => (dap / y) ** 2,
    needsSmearing: false },

  // ===== EUCALIPTO adicionais (21–24) =====
  { id: 21, nome: 'Parabólico (Euc.)', especie: ['Eucalipto'], p: 3,
    expressao: 'h = β0 + β1·DAP + β2·DAP²',
    buildX: r => [1, r.dap, r.dap ** 2],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false },

  { id: 22, nome: 'Potencial (Euc.)', especie: ['Eucalipto'], p: 2,
    expressao: 'ln(h) = β0 + β1·ln(DAP)',
    buildX: r => [1, Math.log(r.dap)],
    transformY: r => Math.log(r.altura),
    inverseY: y => Math.exp(y),
    needsSmearing: true, logBase: 'ln' },

  { id: 23, nome: 'Exponencial (Euc.)', especie: ['Eucalipto'], p: 2,
    expressao: 'ln(h) = β0 + β1/DAP',
    buildX: r => [1, 1 / r.dap],
    transformY: r => Math.log(r.altura),
    inverseY: y => Math.exp(y),
    needsSmearing: true, logBase: 'ln' },

  { id: 24, nome: 'Semilogarítmico (Euc.)', especie: ['Eucalipto'], p: 2,
    expressao: 'h = β0 + β1·ln(DAP)',
    buildX: r => [1, Math.log(r.dap)],
    transformY: r => r.altura,
    inverseY: y => y,
    needsSmearing: false }
];

/**
 * Modelos não lineares (LM). Requerem função paramétrica e chute inicial.
 */
export const MODELOS_NAO_LINEARES = [
  { id: 26, nome: 'Chapman-Richards', especie: ['Eucalipto'], p: 3,
    expressao: 'h = β0·[1−exp(−β1·DAP)]^β2',
    fModel: (b, r) => b[0] * Math.pow(1 - Math.exp(-b[1] * r.dap), b[2]),
    chuteInicial: [25, 0.05, 1.0],
    p_para_stats: 3 },

  { id: 27, nome: 'Weibull (altura)', especie: ['Eucalipto'], p: 3,
    expressao: 'h = β0·[1−exp(−β1·DAP)^β2]',
    fModel: (b, r) => b[0] * (1 - Math.pow(Math.exp(-b[1] * r.dap), b[2])),
    chuteInicial: [25, 0.05, 1.0],
    p_para_stats: 3 },

  { id: 28, nome: 'Gompertz', especie: ['Eucalipto'], p: 3,
    expressao: 'h = β0·exp(−β1·exp(−β2·DAP))',
    fModel: (b, r) => b[0] * Math.exp(-b[1] * Math.exp(-b[2] * r.dap)),
    chuteInicial: [30, 2.0, 0.05],
    p_para_stats: 3 }
];

export function modelosPorEspecie(especie) {
  return {
    lineares: MODELOS_LINEARES.filter(m => m.especie.includes(especie)),
    naoLineares: MODELOS_NAO_LINEARES.filter(m => m.especie.includes(especie))
  };
}