/**
 * Constantes globais do sistema.
 * Valores fixos definidos nas premissas v1.1.
 */

export const N_MINIMO = 10;         // ← 10 para teste; voltar a 30 em produção
export const N_AVISO_AMOSTRA = 30;  // abaixo disto emite aviso (não bloqueia).
export const CHAUVENET_MAX_ITER = 3;
export const CHAUVENET_Z_TETO = 3.0;
export const R2AJ_MINIMO = 0.40;    // mínimo de R²aj (escala original) para entrar no ranking

export const CHAUVENET_TABELA = {
  3: 1.38, 4: 1.54, 5: 1.65, 6: 1.73, 7: 1.80, 8: 1.86, 9: 1.92,
  10: 1.96, 12: 2.04, 15: 2.13, 20: 2.24, 25: 2.33, 30: 2.39,
  40: 2.50, 50: 2.58
};

export const T_STUDENT = {
  0.10: {
    1: 6.314, 2: 2.920, 3: 2.353, 4: 2.132, 5: 2.015,
    10: 1.812, 15: 1.753, 20: 1.725, 25: 1.708, 30: 1.697,
    40: 1.684, 60: 1.671, 120: 1.658, Infinity: 1.645
  },
  0.08: {
    1: 7.916, 2: 3.320, 3: 2.605, 4: 2.333, 5: 2.215,
    10: 1.948, 15: 1.878, 20: 1.841, 25: 1.820, 30: 1.806,
    40: 1.790, 60: 1.776, 120: 1.762, Infinity: 1.751
  },
  0.05: {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    10: 2.228, 15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042,
    40: 2.021, 60: 2.000, 120: 1.980, Infinity: 1.960
  }
};

export function tCritico(nivelSignif, gl) {
  const tabela = T_STUDENT[nivelSignif];
  if (!tabela) throw new Error(`Nível de significância não suportado: ${nivelSignif}`);
  if (tabela[gl] !== undefined) return tabela[gl];

  const chaves = Object.keys(tabela).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < chaves.length - 1; i++) {
    const glInf = chaves[i], glSup = chaves[i + 1];
    if (gl > glInf && gl < glSup) {
      const frac = (gl - glInf) / (glSup - glInf);
      return tabela[glInf] + frac * (tabela[glSup] - tabela[glInf]);
    }
  }
  return tabela[Infinity];
}