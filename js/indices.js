// js/indices.js
// Etapa 2.5.4 — Índices do povoamento + composição sociológica.
// Inclui: altura dominante (Assmann), sítio, IER, IDR, Dg, IMA,
// risco de vespa, e distribuição por classes de copa.
//
// Correção 2.5.4:
//   · bug de sintaxe: `ica: null,` estava solto como label no corpo de
//     calcularIndices → removido para `const ica = null` (dead field).

export const IDADE_INDICE_DEFAULT = 15;
export const SDI_MAX_PINUS_TAEDA = 1002;
export const SDI_MAX_PINUS_ELLIOTTII = 950;

export const FAIXAS_IER = {
  Pinus: { livre: 21, adequado: 18, desbaste: 16, severo: 14 },
  Eucalipto: { livre: 22, adequado: 19, desbaste: 17, severo: 15 },
};

export const IDR_MAX = {
  Pinus: 1100,
  Eucalipto: 1200,
};

// ---------------------------------------------------------------------------
// Altura dominante (Assmann)
// ---------------------------------------------------------------------------
export function alturaDominanteAssmann(arvores) {
  if (!Array.isArray(arvores) || arvores.length === 0) return null;

  const porParcela = new Map();
  for (const a of arvores) {
    if (!Number.isFinite(a.dap) || !Number.isFinite(a.altura)) continue;
    const key = String(a.parcela);
    if (!porParcela.has(key)) porParcela.set(key, []);
    porParcela.get(key).push(a);
  }

  const hDoms = [];
  for (const [_, lista] of porParcela) {
    if (lista.length === 0) continue;
    const areaM2 = Number(lista[0].area_parcela) || 0;
    if (!(areaM2 > 0)) continue;
    const n100 = Math.max(1, Math.round(100 * areaM2 / 10000));
    const ordenadas = [...lista].sort((a, b) => b.dap - a.dap);
    const selecionadas = ordenadas.slice(0, Math.min(n100, ordenadas.length));
    const hMedia = selecionadas.reduce((s, a) => s + a.altura, 0) / selecionadas.length;
    hDoms.push({ parcela: lista[0].parcela, hDom: hMedia, n100, areaM2 });
  }

  if (hDoms.length === 0) return null;

  const somaArea = hDoms.reduce((s, p) => s + p.areaM2, 0);
  const hDomPov = hDoms.reduce((s, p) => s + p.hDom * p.areaM2, 0) / somaArea;

  return { hDomPov, porParcela: hDoms, nParcelas: hDoms.length };
}

// ---------------------------------------------------------------------------
// IER — Hart-Becking
// ---------------------------------------------------------------------------
export function calcularIER(N_ha, hDom) {
  if (!(N_ha > 0) || !(hDom > 0)) return null;
  const EM = Math.sqrt(10000 / N_ha);
  return (100 * EM) / hDom;
}

export function classificarIER(ier, especie = 'Pinus') {
  if (!Number.isFinite(ier)) return { nivel: 'indefinido', cor: '#888', label: '—' };
  const f = FAIXAS_IER[especie] ?? FAIXAS_IER.Pinus;
  if (ier >= f.livre) return { nivel: 'livre', cor: '#007030', label: 'Livre de competição' };
  if (ier >= f.adequado) return { nivel: 'adequado', cor: '#5a9e7c', label: 'Adequado — monitorar' };
  if (ier >= f.desbaste) return { nivel: 'desbaste', cor: '#B8860B', label: 'Indicativo de desbaste' };
  if (ier >= f.severo) return { nivel: 'severo', cor: '#C00000', label: 'Competição severa' };
  return { nivel: 'subestocado', cor: '#fff', label: 'Subestocado' };
}

// ---------------------------------------------------------------------------
// SDI — Reineke
// ---------------------------------------------------------------------------
export function calcularSDI(N_ha, dg_cm) {
  if (!(N_ha > 0) || !(dg_cm > 0)) return null;
  return N_ha * Math.pow(dg_cm / 25, 1.605);
}

export function percentualSDI(sdi, sdiMax) {
  if (!(sdi > 0) || !(sdiMax > 0)) return null;
  return (sdi / sdiMax) * 100;
}

