// js/desbaste.js
// Etapa 2.6 — Desbaste silvicultural.
//
// Tipos suportados:
//  · baixo          — remove as N árvores de menor DAP (ou H, se desempate).
//  · alto           — remove as N árvores de maior DAP (desbaste "por cima").
//  · sistematico    — remove 1 a cada N árvores (em ordem de fila).
//  · selectivo      — remove árvores dominadas/suprimidas e/ou com defeito.
//
// Critério de remoção:
//  · baixo: dap (crescente) → altura (crescente) → parcela/árvore (para estabilidade).
//  · alto:  dap (decrescente) → altura (decrescente) → parcela/árvore.
//  · sistematico: ordem original no ficheiro.
//  · selectivo: peso por classe sociológica e qualidade.
//
// A função NÃO muta a entrada — devolve dois arrays { remanescentes, removidas }.
// Cada árvore em `removidas` recebe `_motivoRemocao` para auditoria.

const ORDEM_SOCIO = {
  dominante: 4,
  codominante: 3,
  dominada: 2,
  suprimida: 1,
  morta: 0,
};

const QUALIDADES_LEVES = new Set([9, null, undefined]); // sem defeito significativo
const QUALIDADES_GRAVES = new Set([1, 2, 3, 4, 6, 10]); // falha, morta, bifurcação, dupla, copa quebrada

function chaveOrdenacao(a) {
  return `${String(a.parcela).padStart(10, '0')}-${String(a.arvore ?? 0).padStart(10, '0')}`;
}

// ---------------------------------------------------------------------------
// Seleção
// ---------------------------------------------------------------------------

function selecionarBaixo(arvores, nRemover) {
  const ordenadas = [...arvores].sort((a, b) => {
    if (a.dap !== b.dap) return a.dap - b.dap;
    if (a.altura !== b.altura) return a.altura - b.altura;
    return chaveOrdenacao(a).localeCompare(chaveOrdenacao(b));
  });
  return new Set(ordenadas.slice(0, nRemover).map(a => chaveOrdenacao(a)));
}

function selecionarAlto(arvores, nRemover) {
  const ordenadas = [...arvores].sort((a, b) => {
    if (a.dap !== b.dap) return b.dap - a.dap;
    if (a.altura !== b.altura) return b.altura - a.altura;
    return chaveOrdenacao(a).localeCompare(chaveOrdenacao(b));
  });
  return new Set(ordenadas.slice(0, nRemover).map(a => chaveOrdenacao(a)));
}

function selecionarSistematico(arvores, cadaN) {
  if (!(cadaN >= 2)) throw new Error('Frequência do desbaste sistemático deve ser ≥ 2.');
  const removidas = new Set();
  // Marca 1 a cada N, começando em N-1 (remove a 2ª, 4ª, ... se cadaN=2)
  arvores.forEach((a, i) => {
    if ((i + 1) % cadaN === 0) removidas.add(chaveOrdenacao(a));
  });
  return removidas;
}

function selecionarSelectivo(arvores, nRemover) {
  // Prioriza: suprimida/dominada > qualidade grave > menor DAP
  const score = (a) => {
    const socio = ORDEM_SOCIO[a.dominancia] ?? 3;
    const q = QUALIDADES_GRAVES.has(a.qualidade) ? 2
            : QUALIDADES_LEVES.has(a.qualidade) ? 0
            : 1;
    return socio * 10 + q * 3 + (a.dap || 0) * 0.01;
  };
  const ordenadas = [...arvores].sort((a, b) => {
    const sa = score(a), sb = score(b);
    if (sa !== sb) return sa - sb;
    return chaveOrdenacao(a).localeCompare(chaveOrdenacao(b));
  });
  return new Set(ordenadas.slice(0, nRemover).map(a => chaveOrdenacao(a)));
}

// ---------------------------------------------------------------------------
// Aplicação
// ---------------------------------------------------------------------------

