// js/tracamento.js
// Etapa 2.3.2 — Traçamento (bucking) por árvore.
// Modelo padrão: d(h) = DAP · ((H − h)/(H − 1,3))^β  (power taper).
//
// ⚠ DIRETRIZ v2.8.2: O parâmetro `opcoes.modelo` permite executar o motor
// em modo 'schoeffer' APENAS para comparação/diagnóstico. O pipeline
// oficial (receita, CEO, IC) usa sempre 'power-taper' (default).

import { diametroAAltura, H_DAP, H_STUMP } from './afilamento.js';
import { diametroSchoeffer, volumeSchoeffer } from './tabelas/schoeffer-primitivas.js';

export const COMPRIMENTO_MIN_ENERGIA = 1.0;

const EPS = 1e-6;

// ---------------------------------------------------------------------------
// Integrais (power taper)
// ---------------------------------------------------------------------------

/**
 * Volume (m³) de um segmento do fuste entre h1 e h2 (power taper).
 */
export function volumeSegmento(beta, dap, altura, h1, h2) {
  if (!Number.isFinite(beta) || !Number.isFinite(dap) || !Number.isFinite(altura)) return 0;
  if (beta <= 0 || dap <= 0 || altura <= H_DAP) return 0;
  const a = Math.max(0, Math.min(Number(h1), altura));
  const b = Math.max(0, Math.min(Number(h2), altura));
  if (!(b > a)) return 0;
  const g = (Math.PI / 4) * Math.pow(dap / 100, 2);
  const k = 2 * beta + 1;
  const Hm = altura - H_DAP;
  const u1 = (altura - a) / Hm;
  const u2 = (altura - b) / Hm;
  return g * Hm / k * (Math.pow(u1, k) - Math.pow(u2, k));
}

// ---------------------------------------------------------------------------
// Traçamento por árvore
// ---------------------------------------------------------------------------

/**
 * Traça uma árvore segundo um cenário.
 *
 * @param {Object} arvore - enriquecida (a.beta para power-taper,
 *                          a.volumeIntegralSchoeffer para schoeffer)
 * @param {Object} cenario - com `.classes[]`
 * @param {Object} [opcoes] - { modelo: 'power-taper' | 'schoeffer' }
 */
