/**
 * Volume por fator de forma, área basal e estatísticas do povoamento
 * (Premissas §9.2 e §15). Todas as agregações usam o estimador de razão
 * (área-ponderado), nunca média simples.
 *
 * Nota (Fix A — Out/2026):
 *  - estatisticasPovoamento soma a área das parcelas UMA vez cada
 *    (usa agregarPorParcela internamente).
 *  - volumeParaToneladas adicionado para a Etapa 2.3 (receita).
 */
import { fatorForma, conversaoM3Ton } from './tabelas/fatores.js';
// Etapa 2.2 — reexportação para conveniência (mantém a API do volume unificada)

export {
  enriquecerComAfilamento,
  agregarAfilamentoPorParcela,
  resumoAfilamentoPovoamento,
  validarIntegral,
} from './afilamento.js';

/** Área basal individual (m²). DAP em cm. */
export function areaBasalIndividual(dap_cm) {
  const d_m = dap_cm / 100;
  return (Math.PI / 4) * d_m * d_m;
}

/**
 * Volume individual (m³): V = f · (π/4) · (DAP/100)² · H
 */
export function volumeIndividual(dap_cm, altura_m, fator) {
  return fator * areaBasalIndividual(dap_cm) * altura_m;
}

/**
 * Enriquece cada árvore com `g` (m²) e `v` (m³). Não muta a entrada.
 * @param {Array} arvores - já normalizadas pelo parser
 * @param {string} especie
 * @param {number} idadeAnos
 * @param {number|null} fatorOverride - se fornecido, usa este f em vez da tabela
 */
export function calcularPorArvore(arvores, especie, idadeAnos, fatorOverride = null) {
  const fator = (fatorOverride !== null && Number.isFinite(fatorOverride))
    ? fatorOverride
    : fatorForma(especie, idadeAnos);

  return arvores.map((a) => {
    const dap = Number(a.dap);
    const h = Number(a.altura);
    const ap = Number(a.area_parcela);
    if (!Number.isFinite(dap) || dap <= 0) throw new Error(`DAP inválido (parcela ${a.parcela})`);
    if (!Number.isFinite(h) || h <= 0) throw new Error(`Altura inválida (parcela ${a.parcela})`);
    if (!Number.isFinite(ap) || ap <= 0) throw new Error(`Área inválida (${a.area_parcela}) na parcela ${a.parcela}`);
    return {
      ...a,
      dap, altura: h, area_parcela: ap,
      g: areaBasalIndividual(dap),
      v: volumeIndividual(dap, h, fator),
      fator,
    };
  });
}

/**
 * Agrega por parcela (estimador de razão, área-ponderado).
 */
export function agregarPorParcela(arvoresEnriquecidas) {
  const porParcela = new Map();
  for (const a of arvoresEnriquecidas) {
    const key = String(a.parcela);
    if (!porParcela.has(key)) {
      porParcela.set(key, {
        parcela: a.parcela, area_m2: a.area_parcela,
        n: 0, sumG: 0, sumV: 0, sumDAP: 0, sumH: 0, area_inconsistente: false,
      });
    }
    const p = porParcela.get(key);
    if (Math.abs(p.area_m2 - a.area_parcela) > 1e-6) p.area_inconsistente = true;
    p.n += 1; p.sumG += a.g; p.sumV += a.v; p.sumDAP += a.dap; p.sumH += a.altura;
  }
  const saida = [];
  for (const p of porParcela.values()) {
    const areaHa = p.area_m2 / 10000;
    saida.push({
      parcela: p.parcela, area_m2: p.area_m2, n: p.n,
      N_ha: p.n / areaHa,
      G_m2: p.sumG, G_ha: p.sumG / areaHa,
      V_m3: p.sumV, V_ha: p.sumV / areaHa,
      DAP_medio: p.sumDAP / p.n, H_media: p.sumH / p.n,
      area_inconsistente: p.area_inconsistente,
    });
  }
  saida.sort((a, b) => String(a.parcela).localeCompare(String(b.parcela), 'pt-BR', { numeric: true }));
  return saida;
}

/**
 * Estatísticas do povoamento inteiro (estimador de razão).
 * Área amostrada = soma das áreas DAS PARCELAS (uma vez cada), não das árvores.
 * Devolve métricas /ha e totais do projeto.
 */
export function estatisticasPovoamento(arvoresEnriquecidas, areaTotalHa) {
  if (!(areaTotalHa > 0)) throw new Error(`Área total inválida: ${areaTotalHa}`);
  if (arvoresEnriquecidas.length === 0) throw new Error('Sem árvores para estatísticas');

  const porParcela = agregarPorParcela(arvoresEnriquecidas);
  const sumA = porParcela.reduce((s, p) => s + p.area_m2, 0);

  let sumG = 0, sumV = 0, sumDAP = 0, sumH = 0, n = 0;
  let dapMin = Infinity, dapMax = -Infinity, hMin = Infinity, hMax = -Infinity;
  for (const a of arvoresEnriquecidas) {
    sumG += a.g; sumV += a.v; sumDAP += a.dap; sumH += a.altura; n += 1;
    if (a.dap < dapMin) dapMin = a.dap;
    if (a.dap > dapMax) dapMax = a.dap;
    if (a.altura < hMin) hMin = a.altura;
    if (a.altura > hMax) hMax = a.altura;
  }
  const fatorHa = 10000 / sumA;
  const N_ha = n * fatorHa, G_ha = sumG * fatorHa, V_ha = sumV * fatorHa;
  return {
    n_arvores: n,
    n_parcelas: porParcela.length,
    area_amostrada_m2: sumA,
    area_amostrada_ha: sumA / 10000,
    area_total_ha: areaTotalHa,
    fator_forma_aplicado: arvoresEnriquecidas[0]?.fator ?? null,
    N_ha, G_ha, V_ha,
    N_total: N_ha * areaTotalHa,
    G_total_m2: G_ha * areaTotalHa,
    V_total_m3: V_ha * areaTotalHa,
    DAP_medio: sumDAP / n, H_media: sumH / n,
    DAP_min: dapMin, DAP_max: dapMax, H_min: hMin, H_max: hMax,
  };
}

/**
 * Converte volume (m³) em toneladas para uma dada espécie e idade.
 * (Usado na Etapa 2.3 — receita.)
 */
export function volumeParaToneladas(volumeM3, especie, idadeAnos) {
  const fator = conversaoM3Ton(especie, idadeAnos);
  return volumeM3 * fator;
}