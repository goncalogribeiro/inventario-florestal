// js/prognose.js
// Fase 2 — Prognose (projeção de crescimento).
//
// REALIDADE DO PLANTIO COMERCIAL (v2.8.2+):
//   · NÃO há ingrowth (recrutamento) — as árvores são as plantadas.
//   · O que existe é crescimento das árvores existentes + mortalidade.
//
// MODELO:
//   · H_dom via inversão do índice de sítio (bisseção numérica — agnóstico).
//   · Dg via Chapman-Richards (parâmetros default por espécie).
//   · N via mortalidade dependente da idade + autodesbaste por SDI (Reineke).
//   · Crescimento DIFERENCIAL: dominantes crescem mais que dominadas.
//   · Mortalidade DIFERENCIAL: pequenas/suprimidas morrem primeiro.
//   · Iteração de coerência: N/Dg/G finais batem com os projetados.
//
// O resultado alimenta o pipeline Power Taper existente via árvores sintéticas.

export const PROGNOSE_DEFAULTS = Object.freeze({
  idadeAlvo: null,
  mortalidadeJovem: 3.0,
  mortalidadeAdulta: 0.8,
  aplicarSDI: true,
  sdiOcupacaoMax: 0.55,
  sdiMaxPinus: 1002,
  sdiMaxEucalipto: 1200,
  crescimentoDiferencial: true,
  iteracoesCoerencia: 4,
});

const COEF_DG_DEFAULT = Object.freeze({
  Pinus:     { b1: 0.060, b2: 0.900 },
  Eucalipto: { b1: 0.090, b2: 0.950 },
});

const FATOR_SOCIAL = Object.freeze([
  { limite: 0.60, fator: 0.55 },
  { limite: 0.85, fator: 0.80 },
  { limite: 1.15, fator: 1.00 },
  { limite: 1.40, fator: 1.20 },
  { limite: Infinity, fator: 1.35 },
]);

// ---------------------------------------------------------------------------
// Geometria / densidade
// ---------------------------------------------------------------------------
export function diametroQuadratico(gHa, nHa) {
  if (!(gHa > 0) || !(nHa > 0)) return null;
  return 100 * Math.sqrt((4 * gHa) / (Math.PI * nHa));
}

export function areaBasalDeDg(dgCm, nHa) {
  if (!(dgCm > 0) || !(nHa > 0)) return null;
  return (Math.PI / 4) * Math.pow(dgCm / 100, 2) * nHa;
}

export function calcularSDI(nHa, dgCm) {
  if (!(nHa > 0) || !(dgCm > 0)) return null;
  return nHa * Math.pow(dgCm / 25, 1.605);
}

function dgDeArvores(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const somaG = arr.reduce((s, a) => s + Math.PI * Math.pow(a.dap / 200, 2), 0);
  const media = somaG / arr.length;
  return 200 * Math.sqrt(media / Math.PI);
}

function gDeArvores(arr) {
  return arr.reduce((s, a) => s + Math.PI * Math.pow(a.dap / 200, 2), 0);
}

// ---------------------------------------------------------------------------
// Mortalidade
// ---------------------------------------------------------------------------
export function taxaMortalidadePorIdade(idade, cfg) {
  if (idade <= 8) return cfg.mortalidadeJovem;
  if (idade >= 15) return cfg.mortalidadeAdulta;
  const t = (idade - 8) / (15 - 8);
  return cfg.mortalidadeJovem * (1 - t) + cfg.mortalidadeAdulta * t;
}

function vulnerabilidade(arvore, dgRef) {
  const razao = arvore.dap / dgRef;
  let v = 1 / Math.max(0.5, razao) ** 2;

  if (arvore.dominancia === 'suprimida') v *= 3.0;
  else if (arvore.dominancia === 'dominada') v *= 1.8;
  else if (arvore.dominante === 'dominante') v *= 0.3;
  else if (arvore.dominancia === 'dominante') v *= 0.3;
  else if (arvore.dominancia === 'codominante') v *= 0.6;

  if (arvore.qualidade === 1) v *= 2.0;
  if (arvore.qualidade === 2) v = Infinity;

  return v;
}

