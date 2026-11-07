/**
 * Ranking por soma de ranks (R²aj, Syx%, |Viés|).
 * Modelos com R²aj < R2AJ_MINIMO (escala original) são rejeitados do ranking
 * e devolvidos separadamente em 'problematicos'.
 */

import { R2AJ_MINIMO } from './constantes.js';

export function rankear(resultados) {
  if (resultados.length === 0) {
    return { rankeados: [], problematicos: [] };
  }

  // Rejeitar apenas os piores que a média (R²aj < 0).
  // Aceitar os que ficam abaixo do ideal (0 ≤ R²aj < R2AJ_MINIMO) com flag.
  const validos = resultados.filter(r => r.metricas.R2aj >= 0);
  const problematicos = resultados.filter(r => r.metricas.R2aj < 0);

  validos.forEach(r => {
    r.abaixoDoIdeal = r.metricas.R2aj < R2AJ_MINIMO;
  });

  if (validos.length === 0) {
    return { rankeados: [], problematicos };
  }

  const atribuirRanks = (valores, crescente) => {
    const idx = valores.map((v, i) => ({ v, i }));
    idx.sort((a, b) => crescente ? a.v - b.v : b.v - a.v);
    const ranks = new Array(valores.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
      const rankMedio = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[idx[k].i] = rankMedio;
      i = j + 1;
    }
    return ranks;
  };

  const rR2 = atribuirRanks(validos.map(r => r.metricas.R2aj), false);
  const rSyx = atribuirRanks(validos.map(r => r.metricas.SyxPct), true);
  const rVies = atribuirRanks(validos.map(r => Math.abs(r.metricas.vies)), true);

  validos.forEach((r, i) => {
    r.rankR2 = rR2[i];
    r.rankSyx = rSyx[i];
    r.rankVies = rVies[i];
    r.somaRanks = rR2[i] + rSyx[i] + rVies[i];
  });

  return {
    rankeados: validos.sort((a, b) => a.somaRanks - b.somaRanks),
    problematicos,
  };
}