/**
 * Álgebra matricial mínima — suficiente para OLS com até ~10 parâmetros.
 * Matrizes representadas como arrays de arrays: M[i][j].
 */

export function transpose(M) {
  const n = M.length, m = M[0].length;
  const T = Array.from({ length: m }, () => new Array(n));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++)
      T[j][i] = M[i][j];
  return T;
}

export function multiply(A, B) {
  const n = A.length, p = A[0].length, m = B[0].length;
  if (p !== B.length) throw new Error('Dimensões incompatíveis em multiply');
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
  return C;
}

export function matVec(A, v) {
  return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
}

/**
 * Inversão por eliminação de Gauss-Jordan com pivô parcial.
 * Lança erro se a matriz for singular (colinearidade).
 */
export function inverse(M) {
  const n = M.length;
  const aug = M.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  ]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++)
      if (Math.abs(aug[k][i]) > Math.abs(aug[pivot][i])) pivot = k;
    [aug[i], aug[pivot]] = [aug[pivot], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-12)
      throw new Error('Matriz singular (colinearidade entre preditores)');
    const p = aug[i][i];
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= p;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = aug[k][i];
      for (let j = 0; j < 2 * n; j++) aug[k][j] -= f * aug[i][j];
    }
  }
  return aug.map(row => row.slice(n));
}