// ---------------------------------------------------------------------------
// Crescimento individual
// ---------------------------------------------------------------------------
function fatorCrescimentoSocial(razao) {
  for (const { limite, fator } of FATOR_SOCIAL) {
    if (razao < limite) return fator;
  }
  return 1.35;
}

// ---------------------------------------------------------------------------
// Projeção de H_dom via inversão do índice de sítio (bisseção)
// ---------------------------------------------------------------------------
function projetarHdom(hDomRef, idadeRef, idadeAlvo, modeloVencedorSitio) {
  const m = modeloVencedorSitio?.modelo;
  const beta = modeloVencedorSitio?.beta;
  if (!m?.indiceSitio || !Array.isArray(beta) || beta.length < 2) {
    return { hDom: hDomRef * Math.sqrt(idadeAlvo / idadeRef), fallback: true };
  }
  const Iref = modeloVencedorSitio.idadeIndice ?? 15;
  const IS = m.indiceSitio(hDomRef, idadeRef, beta, Iref);
  if (!(IS > 0)) {
    return { hDom: hDomRef * Math.sqrt(idadeAlvo / idadeRef), fallback: true };
  }
  let lo = IS * 0.3;
  let hi = IS * 3.0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const isMid = m.indiceSitio(mid, idadeAlvo, beta, Iref);
    if (!Number.isFinite(isMid)) break;
    if (isMid < IS) lo = mid; else hi = mid;
  }
  return { hDom: (lo + hi) / 2, fallback: false };
}

// ---------------------------------------------------------------------------
// Projeção de Dg via Chapman-Richards
// ---------------------------------------------------------------------------
function projetarDg(dgRef, idadeRef, idadeAlvo, coef) {
  const fRef  = Math.pow(1 - Math.exp(-coef.b1 * idadeRef),  coef.b2);
  const fAlvo = Math.pow(1 - Math.exp(-coef.b1 * idadeAlvo), coef.b2);
  if (!(fRef > 0) || !Number.isFinite(fAlvo)) return dgRef;
  return dgRef * (fAlvo / fRef);
}

// ---------------------------------------------------------------------------
// Projeção agregada (stand-level) — snapshots ano a ano
// ---------------------------------------------------------------------------
function projetarAgregado(estadoAtual, cfg, sdiMax) {
  const { idadeAtual, hDomAtual, dgAtual, nHaAtual } = estadoAtual;
  const coefDg = COEF_DG_DEFAULT[estadoAtual.especie] ?? COEF_DG_DEFAULT.Pinus;

  const idadeB = cfg.idadeAlvo > idadeAtual
    ? Math.round(cfg.idadeAlvo)
    : idadeAtual + 5;

  const snapshots = [];
  let hDom = hDomAtual;
  let dg = dgAtual;
  let nHa = nHaAtual;
  let avisoHdom = null;

  for (let a = Math.round(idadeAtual); a <= idadeB; a++) {
    const gHa = areaBasalDeDg(dg, nHa) ?? 0;
    const sdi = calcularSDI(nHa, dg);
    snapshots.push({
      idade: a,
      hDom, dg, nHa,
      gHa,
      sdi: sdi ?? 0,
      sdiOcupacao: sdi != null && sdiMax > 0 ? sdi / sdiMax : null,
      mortalidadeAno: null,
    });

    if (a === idadeB) break;

    const proxH = projetarHdom(hDomAtual, idadeAtual, a + 1, estadoAtual.modeloVencedorSitio);
    if (proxH.fallback && !avisoHdom) {
      avisoHdom = 'Índice de sítio indisponível — H_dom projetada por sqrt(idade).';
    }
    const proxDg = projetarDg(dgAtual, idadeAtual, a + 1, coefDg);

    const taxaAno = taxaMortalidadePorIdade(a, cfg) / 100;
    let proxN = nHa * (1 - taxaAno);

    if (cfg.aplicarSDI) {
      const sdiAlvo = sdiMax * cfg.sdiOcupacaoMax;
      const nSdiMax = sdiAlvo / Math.pow(proxDg / 25, 1.605);
      proxN = Math.min(proxN, nSdiMax);
    }
    proxN = Math.max(1, proxN);

    snapshots[snapshots.length - 1].mortalidadeAno = nHa - proxN;

    hDom = proxH.hDom;
    dg = proxDg;
    nHa = proxN;
  }

  return { snapshots, avisoHdom };
}