export function tracarArvore(arvore, cenario, opcoes = {}) {
  const modelo = opcoes.modelo ?? 'power-taper';

  if (!arvore || !Number.isFinite(arvore.dap) || !Number.isFinite(arvore.altura)) {
    return { erro: 'Árvore sem perfil válido (DAP/H)', arvore };
  }
  if (modelo === 'power-taper' && !Number.isFinite(arvore.beta)) {
    return { erro: 'Árvore sem perfil válido (β/DAP/H)', arvore };
  }
  if (arvore.altura <= H_DAP) {
    return { erro: 'Altura ≤ 1,3 m', arvore };
  }
  if (!cenario || !Array.isArray(cenario.classes) || cenario.classes.length === 0) {
    return { erro: 'Cenário sem classes', arvore };
  }

  const { beta, dap, altura } = arvore;

  const diametroFn = modelo === 'schoeffer'
    ? (h) => diametroSchoeffer(dap, altura, h)
    : (h) => diametroAAltura(beta, dap, altura, h);

  const volumeFn = modelo === 'schoeffer'
    ? (h1, h2) => volumeSchoeffer(dap, altura, h1, h2)
    : (h1, h2) => volumeSegmento(beta, dap, altura, h1, h2);

  const classesOrd = [...cenario.classes].sort((a, b) => b.dapMin - a.dapMin);

  const toras = [];
  let hCur = H_STUMP;

  while (hCur < altura - EPS) {
    let escolhida = null;
    for (const c of classesOrd) {
      if (!(c.comprimento > 0)) continue;
      const hFim = hCur + c.comprimento;
      if (hFim > altura + EPS) continue;
      const hRef = Math.min(hFim, altura);
      const dTopo = diametroFn(hRef);

      const passaMin = dTopo + EPS >= c.dapMin;
      const passaMax = c.dapMax == null || dTopo - EPS <= c.dapMax;
      if (passaMin && passaMax) { escolhida = c; break; }
    }
    if (!escolhida) break;

    const hFim = hCur + escolhida.comprimento;
    const hRef = Math.min(hFim, altura);
    toras.push({
      classe: escolhida.nome,
      comprimento: escolhida.comprimento,
      dapMin: escolhida.dapMin,
      dapMax: escolhida.dapMax ?? null,
      preco: escolhida.preco,
      h1: hCur,
      h2: hFim,
      dTopo: diametroFn(hRef),
      volume: volumeFn(hCur, hRef),
    });
    hCur = hFim;
  }

  let residuo = null;
  const residuoLen = altura - hCur;
  if (residuoLen > EPS) {
    const energia = cenario.classes.find(c => c.dapMin === 0);
    const volume = volumeFn(hCur, altura);
    if (energia && residuoLen + EPS >= COMPRIMENTO_MIN_ENERGIA) {
      residuo = {
        tipo: 'energia_reduzida',
        classe: energia.nome,
        preco: energia.preco,
        h1: hCur, h2: altura,
        comprimento: residuoLen,
        volume,
      };
    } else {
      residuo = {
        tipo: 'descartado',
        h1: hCur, h2: altura,
        comprimento: residuoLen,
        volume,
      };
    }
  }

  const volumeToco = volumeFn(0, H_STUMP);
  const volumeToras = toras.reduce((s, t) => s + t.volume, 0);
  const volumeResiduo = residuo ? residuo.volume : 0;
  const volumeTotal = volumeToco + volumeToras + volumeResiduo;

  const ref = modelo === 'schoeffer'
    ? (arvore.volumeIntegralSchoeffer ?? volumeSchoeffer(dap, altura, 0, altura))
    : arvore.volumeIntegral;

  const erroInvarianteRel = (Number.isFinite(ref) && ref > 0)
    ? Math.abs(volumeTotal - ref) / ref
    : null;

  return {
    arvore,
    modelo,
    toras,
    residuo,
    volumeToco,
    volumeToras,
    volumeResiduo,
    volumeTotal,
    volumeIntegralReferencia: ref,
    erroInvarianteRel,
    comprimentoToras: toras.reduce((s, t) => s + t.comprimento, 0),
    comprimentoResiduo: residuo ? residuo.comprimento : 0,
  };
}

export function tracarTodas(arvores, cenario, opcoes = {}) {
  return arvores.map(a => tracarArvore(a, cenario, opcoes));
}

// ---------------------------------------------------------------------------
// Consolidação
// ---------------------------------------------------------------------------

export function consolidarPorSortimento(tracamentos) {
  const porClasse = {};
  let nArvores = 0, nToras = 0, nTorasReduzidas = 0;
  let volumeToco = 0, volumeToras = 0, volumeResiduoEnergia = 0,
      volumeDescartado = 0, volumeTotal = 0;
  let erroMax = 0, nErros = 0;

  for (const t of tracamentos) {
    if (!t || t.erro) continue;
    nArvores++;

    volumeToco += t.volumeToco || 0;
    volumeToras += t.volumeToras || 0;
    volumeTotal += t.volumeTotal || 0;

    if (Number.isFinite(t.erroInvarianteRel)) {
      if (t.erroInvarianteRel > erroMax) erroMax = t.erroInvarianteRel;
      if (t.erroInvarianteRel > 1e-3) nErros++;
    }

    for (const tora of t.toras) {
      const key = tora.classe;
      if (!porClasse[key]) {
        porClasse[key] = {
          nome: key, dapMin: tora.dapMin, preco: tora.preco,
          comprimento: tora.comprimento,
          nToras: 0, nTorasReduzidas: 0, volume: 0,
        };
      }
      porClasse[key].nToras++;
      porClasse[key].volume += tora.volume;
      nToras++;
    }

    if (t.residuo) {
      if (t.residuo.tipo === 'energia_reduzida') {
        const key = t.residuo.classe;
        if (!porClasse[key]) {
          porClasse[key] = {
            nome: key, dapMin: 0, preco: t.residuo.preco,
            comprimento: null,
            nToras: 0, nTorasReduzidas: 0, volume: 0,
          };
        }
        porClasse[key].nToras++;
        porClasse[key].nTorasReduzidas++;
        porClasse[key].volume += t.residuo.volume;
        nToras++;
        nTorasReduzidas++;
        volumeResiduoEnergia += t.residuo.volume;
      } else {
        volumeDescartado += t.residuo.volume;
      }
    }
  }

  return {
    porClasse,
    nArvores,
    nToras,
    nTorasReduzidas,
    volumeToco,
    volumeToras,
    volumeResiduoEnergia,
    volumeDescartado,
    volumeComercial: volumeToras + volumeResiduoEnergia,
    volumeTotal,
    erroMax,
    nErros,
  };
}