export function classificarIDR(pctIdr, especie = 'Pinus') {
  if (!Number.isFinite(pctIdr)) return { nivel: 'indefinido', cor: '#888', label: '—' };
  if (pctIdr < 30) return { nivel: 'subestocado', cor: '#fff', label: 'Livre crescimento' };
  if (pctIdr < 55) return { nivel: 'crescente', cor: '#007030', label: 'Competição crescente (IMA máx.)' };
  if (pctIdr < 100) return { nivel: 'iminente', cor: '#B8860B', label: 'Mortalidade iminente — desbastar' };
  return { nivel: 'critico', cor: '#C00000', label: 'Acima da capacidade — risco alto' };
}

// ---------------------------------------------------------------------------
// Dg
// ---------------------------------------------------------------------------
export function diametroQuadraticoMedio(G_ha_m2, N_ha) {
  if (!(G_ha_m2 > 0) || !(N_ha > 0)) return null;
  return 100 * Math.sqrt((4 * G_ha_m2) / (Math.PI * N_ha));
}

// ---------------------------------------------------------------------------
// IMA / ICA
// ---------------------------------------------------------------------------
export function calcularIMA(V_ha, idade) {
  if (!(V_ha > 0) || !(idade > 0)) return null;
  return V_ha / idade;
}

export function calcularICA(V_atual, V_anterior) {
  if (!Number.isFinite(V_atual) || !Number.isFinite(V_anterior)) return null;
  return V_atual - V_anterior;
}

// ---------------------------------------------------------------------------
// Risco de vespa-da-madeira (Sirex noctilio)
// ---------------------------------------------------------------------------
export function calcularRiscoVespa({ N_ha, idade, temMacacoPrego = false }) {
  let notaN = 0;
  if (N_ha > 1667) notaN = 2;
  else if (N_ha >= 1000) notaN = 1;

  let notaIdade = 0;
  if (idade > 11) notaIdade = 2;
  else if (idade >= 7) notaIdade = 1;

  const notaMacaco = temMacacoPrego ? 1 : 0;
  const risco = notaN + notaIdade + notaMacaco;

  const labels = ['Muito baixo', 'Baixo', 'Moderado', 'Alto', 'Muito alto', 'Crítico'];
  const cores = ['#007030', '#5a9e7c', '#B8860B', '#E67E22', '#C00000', '#8B0000'];

  return {
    risco,
    label: labels[risco] ?? '—',
    cor: cores[risco] ?? '#888',
    detalhe: `N=${notaN} · Idade=${notaIdade} · Macaco-prego=${notaMacaco}`,
  };
}

// ---------------------------------------------------------------------------
// Distribuição sociológica (classes de copa)
// ---------------------------------------------------------------------------
export function distribuicaoSociologica(arvores) {
  if (!Array.isArray(arvores) || arvores.length === 0) return null;

  const contagem = { dominante: 0, codominante: 0, dominada: 0, suprimida: 0, morta: 0 };
  let total = 0;
  let areaTotalM2 = 0;
  const areasVistas = new Set();

  for (const a of arvores) {
    const key = String(a.parcela);
    if (!areasVistas.has(key) && Number(a.area_parcela) > 0) {
      areasVistas.add(key);
      areaTotalM2 += Number(a.area_parcela);
    }
    const cc = a.dominancia;
    if (cc && contagem[cc] !== undefined) {
      contagem[cc]++;
      total++;
    }
  }

  if (total === 0) return null;

  const areaTotalHa = areaTotalM2 / 10000;
  const porHa = {};
  const pct = {};
  for (const [k, v] of Object.entries(contagem)) {
    porHa[k] = areaTotalHa > 0 ? v / areaTotalHa : 0;
    pct[k]  = total > 0 ? (v / total) * 100 : 0;
  }

  return { contagem, porHa, pct, total, areaTotalHa };
}