/**
 * Aplica um desbaste.
 *
 * @param {Array} arvores       — linhas normalizadas do parser
 * @param {Object} config       — { tipo, nRemover?, cadaN?, removerMortas? }
 * @returns {{ remanescentes: Array, removidas: Array, resumo: Object }}
 */
export function aplicarDesbaste(arvores, config) {
  if (!Array.isArray(arvores) || arvores.length === 0) {
    return { remanescentes: [], removidas: [], resumo: { nAntes: 0, nDepois: 0, nRemovidas: 0 } };
  }

  const tipo = config?.tipo ?? 'baixo';
  const nAntes = arvores.length;

  // Remover mortas (qualidade=2) se solicitado — sempre antes do desbaste
  let base = arvores;
  const removidasMortas = [];
  if (config?.removerMortas) {
    base = [];
    for (const a of arvores) {
      if (a.qualidade === 2) {
        removidasMortas.push({ ...a, _motivoRemocao: 'morta (qualidade=2)' });
      } else {
        base.push(a);
      }
    }
  }

  let nRemover;
  let removidasSet;

  if (tipo === 'sistematico') {
    removidasSet = selecionarSistematico(base, config?.cadaN ?? 3);
    nRemover = removidasSet.size;
  } else {
    if (config?.nRemover != null && Number.isFinite(config.nRemover) && config.nRemover >= 0) {
      nRemover = Math.min(Math.round(config.nRemover), base.length);
    } else if (config?.intensidadePct != null) {
      nRemover = Math.round(base.length * (config.intensidadePct / 100));
    } else {
      nRemover = 0;
    }

    if (tipo === 'baixo')        removidasSet = selecionarBaixo(base, nRemover);
    else if (tipo === 'alto')    removidasSet = selecionarAlto(base, nRemover);
    else if (tipo === 'selectivo') removidasSet = selecionarSelectivo(base, nRemover);
    else throw new Error(`Tipo de desbaste desconhecido: ${tipo}`);
  }

  const remanescentes = [];
  const removidasDesbaste = [];
  for (const a of base) {
    if (removidasSet.has(chaveOrdenacao(a))) {
      removidasDesbaste.push({ ...a, _motivoRemocao: tipo });
    } else {
      remanescentes.push(a);
    }
  }

  const removidas = [...removidasMortas, ...removidasDesbaste];

  // Resumo para o log / UI
  const gAntes = arvores.reduce((s, a) => s + Math.PI * (a.dap / 200) ** 2, 0);
  const gDepois = remanescentes.reduce((s, a) => s + Math.PI * (a.dap / 200) ** 2, 0);
  const dapMedio = (arr) => arr.length
    ? arr.reduce((s, a) => s + a.dap, 0) / arr.length
    : null;
  const dg = (arr) => {
    if (!arr.length) return null;
    const g = arr.reduce((s, a) => s + Math.PI * (a.dap / 200) ** 2, 0);
    return 200 * Math.sqrt(g / (Math.PI * arr.length));
  };

  return {
    remanescentes,
    removidas,
    resumo: {
      tipo,
      nAntes,
      nDepois: remanescentes.length,
      nRemovidas: removidas.length,
      nRemovidasMortas: removidasMortas.length,
      gAntes,
      gDepois,
      gRemovidaPct: gAntes > 0 ? ((gAntes - gDepois) / gAntes) * 100 : 0,
      dapMedioAntes: dapMedio(arvores),
      dapMedioDepois: dapMedio(remanescentes),
      dgAntes: dg(arvores),
      dgDepois: dg(remanescentes),
    },
  };
}

/**
 * Rever uma configuração de desbaste — devolve o povoamento original.
 */
export function reverterDesbaste(arvoresOriginais) {
  return {
    remanescentes: [...arvoresOriginais],
    removidas: [],
    resumo: {
      tipo: 'nenhum',
      nAntes: arvoresOriginais.length,
      nDepois: arvoresOriginais.length,
      nRemovidas: 0,
    },
  };
}