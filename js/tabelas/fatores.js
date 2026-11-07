/**
 * Tabelas intrínsecas de fator de forma e conversão m³→ton por espécie e idade
 * (Premissas §10, §16.1–§16.4). Todos os valores residem no código — não há
 * dependência de planilhas externas. Interpolação linear entre pontos.
 * Clamp fora dos extremos (não extrapola).
 *
 * Fontes:
 *  - Pinus (fator de forma e conversão): tabela fornecida pelo utilizador (Out/2026).
 *  - Eucalipto (fator de forma): curva monotónica do premissas v1.2 §16.2,
 *    compatível com valores pontuais da literatura (0,4577 @ 6,3 anos;
 *    0,47 @ 7 anos; 0,4797 médio).
 *  - Eucalipto (conversão): tabela explícita do premissas v1.2 §16.4.
 */

// =============================================================================
// PINUS — Fator de forma (idades 1–28)
// =============================================================================
export const FATOR_FORMA_PINUS = [
  { idade: 1,  f: 0.242 }, { idade: 2,  f: 0.257 }, { idade: 3,  f: 0.271 },
  { idade: 4,  f: 0.286 }, { idade: 5,  f: 0.301 }, { idade: 6,  f: 0.316 },
  { idade: 7,  f: 0.331 }, { idade: 8,  f: 0.345 }, { idade: 9,  f: 0.360 },
  { idade: 10, f: 0.375 }, { idade: 11, f: 0.390 }, { idade: 12, f: 0.403 },
  { idade: 13, f: 0.416 }, { idade: 14, f: 0.429 }, { idade: 15, f: 0.442 },
  { idade: 16, f: 0.455 }, { idade: 17, f: 0.468 }, { idade: 18, f: 0.480 },
  { idade: 19, f: 0.485 }, { idade: 20, f: 0.488 }, { idade: 21, f: 0.491 },
  { idade: 22, f: 0.495 }, { idade: 23, f: 0.498 }, { idade: 24, f: 0.502 },
  { idade: 25, f: 0.505 }, { idade: 26, f: 0.509 }, { idade: 27, f: 0.512 },
  { idade: 28, f: 0.515 },
];

// =============================================================================
// PINUS — Conversão m³ → ton (idades 5–25)
// =============================================================================
export const CONVERSAO_M3_TON_PINUS = [
  { idade: 5,  fator: 0.9047 }, { idade: 6,  fator: 0.9080 },
  { idade: 7,  fator: 0.9114 }, { idade: 8,  fator: 0.9147 },
  { idade: 9,  fator: 0.9180 }, { idade: 10, fator: 0.9213 },
  { idade: 11, fator: 0.9247 }, // interpolado entre 10 (0,9213) e 12 (0,9280) — corrige não-monotonia
  { idade: 12, fator: 0.9280 }, { idade: 13, fator: 0.9310 },
  { idade: 14, fator: 0.9340 }, { idade: 15, fator: 0.9370 },
  { idade: 16, fator: 0.9400 }, { idade: 17, fator: 0.9428 },
  { idade: 18, fator: 0.9455 }, { idade: 19, fator: 0.9483 },
  { idade: 20, fator: 0.9510 }, { idade: 21, fator: 0.9534 },
  { idade: 22, fator: 0.9559 }, { idade: 23, fator: 0.9583 },
  { idade: 24, fator: 0.9607 }, { idade: 25, fator: 0.9632 },
];

// =============================================================================
// EUCALIPTO — Fator de forma (idades 3–25)
// Premissas v1.2 §16.2: "default por SDI, editável".
// =============================================================================
export const FATOR_FORMA_EUCALIPTO = [
  { idade: 3,  f: 0.420 }, { idade: 4,  f: 0.440 }, { idade: 5,  f: 0.460 },
  { idade: 6,  f: 0.470 }, { idade: 7,  f: 0.480 }, { idade: 8,  f: 0.488 },
  { idade: 9,  f: 0.495 }, { idade: 10, f: 0.500 }, { idade: 12, f: 0.508 },
  { idade: 15, f: 0.515 }, { idade: 20, f: 0.520 }, { idade: 25, f: 0.525 },
];
// Justificação dos pontos: 6–7 anos ≈ 0,47–0,48 (literatura); 10 anos ≈ 0,50;
// curva monotónica até 0,525 aos 25 anos. Editável.

// =============================================================================
// EUCALIPTO — Conversão m³ → ton (idades 3–25)
// Premissas v1.2 §16.4 (tabela explícita).
// =============================================================================
export const CONVERSAO_M3_TON_EUCALIPTO = [
  { idade: 3,  fator: 0.92 }, { idade: 4,  fator: 0.94 },
  { idade: 5,  fator: 0.96 }, { idade: 6,  fator: 0.98 },
  { idade: 7,  fator: 1.00 }, { idade: 8,  fator: 1.02 },
  { idade: 9,  fator: 1.04 }, { idade: 10, fator: 1.06 },
  { idade: 12, fator: 1.08 }, { idade: 15, fator: 1.10 },
  { idade: 20, fator: 1.12 }, { idade: 25, fator: 1.14 },
];

