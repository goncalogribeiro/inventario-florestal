/**
 * Regressão por mínimos quadrados ordinários (OLS).
 * β = (XᵀX)⁻¹ Xᵀ y
 */

import { transpose, multiply, matVec, inverse } from './algebra.js';

export function fitOLS(X, y) {
  const n = X.length, p = X[0].length;
  if (y.length !== n) throw new Error('X e y com dimensões incompatíveis');
    if (p >= n - 2) {
    throw new Error(
      `Modelo sobre-parametrizado: p=${p}, n=${n}. ` +
      `R²aj exige p < n−2 (pelo menos 2 graus de liberdade residuais).`
    );
  }

  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtX_inv = inverse(XtX);
  const Xty = matVec(Xt, y);
  const beta = matVec(XtX_inv, Xty);

  const yPred = matVec(X, beta);
  const residuals = y.map((yi, i) => yi - yPred[i]);
  const SQR = residuals.reduce((s, r) => s + r * r, 0);

  return { beta, yPred, residuals, SQR, n, p };
}

/**
 * Levenberg-Marquardt para modelos não lineares.
 * fModel(beta, x) → ŷ.
 */
export function fitLM(fModel, xData, yData, beta0, maxIter = 200, tol = 1e-8) {
  let beta = [...beta0];
  let lambda = 0.01;

  const sqr = (b) => yData.reduce((s, yi, i) => s + (yi - fModel(b, xData[i])) ** 2, 0);
  let SQR = sqr(beta);

    if (beta0.length >= xData.length - 2) {
    throw new Error(
      `Modelo não-linear sobre-parametrizado: p=${beta0.length}, n=${xData.length}.`
    );
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const J = xData.map((xi) => beta.map((bj, j) => {
      const bPlus = [...beta];
      bPlus[j] += 1e-6;
      return (fModel(bPlus, xi) - fModel(beta, xi)) / 1e-6;
    }));

    const residuals = yData.map((yi, i) => yi - fModel(beta, xData[i]));
    const Jt = transpose(J);
    const JtJ = multiply(Jt, J);
    const Jtr = matVec(Jt, residuals);

    for (let i = 0; i < JtJ.length; i++) JtJ[i][i] *= (1 + lambda);

    let delta;
    try { delta = matVec(inverse(JtJ), Jtr); }
    catch { lambda *= 10; continue; }

    const betaNovo = beta.map((b, i) => b + delta[i]);
    const SQRnovo = sqr(betaNovo);

    if (SQRnovo < SQR) {
      beta = betaNovo;
      lambda = Math.max(lambda / 10, 1e-9);
      if (Math.abs(SQR - SQRnovo) < tol * SQR) break;
      SQR = SQRnovo;
    } else {
      lambda *= 10;
    }
  }

  const yPred = xData.map(xi => fModel(beta, xi));
  const residuals = yData.map((yi, i) => yi - yPred[i]);
  const SQRfinal = residuals.reduce((s, r) => s + r * r, 0);

  return { beta, yPred, residuals, SQR: SQRfinal, n: xData.length, p: beta.length };
}

/**
 * Fator de correção por Smearing (Duan, 1983).
 * CF = (1/n) Σ exp(e_i), onde e_i é o resíduo na escala log.
 */
export function fatorSmearing(residuosLog) {
  const n = residuosLog.length;
  return residuosLog.reduce((s, e) => s + Math.exp(e), 0) / n;
}

/**
 * Fator de correção analítico de Baskerville.
 * SyxLog = erro padrão na escala log.
 */
export function fatorBaskerville(SyxLog, base = 'ln') {
  const v = Math.exp((SyxLog * SyxLog) / 2);
  if (base === 'ln') return v;
  if (base === 'log10') return Math.pow(10, Math.log10(v));
  throw new Error(`Base logarítmica desconhecida: ${base}`);
}