// ---------------------------------------------------------------------------
// Construção do povoamento sintético
// ---------------------------------------------------------------------------
function construirPovoamentoFuturo({
  arvoresAtuais, snapFinal, hDomAtual, dgAtual, areaAmostradaHa, cfg,
}) {
  const alvoDg = snapFinal.dg;
  const alvoH  = snapFinal.hDom;
  const alvoN  = Math.max(1, Math.round(snapFinal.nHa * areaAmostradaHa));

  const escalaH = alvoH / hDomAtual;

  let trabalhando = arvoresAtuais.map(a => {
    const razao = a.dap / dgAtual;
    const fator = cfg.crescimentoDiferencial ? fatorCrescimentoSocial(razao) : 1.0;
    return {
      ...a,
      _fatorSocial: fator,
      _dapBruto: a.dap * fator,
      _alturaBruta: a.altura * escalaH,
      _original: { dap: a.dap, altura: a.altura },
    };
  });

  let iter = 0;
  let dgAtingido = null;
  let nAtingido = trabalhando.length;

  while (iter < cfg.iteracoesCoerencia) {
    iter++;

    const dgBruto = dgDeArvores(trabalhando.map(a => ({ dap: a._dapBruto })));
    if (!(dgBruto > 0)) break;

    const escalaDap = alvoDg / dgBruto;
    trabalhando.forEach(a => {
      a._dapEscalado = a._dapBruto * escalaDap;
    });

    if (trabalhando.length > alvoN) {
      const dgRefIter = dgDeArvores(trabalhando.map(a => ({ dap: a._dapEscalado })));
      const ordenadas = [...trabalhando].sort((a, b) => {
        const va = vulnerabilidade({ ...a, dap: a._dapEscalado }, dgRefIter);
        const vb = vulnerabilidade({ ...b, dap: b._dapEscalado }, dgRefIter);
        return vb - va;
      });
      trabalhando = ordenadas.slice(trabalhando.length - alvoN);
    }

    const dgDepois = dgDeArvores(trabalhando.map(a => ({ dap: a._dapEscalado })));
    dgAtingido = dgDepois;
    nAtingido = trabalhando.length;

    const errDg = Math.abs(dgDepois - alvoDg) / alvoDg;
    const errN  = Math.abs(trabalhando.length - alvoN) / Math.max(1, alvoN);
    if (errDg < 0.001 && errN < 0.005) break;

    trabalhando.forEach(a => {
      a._dapBruto = a._dapEscalado;
    });
  }

  const dgRefFinal = dgDeArvores(trabalhando.map(a => ({ dap: a._dapEscalado })));
  const futuras = trabalhando.map(a => {
    const razao = a._dapEscalado / (dgRefFinal || dgAtual);
    let novaDominancia = a.dominancia;
    if (!novaDominancia) {
      if (razao >= 1.2) novaDominancia = 'dominante';
      else if (razao >= 0.85) novaDominancia = 'codominante';
      else if (razao >= 0.6) novaDominancia = 'dominada';
      else novaDominancia = 'suprimida';
    }
    return {
      parcela: a.parcela,
      arvore: a.arvore,
      dap: a._dapEscalado,
      altura: a._alturaBruta,
      area_parcela: a.area_parcela,
      qualidade: a.qualidade ?? null,
      dominancia: novaDominancia,
      altura_medida: false,
      _projetado: true,
      _original: a._original,
    };
  });

  return {
    futuras,
    diagnostico: {
      nInicial: arvoresAtuais.length,
      nFinal: futuras.length,
      nMortas: arvoresAtuais.length - futuras.length,
      dgAlvo: alvoDg,
      dgAtingido: dgRefFinal,
      nAlvo: alvoN,
      nAtingido,
      iteracoes: iter,
      fatorMedioDap: alvoDg / dgAtual,
    },
  };
}