// =============================================================================
// Registos internos
// =============================================================================
const TABELAS_FATOR_FORMA = {
  Pinus: FATOR_FORMA_PINUS,
  Eucalipto: FATOR_FORMA_EUCALIPTO,
};

const TABELAS_CONVERSAO = {
  Pinus: CONVERSAO_M3_TON_PINUS,
  Eucalipto: CONVERSAO_M3_TON_EUCALIPTO,
};

// =============================================================================
// Interpolação linear genérica
// =============================================================================
function interpolar(tabela, idade, campoValor = 'f') {
  if (!Number.isFinite(idade) || idade <= 0) {
    throw new Error(`Idade inválida: ${idade}`);
  }
  const primeiro = tabela[0];
  if (idade <= primeiro.idade) {
    return { valor: primeiro[campoValor], extrapolado: 'baixo' };
  }
  const ultimo = tabela[tabela.length - 1];
  if (idade >= ultimo.idade) {
    return { valor: ultimo[campoValor], extrapolado: 'alto' };
  }
  for (let i = 0; i < tabela.length - 1; i++) {
    const a = tabela[i], b = tabela[i + 1];
    if (idade >= a.idade && idade <= b.idade) {
      const t = (idade - a.idade) / (b.idade - a.idade);
      return {
        valor: a[campoValor] + t * (b[campoValor] - a[campoValor]),
        extrapolado: null,
      };
    }
  }
  throw new Error(`Interpolação falhou para idade=${idade}`);
}

// =============================================================================
// API pública — Fator de forma
// =============================================================================
/**
 * @param {string} especie - 'Pinus' | 'Eucalipto'
 * @param {number} idade - anos (aceita decimais)
 * @returns {{f: number, extrapolado: null|'baixo'|'alto'}}
 */
export function fatorFormaInterpolado(especie, idade) {
  const tabela = TABELAS_FATOR_FORMA[especie];
  if (!tabela) throw new Error(`Espécie sem tabela de fator de forma: ${especie}`);
  const r = interpolar(tabela, idade, 'f');
  return { f: r.valor, extrapolado: r.extrapolado };
}

/** Atalho: devolve apenas o valor numérico do fator. */
export function fatorForma(especie, idade) {
  return fatorFormaInterpolado(especie, idade).f;
}

// =============================================================================
// API pública — Conversão m³ → ton
// =============================================================================
/**
 * @param {string} especie - 'Pinus' | 'Eucalipto'
 * @param {number} idade - anos
 * @returns {{fator: number, extrapolado: null|'baixo'|'alto'}}
 */
export function conversaoM3TonInterpolada(especie, idade) {
  const tabela = TABELAS_CONVERSAO[especie];
  if (!tabela) throw new Error(`Espécie sem tabela de conversão m³→ton: ${especie}`);
  const r = interpolar(tabela, idade, 'fator');
  return { fator: r.valor, extrapolado: r.extrapolado };
}

/** Atalho: devolve apenas o fator numérico m³→ton. */
export function conversaoM3Ton(especie, idade) {
  return conversaoM3TonInterpolada(especie, idade).fator;
}

// =============================================================================
// Editabilidade em runtime
// =============================================================================
/**
 * Substitui uma tabela em runtime (edição pela UI).
 * @param {'fatorForma'|'conversao'} tipo
 * @param {string} especie
 * @param {Array<{idade:number, f?:number, fator?:number}>} tabela
 */
export function setTabela(tipo, especie, tabela) {
  if (!Array.isArray(tabela) || tabela.length < 2) {
    throw new Error('Tabela precisa de ≥ 2 pontos');
  }
  const campo = tipo === 'fatorForma' ? 'f' : 'fator';
  const ordenada = [...tabela]
    .map((p) => ({ idade: Number(p.idade), [campo]: Number(p[campo]) }))
    .sort((a, b) => a.idade - b.idade);
  for (let i = 0; i < ordenada.length; i++) {
    if (!Number.isFinite(ordenada[i].idade) || ordenada[i].idade <= 0) {
      throw new Error(`Idade inválida no ponto #${i}`);
    }
    if (!Number.isFinite(ordenada[i][campo]) || ordenada[i][campo] <= 0) {
      throw new Error(`Valor inválido no ponto #${i}`);
    }
    if (i > 0 && ordenada[i].idade === ordenada[i - 1].idade) {
      throw new Error(`Idades duplicadas: ${ordenada[i].idade}`);
    }
  }
  if (tipo === 'fatorForma') {
    TABELAS_FATOR_FORMA[especie] = ordenada;
  } else {
    TABELAS_CONVERSAO[especie] = ordenada;
  }
}

/** Atalhos de compatibilidade com o código anterior. */
export function setTabelaFatorForma(especie, tabela) {
  setTabela('fatorForma', especie, tabela);
}