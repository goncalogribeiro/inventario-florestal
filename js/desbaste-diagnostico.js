// js/desbaste-diagnostico.js
// Motor de projeção e diagnóstico ajustado ao Índice de Sítio local.

export const REFERENCIA_G = {
  isRef: 24,       // Índice de Sítio de referência (metros) da literatura base
  gIdeal: 40,      // G ideal para IS 24
  gMax: 45,        // G máximo para IS 24
  fatorSitio: 1.5, // Quanto a G varia por metro de Sítio (heurística baseada em Assmann)
};

/**
 * Calcula os limites de Área Basal ajustados ao Sítio local.
 * @param {number} isLocal - Índice de Sítio do povoamento (m)
 */
export function obterLimitesAreaBasal(isLocal) {
  // Se não tivermos IS, assume a referência
  const is = Number.isFinite(isLocal) ? isLocal : REFERENCIA_G.isRef;
  
  const deltaIS = is - REFERENCIA_G.isRef;
  
  return {
    gatilhoMin: Math.max(25, 35 + (deltaIS * REFERENCIA_G.fatorSitio)), 
    gatilhoIdeal: Math.max(30, 40 + (deltaIS * REFERENCIA_G.fatorSitio)),
    gatilhoMax: Math.max(35, 45 + (deltaIS * REFERENCIA_G.fatorSitio)),
    isLocal: is,
    isRef: REFERENCIA_G.isRef
  };
}

/**
 * Estima o Número Potencial de Árvores (Np) baseado na Altura Dominante (Padoin, 2007).
 * (Mantido, mas com espaço para futura regressão local).
 */
export function calcularNpPadoin(hDom, sPorcento = 14) {
  let b0, b1;
  if (sPorcento > 14) {
    b0 = 10.31285; b1 = -1.28518;
  } else {
    b0 = 10.36304; b1 = -1.16938;
  }
  const lnNp = b0 + (b1 * Math.log(hDom));
  return Math.exp(lnNp);
}

/**
 * Projeta o crescimento da Área Basal (G) nos próximos anos.
 */
export function projetarCrescimentoAreaBasal(gAtual, idade, gMaxLocal, intensidade = 'moderado') {
  if (gAtual >= gMaxLocal) return { anosParaMax: 0, gFutura: gAtual, taxa: 0 };

  let taxaCrescimentoAnual = 1.5; // padrão
  
  if (idade <= 10) {
    if (intensidade === 'leve') taxaCrescimentoAnual = Math.max(1, -1.0324 * idade + 9.9527);
    else if (intensidade === 'moderado') taxaCrescimentoAnual = Math.max(1, -0.2956 * idade + 6.3254);
    else taxaCrescimentoAnual = Math.max(1, -0.2218 * idade + 5.6074);
  }

  const diferenca = gMaxLocal - gAtual;
  const anosParaMax = Math.ceil(diferenca / taxaCrescimentoAnual);

  return {
    anosParaMax,
    gFutura: gMaxLocal,
    taxa: taxaCrescimentoAnual
  };
}