// ---------------------------------------------------------------------------
// H_dom por classe sociológica (alternativa ao Assmann por DAP)
// ---------------------------------------------------------------------------
export function alturaDominantePorClasse(arvores, classesAlvo = ['dominante', 'codominante']) {
  const alvoSet = new Set(classesAlvo);
  const porParcela = new Map();

  for (const a of arvores) {
    if (!Number.isFinite(a.dap) || !Number.isFinite(a.altura)) continue;
    if (!a.dominancia || !alvoSet.has(a.dominancia)) continue;
    const key = String(a.parcela);
    if (!porParcela.has(key)) porParcela.set(key, []);
    porParcela.get(key).push(a);
  }

  const hDoms = [];
  for (const [_, lista] of porParcela) {
    if (lista.length === 0) continue;
    const areaM2 = Number(lista[0].area_parcela) || 0;
    if (!(areaM2 > 0)) continue;
    const hMedia = lista.reduce((s, a) => s + a.altura, 0) / lista.length;
    hDoms.push({ parcela: lista[0].parcela, hDom: hMedia, n: lista.length, areaM2 });
  }

  if (hDoms.length === 0) return null;
  const somaArea = hDoms.reduce((s, p) => s + p.areaM2, 0);
  const hDomPov = hDoms.reduce((s, p) => s + p.hDom * p.areaM2, 0) / somaArea;
  return { hDomPov, porParcela: hDoms, nParcelas: hDoms.length };
}

// ---------------------------------------------------------------------------
// Densidade de dominantes (por ha e %)
// ---------------------------------------------------------------------------
export function densidadeDominantes(arvores) {
  const dist = distribuicaoSociologica(arvores);
  if (!dist) return null;
  return {
    totalDominantes: dist.contagem.dominante + dist.contagem.codominante,
    porHaDominantes: dist.porHa.dominante + dist.porHa.codominante,
    pctDominantes: dist.pct.dominante + dist.pct.codominante,
  };
}

// ---------------------------------------------------------------------------
// Pipeline completo
// ---------------------------------------------------------------------------
export function calcularIndices(opts) {
  const {
    arvores,
    povoamento,
    especie,
    idade,
    modeloVencedor = null,
  } = opts;

  if (!povoamento || !(idade > 0)) return null;

  const hDomInfo = alturaDominanteAssmann(arvores);
  const hDom = hDomInfo?.hDomPov ?? null;

  let indiceSitio = null;
  let modeloSitioNome = null;
  let idadeIndice = IDADE_INDICE_DEFAULT;
  if (hDom && modeloVencedor && modeloVencedor.modelo?.indiceSitio) {
    try {
      indiceSitio = modeloVencedor.modelo.indiceSitio(hDom, idade, modeloVencedor.beta);
      modeloSitioNome = modeloVencedor.modelo.nome ?? modeloVencedor.modelo.id;
      idadeIndice = modeloVencedor.idadeIndice ?? IDADE_INDICE_DEFAULT;
    } catch (e) {
      indiceSitio = null;
    }
  }

  const dg = diametroQuadraticoMedio(povoamento.G_ha, povoamento.N_ha);
  const ier = hDom ? calcularIER(povoamento.N_ha, hDom) : null;

  const idrMax = IDR_MAX[especie] ?? IDR_MAX.Pinus;
  const idr = dg ? povoamento.N_ha * Math.pow(dg / 25.4, 1.605) : null;
  const pctIdr = idr ? (idr / idrMax) * 100 : null;

  const ima = calcularIMA(povoamento.V_ha, idade);

  // ICA — incremento corrente anual. Requer inventário anterior
  // (V_ha @ idade anterior), indisponível nesta versão. A UI não mostra
  // este indicador; mantemos o campo `ica` no objeto devolvido por
  // compatibilidade com consumidores futuros (Fase 2 — prognose).
  const ica = null;

  const temMacacoPrego = Array.isArray(arvores)
    ? arvores.some(a => a.qualidade === 8)
    : false;
  const riscoVespa = calcularRiscoVespa({
    N_ha: povoamento.N_ha,
    idade,
    temMacacoPrego,
  });

  const distSocio = distribuicaoSociologica(arvores);
  const hDomPorClasse = alturaDominantePorClasse(arvores);
  const densDom = densidadeDominantes(arvores);

  return {
    idade,
    hDom,
    hDomPorParcela: hDomInfo?.porParcela ?? [],
    indiceSitio,
    idadeIndice,
    modeloSitio: modeloSitioNome,
    N_ha: povoamento.N_ha,
    dg,
    G_ha: povoamento.G_ha,
    V_ha: povoamento.V_ha,
    ier,
    ierClass: classificarIER(ier, especie),
    idr,
    idrMax,
    pctIdr,
    idrClass: classificarIDR(pctIdr, especie),
    ima,
    ica,
    riscoVespa,
    distSocio,
    hDomPorClasse,
    densDom,
  };
}