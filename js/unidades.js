/**
 * Conversões de área (Premissas §16.8).
 * Alqueire paulista = 2,42 ha; mineiro/goiano = 4,84 ha (configurável).
 */
export const CONVERSOES_AREA = {
  m2:                { nome: 'm²',               paraHa: (v) => v / 10000, deHa: (v) => v * 10000 },
  ha:                { nome: 'hectares',         paraHa: (v) => v,         deHa: (v) => v },
  alqueire_paulista: { nome: 'alqueire (SP)',    paraHa: (v) => v * 2.42,  deHa: (v) => v / 2.42 },
  alqueire_mg:       { nome: 'alqueire (MG/GO)', paraHa: (v) => v * 4.84,  deHa: (v) => v / 4.84 },
};

export function paraHectares(valor, unidade) {
  const c = CONVERSOES_AREA[unidade];
  if (!c) throw new Error(`Unidade de área desconhecida: ${unidade}`);
  const v = Number(valor);
  if (!Number.isFinite(v) || v < 0) throw new Error(`Valor de área inválido: ${valor}`);
  return c.paraHa(v);
}