// ---------------------------------------------------------------------------
// Pipeline público
// ---------------------------------------------------------------------------
export function projetarPovoamento(estadoAtual, opcoes = {}) {
  const cfg = { ...PROGNOSE_DEFAULTS, ...opcoes };

  const {
    idadeAtual, hDomAtual, dgAtual, nHaAtual, gHaAtual,
    areaAmostradaHa, modeloVencedorSitio, especie, arvoresAfiladas,
  } = estadoAtual;

  if (!(idadeAtual > 0)) return { erro: 'Idade atual inválida.' };
  if (!(hDomAtual > 0))  return { erro: 'hDom atual inválido.' };
  if (!(dgAtual > 0))    return { erro: 'Dg atual inválido.' };
  if (!(nHaAtual > 0))   return { erro: 'N/ha atual inválido.' };
  if (!Array.isArray(arvoresAfiladas) || arvoresAfiladas.length === 0) {
    return { erro: 'Sem árvores no povoamento atual.' };
  }

  const sdiMax = especie === 'Eucalipto' ? cfg.sdiMaxEucalipto : cfg.sdiMaxPinus;

  const { snapshots, avisoHdom } = projetarAgregado(
    { idadeAtual, hDomAtual, dgAtual, nHaAtual, especie, modeloVencedorSitio },
    cfg, sdiMax);

  const snapFinal = snapshots[snapshots.length - 1];

  let povo = { futuras: [], diagnostico: {} };
  let avisoPovo = null;
  try {
    povo = construirPovoamentoFuturo({
      arvoresAtuais: arvoresAfiladas,
      snapFinal,
      hDomAtual, dgAtual,
      areaAmostradaHa,
      cfg,
    });
  } catch (e) {
    avisoPovo = `Falha ao construir árvores futuras: ${e.message}`;
  }

  const diag = povo.diagnostico || {};
  const resumo = {
    idadeAtual: Math.round(idadeAtual),
    idadeAlvo: Math.round(cfg.idadeAlvo > idadeAtual ? cfg.idadeAlvo : idadeAtual + 5),
    hDomInicial: hDomAtual,
    hDomFinal: snapFinal.hDom,
    dgInicial: dgAtual,
    dgFinal: snapFinal.dg,
    nHaInicial: nHaAtual,
    nHaFinal: snapFinal.nHa,
    gHaInicial: gHaAtual,
    gHaFinal: snapFinal.gHa,
    deltaHdom: snapFinal.hDom - hDomAtual,
    deltaDg:   snapFinal.dg - dgAtual,
    deltaNha:  snapFinal.nHa - nHaAtual,
    deltaGha:  snapFinal.gHa - gHaAtual,
    sdiOcupacaoFinal: snapFinal.sdiOcupacao,
    nArvoresAtuais: arvoresAfiladas.length,
    nArvoresProjetadas: povo.futuras.length,
    nArvoresMortas: arvoresAfiladas.length - povo.futuras.length,
    dgAtingido: diag.dgAtingido,
    iteracoesCoerencia: diag.iteracoes,
  };

  return {
    erro: null,
    aviso: [avisoHdom, avisoPovo].filter(Boolean).join(' · ') || null,
    idadeAtual: resumo.idadeAtual,
    idadeAlvo: resumo.idadeAlvo,
    snapshots,
    resumo,
    arvoresFuturas: povo.futuras,
    cfgUsada: cfg,
  };
}