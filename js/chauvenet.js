/**
 * Filtro de Chauvenet — remove outliers de uma série.
 */

import { CHAUVENET_TABELA, CHAUVENET_MAX_ITER, CHAUVENET_Z_TETO } from './constantes.js';

function zCritico(n) {
  if (CHAUVENET_TABELA[n] !== undefined) return CHAUVENET_TABELA[n];
  if (n >= 50) return CHAUVENET_Z_TETO;
  const chaves = Object.keys(CHAUVENET_TABELA).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < chaves.length - 1; i++) {
    if (n > chaves[i] && n < chaves[i + 1]) {
      const frac = (n - chaves[i]) / (chaves[i + 1] - chaves[i]);
      return CHAUVENET_TABELA[chaves[i]] +
             frac * (CHAUVENET_TABELA[chaves[i + 1]] - CHAUVENET_TABELA[chaves[i]]);
    }
  }
  return CHAUVENET_Z_TETO;
}

export function filtrarChauvenet(itens, campoValor) {
  let validos = itens.map((it, idx) => ({ idx, v: it[campoValor], item: it }));
  validos = validos.filter(x => Number.isFinite(x.v));

  for (let iter = 0; iter < CHAUVENET_MAX_ITER; iter++) {
    const n = validos.length;
    if (n < 3) break;
    const media = validos.reduce((s, x) => s + x.v, 0) / n;
    const sigma = Math.sqrt(
      validos.reduce((s, x) => s + (x.v - media) ** 2, 0) / (n - 1)
    );
    if (sigma === 0) break;

    const zC = zCritico(n);
    const aceitos = validos.filter(x => Math.abs(x.v - media) / sigma <= zC);
    if (aceitos.length === validos.length) break;
    validos = aceitos;
  }
  return new Set(validos.map(x => x.idx));
}

export function filtrarHipsometria(linhas) {
  const validas = linhas.filter(l =>
    Number.isFinite(l.dap) && Number.isFinite(l.altura) &&
    l.dap > 0 && l.altura > 0
  );

  const idxDap = filtrarChauvenet(validas.map((l, i) => ({ i, dap: l.dap })), 'dap');
  const idxAlt = filtrarChauvenet(validas.map((l, i) => ({ i, altura: l.altura })), 'altura');

  const aceitos = validas.filter((_, i) => idxDap.has(i) && idxAlt.has(i));
  const rejeitados = validas.filter((_, i) => !(idxDap.has(i) && idxAlt.has(i)));
  return { aceitos, rejeitados };
}