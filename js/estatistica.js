/**
 * Estatísticas de ajuste — todas calculadas na ESCALA ORIGINAL (metros).
 */

export function metricasModelo(observados, previstos, p) {
  const n = observados.length;
  const media = observados.reduce((s, v) => s + v, 0) / n;

  const SQT = observados.reduce((s, v) => s + (v - media) ** 2, 0);
  const SQR = observados.reduce((s, v, i) => s + (v - previstos[i]) ** 2, 0);

  const R2 = 1 - SQR / SQT;
  const R2aj = 1 - (1 - R2) * (n - 1) / (n - p);

  const Syx = Math.sqrt(SQR / (n - p));
  const SyxPct = (Syx / media) * 100;

  const DMP = (observados.reduce((s, v, i) =>
    s + Math.abs((v - previstos[i]) / v), 0) / n) * 100;

  const vies = ((previstos.reduce((s, v, i) => s + (v - observados[i]), 0) / n)
                 / media) * 100;

  const AIC = n * Math.log(SQR / n) + 2 * p;
  const BIC = n * Math.log(SQR / n) + p * Math.log(n);

  return { n, p, media, SQT, SQR, R2, R2aj, Syx, SyxPct, DMP, vies, AIC, BIC };
}