// ---------------------------------------------------------------------------
// Receita
// ---------------------------------------------------------------------------

export function calcularReceita(consolidado, cenario, fatorM3Ton, opcoes = {}) {
  const { incluirEnergia = true } = opcoes;
  if (!(fatorM3Ton > 0)) throw new Error(`Fator m³→ton inválido: ${fatorM3Ton}`);

  const porClasse = {};
  let receitaTotal = 0, tonComercial = 0, volComercial = 0;

  for (const [nome, c] of Object.entries(consolidado.porClasse)) {
    const classeCenario = cenario.classes.find(k => k.nome === nome);
    const preco = classeCenario ? classeCenario.preco : c.preco;
    const dapMin = classeCenario ? classeCenario.dapMin : c.dapMin;
    const ehEnergia = dapMin === 0;
    const contabilizado = incluirEnergia || !ehEnergia;

    const toneladas = c.volume * fatorM3Ton;
    const receita = toneladas * preco;

    porClasse[nome] = {
      ...c,
      preco,
      ehEnergia,
      contabilizado,
      toneladas,
      receita,
    };

    volComercial += c.volume;

    if (contabilizado) {
      receitaTotal += receita;
      tonComercial += toneladas;
    }
  }

  return {
    porClasse,
    receitaTotal,
    tonComercial,
    volComercial,
    fatorM3Ton,
    incluirEnergia,
  };
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export function validarTracamento(tracamentos, tolerancia = 1e-3) {
  let nVerificados = 0, nIgnorados = 0;
  const erros = [];
  for (const t of tracamentos) {
    if (!t || t.erro) { nIgnorados++; continue; }
    nVerificados++;
    if (Number.isFinite(t.erroInvarianteRel) && t.erroInvarianteRel > tolerancia) {
      erros.push({
        parcela: t.arvore?.parcela,
        arvore: t.arvore?.arvore,
        volumeIntegral: t.volumeIntegralReferencia,
        volumeCalculado: t.volumeTotal,
        erroRel: t.erroInvarianteRel,
      });
    }
  }
  return { nVerificados, nIgnorados, erros };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function processarCenario(arvores, cenario, fatorM3Ton, opcoes = {}) {
  const tracamentos = tracarTodas(arvores, cenario, opcoes);
  const consolidado = consolidarPorSortimento(tracamentos);
  const receitaComEnergia = calcularReceita(
    consolidado, cenario, fatorM3Ton, { incluirEnergia: true }
  );
  const receitaSemEnergia = calcularReceita(
    consolidado, cenario, fatorM3Ton, { incluirEnergia: false }
  );
  const validacao = validarTracamento(tracamentos);
  return {
    cenario,
    modelo: opcoes.modelo ?? 'power-taper',
    tracamentos,
    consolidado,
    receitaComEnergia,
    receitaSemEnergia,
    validacao,
  };
}