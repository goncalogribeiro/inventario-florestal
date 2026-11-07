// js/tabelas/referencia-idade.js
// Referências de percentagem de volume por sortimento (rank de nobreza)
// em função da idade do povoamento, para Pinus taeda.

export const REFERENCIA_IDADE = Object.freeze([
  Object.freeze({
    idadeMin: 7, idadeMax: 9,
    alvos: Object.freeze([0, 0, 20, 70, 10]),
    faixas: Object.freeze([
      { pctMin: 0, pctMax: 0 },   // Laminação
      { pctMin: 0, pctMax: 0 },   // Serraria 23
      { pctMin: 15, pctMax: 25 }, // Serraria 16
      { pctMin: 65, pctMax: 75 }, // Celulose
      { pctMin: 5, pctMax: 15 },  // Energia
    ]),
    fonte: 'Kohler et al. (2015); Embrapa (72% celulose no 1.º desbaste)',
  }),
  Object.freeze({
    idadeMin: 10, idadeMax: 12,
    alvos: Object.freeze([5, 15, 50, 25, 5]),
    faixas: Object.freeze([
      { pctMin: 0, pctMax: 5 },   // Laminação
      { pctMin: 10, pctMax: 20 }, // Serraria 23
      { pctMin: 45, pctMax: 55 }, // Serraria 16
      { pctMin: 20, pctMax: 30 }, // Celulose
      { pctMin: 3, pctMax: 8 },   // Energia
    ]),
    fonte: 'Kohler et al. (2015); IPEF (serraria 38-51%)',
  }),
  Object.freeze({
    idadeMin: 13, idadeMax: 15,
    alvos: Object.freeze([15, 25, 30, 20, 10]),
    faixas: Object.freeze([
      { pctMin: 10, pctMax: 20 }, // Laminação
      { pctMin: 20, pctMax: 30 }, // Serraria 23
      { pctMin: 25, pctMax: 35 }, // Serraria 16
      { pctMin: 15, pctMax: 25 }, // Celulose
      { pctMin: 3, pctMax: 8 },   // Energia
    ]),
    fonte: 'Kohler et al. (2014) — IPEF (laminação 25-44%)',
  }),
  Object.freeze({
    idadeMin: 16, idadeMax: 18,
    alvos: Object.freeze([25, 30, 25, 15, 5]),
    faixas: Object.freeze([
      { pctMin: 20, pctMax: 30 }, // Laminação
      { pctMin: 25, pctMax: 35 }, // Serraria 23
      { pctMin: 20, pctMax: 30 }, // Serraria 16
      { pctMin: 10, pctMax: 20 }, // Celulose
      { pctMin: 3, pctMax: 8 },   // Energia
    ]),
    fonte: 'Kohler et al. (2014) — IPEF (laminação 15-31%)',
  }),
  Object.freeze({
    idadeMin: 19, idadeMax: 22,
    alvos: Object.freeze([43, 33, 12, 8, 4]),
    faixas: Object.freeze([
      { pctMin: 40, pctMax: 48 }, // Laminação
      { pctMin: 30, pctMax: 35 }, // Serraria 23
      { pctMin: 10, pctMax: 15 }, // Serraria 16
      { pctMin: 5, pctMax: 8 },   // Celulose
      { pctMin: 3, pctMax: 5 },   // Energia
    ]),
    fonte: 'Santos et al. (2019) — referência SC (corte final)',
  }),
]);

const REFERENCIA_FALLBACK = REFERENCIA_IDADE[REFERENCIA_IDADE.length - 1];

export function obterAlvosPorIdade(idade) {
  if (!Number.isFinite(idade) || idade <= 0) {
    return {
      alvos: [...REFERENCIA_FALLBACK.alvos],
      faixas: [...REFERENCIA_FALLBACK.faixas],
      fonte: REFERENCIA_FALLBACK.fonte,
      faixa: { idadeMin: REFERENCIA_FALLBACK.idadeMin, idadeMax: REFERENCIA_FALLBACK.idadeMax },
    };
  }

  for (const ref of REFERENCIA_IDADE) {
    if (idade >= ref.idadeMin && idade <= ref.idadeMax) {
      return {
        alvos: [...ref.alvos],
        faixas: [...ref.faixas],
        fonte: ref.fonte,
        faixa: { idadeMin: ref.idadeMin, idadeMax: ref.idadeMax },
      };
    }
  }

  let melhor = REFERENCIA_IDADE[0];
  let melhorDist = Infinity;
  for (const ref of REFERENCIA_IDADE) {
    const pontoMedio = (ref.idadeMin + ref.idadeMax) / 2;
    const dist = Math.abs(idade - pontoMedio);
    if (dist < melhorDist) {
      melhorDist = dist;
      melhor = ref;
    }
  }

  return {
    alvos: [...melhor.alvos],
    faixas: [...melhor.faixas],
    fonte: melhor.fonte,
    faixa: { idadeMin: melhor.idadeMin, idadeMax: melhor.idadeMax },
  };
}