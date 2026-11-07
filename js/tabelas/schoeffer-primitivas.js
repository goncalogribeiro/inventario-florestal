// js/tabelas/schoeffer-primitivas.js
// Primitivas matemáticas do modelo Schöepfer-SC (Santos et al., 2019).
// Módulo de FOLHA — sem imports. Seguro para qualquer camada.
//
// ⚠ DIRETRIZ v2.8.2: USO EXCLUSIVO de diagnóstico/comparação.
// NUNCA alimenta o pipeline oficial (traçamento, receita, CEO, IC).

export const SCHOEPFER_COEF = Object.freeze({
  b0:  1.243829,
  b1: -3.888341,
  b2: 16.107444,
  b3: -34.951103,
  b4: 33.086277,
  b5: -11.597225,
  R2aj: 0.988,
  SxyPct: 7.28,
  referencia: 'Santos et al. (2019). Biofix Sci J. 4(1):35-42. P. taeda, SC — conjunto total.',
});

export function diametroSchoeffer(dap, altura, h, coef = SCHOEPFER_COEF) {
  if (!(dap > 0) || !(altura > 0)) return 0;
  if (h < 0 || h > altura) return 0;
  const t = h / altura;
  const t2 = t * t;
  const P = coef.b0
          + coef.b1 * t
          + coef.b2 * t2
          + coef.b3 * t2 * t
          + coef.b4 * t2 * t2
          + coef.b5 * t2 * t2 * t;
  return Math.max(0, dap * P);
}

export function volumeSchoeffer(dap, altura, h1, h2, nSimpson = 200) {
  if (!(dap > 0) || !(altura > 0)) return 0;
  h1 = Math.max(0, h1);
  h2 = Math.min(altura, h2);
  if (!(h2 > h1)) return 0;
  const n = nSimpson;
  const dh = (h2 - h1) / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const h = h1 + i * dh;
    const d = diametroSchoeffer(dap, altura, h);
    const v = (Math.PI / 4) * Math.pow(d / 100, 2);
    const w = (i === 0 || i === n) ? 1 : ((i % 2 === 0) ? 2 : 4);
    sum += w * v;
  }
  return sum * dh / 3;
}

export function alturaOndeDiametroIgual(dap, altura, d) {
  if (d <= 0) return altura;
  const dBase = diametroSchoeffer(dap, altura, 0);
  if (d >= dBase) return 0;
  let lo = 0, hi = altura;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const dMid = diametroSchoeffer(dap, altura, mid);
    if (dMid > d) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}