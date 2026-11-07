// js/tabelas/area-basal-referencia.js
// Referências de Área Basal (G) para Pinus taeda baseadas em:
// Mainardi (1996), Elesbão & Schneider (2011), Heberle (2024).
//
// ⚠ Este ficheiro é LEGADO. As funções activas vivem em
//    js/desbaste-diagnostico.js. Mantido para compatibilidade com
//    importações antigas.

export const REFERENCIA_AREA_BASAL = {
  gatilhoMin: 35,      // Abaixo disso, não há competição severa
  gatilhoIdeal: 40,    // Ponto de corte ideal (Mainardi)
  gatilhoMax: 45,      // Competição severa iminente (Elesbão)
  alvoPosDesbaste: 25, // G remanescente (Mainardi/Elesbão)
  estagnacaoDap: 30,   // Acima disso, o DAP estagna (Heberle)
};

/**
 * Avalia o estado da floresta em relação à Área Basal.
 * @param {number} gAtual - Área basal atual (m²/ha)
 * @param {number} idade - Idade em anos
 * @param {number} hDom - Altura dominante (m)
 */
export function diagnosticarAreaBasal(gAtual, idade, hDom) {
  const ref = REFERENCIA_AREA_BASAL;
  let status, cor, mensagem, acao;

  if (gAtual < ref.gatilhoMin) {
    status = 'Aguardar';
    cor = '#007030'; // Verde
    mensagem = 'A floresta está em fase de crescimento livre.';
    acao = 'Não há necessidade de desbaste imediato.';
  } else if (gAtual >= ref.gatilhoMin && gAtual < ref.gatilhoIdeal) {
    status = 'Ponto de Corte';
    cor = '#B8860B'; // Amarelo
    mensagem = 'A floresta atingiu o ponto de corte inicial.';
    acao = 'Pode aguardar, mas o desbaste já é tecnicamente viável.';
  } else if (gAtual >= ref.gatilhoIdeal && gAtual <= ref.gatilhoMax) {
    status = 'Ponto Ideal';
    cor = '#E67E22'; // Laranja
    mensagem = 'A floresta está na janela ideal de desbaste.';
    acao = 'Desbaste recomendado para maximizar o crescimento (DAP e Volume).';
  } else {
    status = 'Crítico';
    cor = '#C00000'; // Vermelho
    mensagem = 'Área basal excessiva. Competição severa instalada.';
    acao = '🚨 Desbaste URGENTE. Alto risco de estagnação e ataque de vespa.';
  }

  return { gAtual, status, cor, mensagem, acao, ref };
}