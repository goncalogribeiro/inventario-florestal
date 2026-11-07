// js/cenarios.js
// Etapa 2.3.1 — Cenários de traçamento.
//
// V2 (Out/2026): cenários editáveis pelo utilizador.
//  · Cada classe tem dapMin (obrigatório) e dapMax (opcional, default null
//    = sem limite). A condição de aceitação de uma tora é
//    dTopo >= dapMin AND (dapMax == null OR dTopo <= dapMax).
//  · Persistência em localStorage (chave "inventario-florestal:cenarios").
//  · Defaults §17.2 funcionam como ponto de partida e como "restore".

export const COMPRIMENTO_MIN_ENERGIA = 1.0;

const CHAVE_STORAGE = 'inventario-florestal:cenarios';

const DEFAULTS = Object.freeze({
  Pessimista: {
    nome: 'Pessimista',
    classes: [
      { nome: 'Energia',     comprimento: 2.00, dapMin:  0, dapMax: null, preco:  10 },
      { nome: 'Celulose',    comprimento: 2.40, dapMin:  8, dapMax: null, preco: 150 },
      { nome: 'Caixaria_18', comprimento: 3.05, dapMin: 18, dapMax: null, preco: 230 },
      { nome: 'Caixaria_25', comprimento: 3.05, dapMin: 25, dapMax: null, preco: 330 },
      { nome: 'Caixaria_35', comprimento: 3.05, dapMin: 35, dapMax: null, preco: 410 },
    ],
  },
  Realista: {
    nome: 'Realista',
    classes: [
      { nome: 'Energia',     comprimento: 1.20, dapMin:  0, dapMax: null, preco:  30 },
      { nome: 'Celulose',    comprimento: 2.40, dapMin:  6, dapMax: null, preco: 165 },
      { nome: 'Serraria_16', comprimento: 2.55, dapMin: 16, dapMax: null, preco: 250 },
      { nome: 'Serraria_23', comprimento: 2.65, dapMin: 23, dapMax: null, preco: 350 },
      { nome: 'Lam',         comprimento: 2.65, dapMin: 33, dapMax: null, preco: 440 },
    ],
  },
  Otimista: {
    nome: 'Otimista',
    classes: [
      { nome: 'Energia',     comprimento: 1.00, dapMin:  0, dapMax: null, preco:  60 },
      { nome: 'Celulose',    comprimento: 2.40, dapMin:  6, dapMax: null, preco: 180 },
      { nome: 'Pallet',      comprimento: 2.65, dapMin: 16, dapMax: null, preco: 275 },
      { nome: 'Torno',       comprimento: 2.55, dapMin: 23, dapMax: null, preco: 375 },
      { nome: 'Lam',         comprimento: 2.40, dapMin: 33, dapMax: null, preco: 475 },
    ],
  },
});

/** Devolve uma cópia profunda dos cenários default. */
export function obterCenariosDefault() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

/** Lista de nomes dos cenários default. */
export function obterNomesCenarios() {
  return Object.keys(DEFAULTS);
}

/**
 * Valida um cenário. Regras (§17.4 + dapMax):
 *  · Pelo menos 1 classe com dapMin = 0 (energia) — no máximo 1
 *  · comprimento > 0, preco >= 0, dapMin >= 0
 *  · dapMax (se não nulo) finito e > dapMin
 *  · nomes de classe únicos
 */
export function validarCenario(cenario) {
  const erros = [];
  if (!cenario || typeof cenario !== 'object') {
    return { ok: false, erros: ['Cenário inválido (não é objeto).'] };
  }
  if (!cenario.nome) erros.push('Cenário sem nome.');

  if (!Array.isArray(cenario.classes) || cenario.classes.length === 0) {
    erros.push('Cenário sem classes.');
    return { ok: false, erros };
  }

  let nDapMinZero = 0;
  for (const c of cenario.classes) {
    if (!c.nome) erros.push('Classe sem nome.');
    if (!(c.comprimento > 0)) erros.push(`Classe "${c.nome}": comprimento inválido (${c.comprimento}).`);
    if (!(c.dapMin >= 0)) erros.push(`Classe "${c.nome}": dapMin inválido (${c.dapMin}).`);
    if (!(c.preco >= 0)) erros.push(`Classe "${c.nome}": preço inválido (${c.preco}).`);
    if (c.dapMax != null) {
      if (!Number.isFinite(c.dapMax)) {
        erros.push(`Classe "${c.nome}": dapMax inválido (${c.dapMax}).`);
      } else if (!(c.dapMax > c.dapMin)) {
        erros.push(`Classe "${c.nome}": dapMax (${c.dapMax}) deve ser maior que dapMin (${c.dapMin}).`);
      }
    }
    if (c.dapMin === 0) nDapMinZero++;
  }
  if (nDapMinZero === 0) erros.push('Cenário precisa de uma classe com DAPMin = 0 (Energia).');
  if (nDapMinZero > 1) erros.push('Apenas uma classe pode ter DAPMin = 0.');

  const nomes = cenario.classes.map(c => c.nome);
  const dup = nomes.filter((n, i) => nomes.indexOf(n) !== i);
  if (dup.length > 0) erros.push(`Nomes duplicados: ${[...new Set(dup)].join(', ')}.`);

  return { ok: erros.length === 0, erros };
}

/**
 * Deriva o conjunto de dMin (> 0) presentes em N cenários.
 * Usado para enriquecer as árvores com H_c nos pontos que interessam.
 */
export function dMinimosDeCenarios(cenarios) {
  const lista = Array.isArray(cenarios) ? cenarios : Object.values(cenarios);
  const set = new Set();
  for (const c of lista) {
    for (const k of c.classes) {
      if (k.dapMin > 0) set.add(k.dapMin);
    }
  }
  return [...set].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Persistência (localStorage)
// ---------------------------------------------------------------------------

/**
 * Lê os cenários do localStorage. Fallback para defaults se a chave
 * estiver vazia, corrompida ou em formato inesperado. Normaliza campos
 * em falta (ex.: migração de schemas antigos sem dapMax).
 */
export function carregarCenarios() {
  try {
    const salvo = localStorage.getItem(CHAVE_STORAGE);
    if (!salvo) return obterCenariosDefault();
    const parsed = JSON.parse(salvo);
    if (!parsed || typeof parsed !== 'object') return obterCenariosDefault();
    // Normalização: garante que cada classe tem dapMax
    for (const cen of Object.values(parsed)) {
      if (!cen || !Array.isArray(cen.classes)) continue;
      for (const cls of cen.classes) {
        if (!('dapMax' in cls)) cls.dapMax = null;
      }
    }
    return parsed;
  } catch (e) {
    console.warn('Falha ao ler cenários salvos, usando defaults:', e);
    return obterCenariosDefault();
  }
}

/** Salva os cenários em localStorage. Devolve true em sucesso. */
export function salvarCenarios(cenarios) {
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(cenarios));
    return true;
  } catch (e) {
    console.warn('Falha ao salvar cenários:', e);
    return false;
  }
}

/** Devolve uma cópia fresca de um cenário default, pelo nome. */
export function restaurarCenarioDefault(nome) {
  const padrao = DEFAULTS[nome];
  if (!padrao) throw new Error(`Cenário default desconhecido: ${nome}`);
  return JSON.parse(JSON.stringify(padrao));
}

/** Devolve uma cópia fresca de todos os cenários default. */
export function restaurarTodosDefaults() {
  const resultado = {};
  for (const nome of Object.keys(DEFAULTS)) {
    resultado[nome] = restaurarCenarioDefault(nome);
  }
  return resultado;
}