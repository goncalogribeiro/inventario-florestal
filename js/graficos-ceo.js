// js/graficos-ceo.js
// Etapa 2.4.5 — Valores do povoamento + % no sub-rótulo.
//               Sensibilidade a preço −20% + IC 95% com escalas independentes.
//               FPC (Correção para População Finita) no cálculo de n_ideal.
//
// Decisões v2.4.6:
//  · IC: escala independente por barra (volume em m³, receita em R$).
//    Erro relativo (%) destacado como métrica comparável entre unidades.
//  · Sensibilidade: recálculo com preço da classe dominante −20%.
//  · FPC aplicado ao n_ideal para refletir a área total do povoamento.

import { construirMapaCores } from './graficos.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function fmt(n, casas = 0) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function fmtMoeda(n) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) {
    return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }) + ' M';
  }
  if (Math.abs(n) >= 1e3) {
    return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }) + ' mil';
  }
  return 'R$ ' + fmt(n, 2);
}

function el(tag, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== null) node.textContent = text;
  return node;
}

function receitaDe(r, vistaEnergia) {
  return vistaEnergia === 'sem' ? r.receitaSemEnergia : r.receitaComEnergia;
}

function cenarioVencedor(resultados, vistaEnergia) {
  let vencedor = null;
  let maiorReceita = -Infinity;
  for (const [nome, r] of Object.entries(resultados)) {
    const rec = receitaDe(r, vistaEnergia);
    if (rec.receitaTotal > maiorReceita) {
      maiorReceita = rec.receitaTotal;
      vencedor = nome;
    }
  }
  return { nome: vencedor, receita: maiorReceita };
}

// ---------------------------------------------------------------------------
// Tabela t de Student (95% bilateral)
// ---------------------------------------------------------------------------

const T_TABLE_95 = [
  [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571],
  [6, 2.447], [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228],
  [15, 2.131], [20, 2.086], [25, 2.060], [30, 2.042],
  [60, 2.000], [120, 1.980], [Infinity, 1.960],
];

function tStudent(gl, confianca = 0.95) {
  if (Math.abs(confianca - 0.95) > 0.001) {
    if (confianca === 0.90) return 1.645;
    if (confianca === 0.99) return 2.576;
    return 1.96;
  }
  if (gl >= 120) return 1.960;
  for (let i = 0; i < T_TABLE_95.length - 1; i++) {
    const [glLo, tLo] = T_TABLE_95[i];
    const [glHi, tHi] = T_TABLE_95[i + 1];
    if (gl >= glLo && gl <= glHi) {
      const ratio = (gl - glLo) / (glHi - glLo);
      return tLo + ratio * (tHi - tLo);
    }
  }
  return 1.960;
}

// ---------------------------------------------------------------------------
// IC por estimador de razão (§15.4) com FPC
// ---------------------------------------------------------------------------

export function calcularIC(porParcela, campo, areaTotalHa, confianca = 0.95) {
  const n = porParcela.length;
  if (n < 2) {
    return { erro: 'n < 2 parcelas: impossível calcular IC' };
  }

  const valores = porParcela.map(p => Number(p[campo] ?? 0));
  const areasHa = porParcela.map(p => p.area_m2 / 10000);
  const somaV = valores.reduce((s, v) => s + v, 0);
  const somaA = areasHa.reduce((s, a) => s + a, 0);
  const areaMedia = somaA / n;

  if (!(somaA > 0)) return { erro: 'Área amostrada nula' };

  const Rhat = somaV / somaA;

  let somaDesvios = 0;
  for (let i = 0; i < n; i++) {
    const d = valores[i] - Rhat * areasHa[i];
    somaDesvios += d * d;
  }

  const varRhat = somaDesvios / (n * (n - 1) * areaMedia * areaMedia);
  const seRhat = Math.sqrt(varRhat);
  const gl = n - 1;
  const t = tStudent(gl, confianca);
  const margem = t * seRhat;

  const total = Rhat * areaTotalHa;
  const margemTotal = margem * areaTotalHa;
  const cv = Rhat > 0 ? margem / Rhat : NaN;
  const erroRel = Rhat > 0 ? (margem / Rhat) * 100 : NaN;

  const cvPop = Rhat > 0 ? (seRhat * Math.sqrt(n)) / Rhat : NaN;
  const tInf = 1.960;
  
  let nIdeal10 = null;
  let N = null;

  if (Number.isFinite(cvPop) && areaTotalHa > 0 && areaMedia > 0) {
    // n0: tamanho de amostra para população infinita
    const n0 = (tInf * cvPop / 0.10) ** 2;

    // N: número total de parcelas possíveis no povoamento
    N = Math.floor(areaTotalHa / areaMedia);

    // Correção para população finita (amostragem sem reposição)
    if (N > 1) {
      nIdeal10 = Math.ceil(n0 / (1 + n0 / N));
    } else {
      nIdeal10 = Math.ceil(n0);
    }
  }

  return {
    n, Rhat, seRhat, margem, gl, t, confianca,
    total, margemTotal, cv, erroRel, nIdeal10, N,
    amostraInsuficiente: n < 10,
    amostraCritica: n < 3,
  };
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export function renderizarKPIs(container, povoamento, resultados, areaTotalHa, vistaEnergia = 'com') {
  if (!container) return;
  container.innerHTML = '';
  if (!povoamento || !resultados || Object.keys(resultados).length === 0) return;

  const venc = cenarioVencedor(resultados, vistaEnergia);
  const rVenc = venc.nome ? resultados[venc.nome] : null;
  const recVenc = rVenc ? receitaDe(rVenc, vistaEnergia) : null;
  const areaAmostradaHa = povoamento.area_amostrada_ha;
  const areaTotalPov = povoamento.area_total_ha;

  const producaoHa = (recVenc?.tonComercial ?? 0) / areaAmostradaHa;
  const producaoTotal = producaoHa * areaTotalPov;
  const receitaHa = (recVenc?.receitaTotal ?? 0) / areaAmostradaHa;
  const receitaTotalPov = receitaHa * areaTotalPov;

  const kpis = [
    { label: 'Volume total (povoamento)', valor: povoamento.V_total_m3, unidade: 'm³', casas: 0,
      sub: `${fmt(povoamento.V_ha, 1)} m³/ha`, cor: '#007030' },
    { label: `Produtividade (${venc.nome})`, valor: producaoHa, unidade: 'ton/ha', casas: 1,
      sub: `≈ ${fmt(producaoTotal, 0)} ton no povoamento`, cor: '#B8860B' },
    { label: `Receita (${venc.nome})`, valor: receitaTotalPov, moeda: true,
      sub: `${fmtMoeda(receitaHa)} /ha · ${fmt(areaTotalHa, 2)} ha`, cor: '#8B4513' },
    { label: 'Nº de árvores', valor: povoamento.N_total, unidade: 'árv.', casas: 0,
      sub: `${fmt(povoamento.N_ha, 0)} /ha`, cor: '#2B579A' },
    { label: 'Área basal', valor: povoamento.G_ha, unidade: 'm²/ha', casas: 1,
      sub: `${fmt(povoamento.G_total_m2, 0)} m² no povoamento`, cor: '#4A90E2' },
    { label: 'Cobertura da amostra', valor: povoamento.n_parcelas,
      unidade: povoamento.n_parcelas === 1 ? 'parcela' : 'parcelas', casas: 0,
      sub: `${povoamento.n_arvores} árvores · ${fmt(povoamento.area_amostrada_ha, 2)} ha amostrados`, cor: '#808080' },
  ];

  const cardsHtml = kpis.map(k => {
    const valorStr = k.moeda ? fmtMoeda(k.valor) : fmt(k.valor, k.casas ?? 0);
    const unidadeStr = k.unidade ? ` <small>${k.unidade}</small>` : '';
    return `
      <div class="kpi-card" style="border-top-color: ${k.cor};">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-valor" style="color: ${k.cor};">${valorStr}${unidadeStr}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`;
  }).join('');

  const vistaLabel = vistaEnergia === 'sem' ? ' · SEM venda de energia' : ' · COM venda de energia';
  container.innerHTML = `
    <div class="kpi-grid">${cardsHtml}</div>
    <p class="kpi-nota">
      <strong>Recomendação:</strong> Cenário <strong>${venc.nome}</strong>
      (maior receita${vistaLabel}). Área total do projeto: ${fmt(areaTotalHa, 2)} ha.
      Valores de produção e receita extrapolados da amostra para o povoamento.
    </p>`;
}

// ---------------------------------------------------------------------------
// Receita por cenário
// ---------------------------------------------------------------------------

export function renderizarReceitaPorCenario(container, resultados, areaAmostradaHa, areaTotalHa, vistaEnergia = 'com') {
  if (!container) return;
  container.innerHTML = '';
  const nomes = Object.keys(resultados);
  if (nomes.length === 0) return;

  const escala = areaTotalHa / areaAmostradaHa;
  const dados = nomes.map(nome => {
    const rec = receitaDe(resultados[nome], vistaEnergia);
    return {
      nome,
      total: rec.receitaTotal * escala,
      ha: rec.receitaTotal / areaAmostradaHa,
      tonTotal: rec.tonComercial * escala,
      tonHa: rec.tonComercial / areaAmostradaHa,
    };
  }).sort((a, b) => a.total - b.total);

  const maxTotal = Math.max(...dados.map(d => d.total));
  const vencedorNome = dados[dados.length - 1].nome;

  const W = 800;
  const H = 82 + dados.length * 68;
  const mg = { top: 62, right: 290, bottom: 40, left: 130 };
  const areaW = W - mg.left - mg.right;
  const barH = 34;
  const slotH = (H - mg.top - mg.bottom) / dados.length;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', xmlns: SVG_NS });

  svg.appendChild(el('text', { x: W / 2, y: 20, 'text-anchor': 'middle',
    'font-size': 13, 'font-weight': 600, fill: '#007030' },
    vistaEnergia === 'sem'
      ? 'Receita total do povoamento — SEM venda de energia'
      : 'Receita total do povoamento — COM venda de energia'));

  svg.appendChild(el('text', { x: W / 2, y: 38, 'text-anchor': 'middle',
    'font-size': 11, fill: '#666', 'font-style': 'italic' },
    `Área total do projeto: ${fmt(areaTotalHa, 2)} ha · Extrapolado da amostra de ${fmt(areaAmostradaHa, 2)} ha`));

  dados.forEach((d, i) => {
    const y = mg.top + i * slotH;
    const barY = y + (slotH - barH) / 2;
    const w = maxTotal > 0 ? (d.total / maxTotal) * areaW : 0;
    const ehVenc = d.nome === vencedorNome;

    svg.appendChild(el('text', {
      x: mg.left - 12, y: barY + barH / 2 + 5,
      'text-anchor': 'end', 'font-size': 13,
      'font-weight': ehVenc ? 700 : 500,
      fill: ehVenc ? '#007030' : '#333',
    }, d.nome + (ehVenc ? ' ★' : '')));

    svg.appendChild(el('rect', {
      x: mg.left, y: barY, width: w, height: barH,
      fill: ehVenc ? '#007030' : '#5a9e7c', rx: 3,
      stroke: ehVenc ? '#005025' : 'none', 'stroke-width': ehVenc ? 2 : 0,
    }));

    svg.appendChild(el('text', {
      x: mg.left + 8, y: barY + barH / 2 + 5,
      'font-size': 11, fill: '#fff', 'font-weight': 600, 'pointer-events': 'none',
    }, `${fmtMoeda(d.total)} · ${fmt(d.tonTotal, 0)} ton`));

    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: barY + barH / 2 + 2,
      'font-size': 14, 'font-weight': 700,
      fill: ehVenc ? '#007030' : '#333',
    }, fmtMoeda(d.total)));

    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: barY + barH / 2 + 18,
      'font-size': 10, fill: '#666',
    }, `${fmtMoeda(d.ha)}/ha · ${fmt(d.tonHa, 0)} ton/ha`));

    if (!ehVenc) {
      const pct = ((d.total - maxTotal) / maxTotal) * 100;
      svg.appendChild(el('text', {
        x: mg.left + areaW + 14, y: barY + barH / 2 + 34,
        'font-size': 10, fill: '#888',
      }, `${pct.toFixed(1)}% vs vencedor`));
    } else {
      svg.appendChild(el('text', {
        x: mg.left + areaW + 14, y: barY + barH / 2 + 34,
        'font-size': 10, fill: '#007030', 'font-weight': 600,
      }, '★ maior receita'));
    }
  });

  container.appendChild(svg);

  const venc = dados[dados.length - 1];
  const nota = document.createElement('p');
  nota.className = 'kpi-nota';
  nota.innerHTML = `<strong>Cenário vencedor: ${venc.nome}</strong> —
    <strong>${fmtMoeda(venc.total)}</strong> no povoamento
    (${fmtMoeda(venc.ha)}/ha · ${fmt(venc.tonTotal, 0)} ton · ${fmt(areaTotalHa, 2)} ha).`;
  container.appendChild(nota);
}

// ---------------------------------------------------------------------------
// Decomposição da receita
// ---------------------------------------------------------------------------

export function renderizarDecomposicaoReceita(container, resultados, areaAmostradaHa, areaTotalHa, vistaEnergia = 'com') {
  if (!container) return;
  container.innerHTML = '';
  const nomes = Object.keys(resultados);
  if (nomes.length === 0) return;

  const escala = areaTotalHa / areaAmostradaHa;
  const venc = cenarioVencedor(resultados, vistaEnergia);
  if (!venc.nome) return;
  const rec = receitaDe(resultados[venc.nome], vistaEnergia);

  const porClasse = Object.values(rec.porClasse)
    .map(c => ({ ...c, receitaTotal: c.receita * escala, tonTotal: c.toneladas * escala }))
    .filter(c => c.receitaTotal > 0)
    .sort((a, b) => b.receitaTotal - a.receitaTotal);

  if (porClasse.length === 0) return;

  const totalR = porClasse.reduce((s, c) => s + c.receitaTotal, 0) || 1;
  const totalV = porClasse.reduce((s, c) => s + c.volume, 0) || 1;
  const corMap = construirMapaCores(resultados);

  const headEl = document.getElementById('ceoDecompCenario');
  if (headEl) headEl.textContent = venc.nome;

  const W = 860;
  const H = 130 + porClasse.length * 62;
  const mg = { top: 96, right: 320, bottom: 30, left: 160 };
  const areaW = W - mg.left - mg.right;
  const barH = 30;
  const slotH = (H - mg.top - mg.bottom) / porClasse.length;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', xmlns: SVG_NS });

  svg.appendChild(el('text', { x: W / 2, y: 20, 'text-anchor': 'middle',
    'font-size': 13, 'font-weight': 600, fill: '#007030' },
    vistaEnergia === 'sem'
      ? `De onde vem a receita — cenário ${venc.nome} (SEM energia)`
      : `De onde vem a receita — cenário ${venc.nome} (COM energia)`));

  svg.appendChild(el('text', { x: W / 2, y: 40, 'text-anchor': 'middle',
    'font-size': 11, fill: '#666', 'font-style': 'italic' },
    `Área total do projeto: ${fmt(areaTotalHa, 2)} ha · Valores totais do povoamento`));

  svg.appendChild(el('text', { x: W / 2, y: 62, 'text-anchor': 'middle',
    'font-size': 12, 'font-weight': 700, fill: '#333' },
    `Total: ${fmtMoeda(totalR)}`));

  svg.appendChild(el('text', { x: W / 2, y: 78, 'text-anchor': 'middle',
    'font-size': 10, fill: '#C00000' },
    'Barra = % da receita · % do volume e toneladas à direita'));

  porClasse.forEach((c, i) => {
    const y = mg.top + i * slotH;
    const barY = y + (slotH - barH) / 2;
    const pctR = (c.receitaTotal / totalR) * 100;
    const pctV = (c.volume / totalV) * 100;
    const w = (pctR / 100) * areaW;
    const cor = corMap[c.nome] ?? '#999';

    svg.appendChild(el('text', {
      x: mg.left - 12, y: barY + barH / 2 + 5,
      'text-anchor': 'end', 'font-size': 12, 'font-weight': 500, fill: '#333',
    }, c.nome));

    svg.appendChild(el('rect', {
      x: mg.left, y: barY, width: Math.max(w, 2), height: barH,
      fill: cor, rx: 3,
    }));

    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: barY + barH / 2 - 1,
      'font-size': 13, 'font-weight': 700, fill: '#333',
    }, fmtMoeda(c.receitaTotal)));

    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: barY + barH / 2 + 15,
      'font-size': 10, fill: '#666',
    }, `${pctR.toFixed(1)}% receita · ${pctV.toFixed(1)}% vol · ${fmt(c.tonTotal, 0)} ton`));
  });

  container.appendChild(svg);

  const nobres = porClasse.filter(c => c.dapMin >= 16).reduce((s, c) => s + c.receitaTotal, 0);
  const pctNobres = (nobres / totalR) * 100;
  const volNobres = porClasse.filter(c => c.dapMin >= 16).reduce((s, c) => s + c.volume, 0);
  const pctVolNobres = (volNobres / totalV) * 100;
  const gap = pctNobres - pctVolNobres;

  const nota = document.createElement('p');
  nota.className = 'kpi-nota';
  nota.innerHTML = `<strong>Insight:</strong> classes nobres (dapMin ≥ 16 cm) geram
    <strong>${pctNobres.toFixed(1)}% da receita</strong>
    com <strong>${pctVolNobres.toFixed(1)}% do volume</strong>
    (concentração de +${gap.toFixed(1)} pp). A soma das barras
    (<strong>${fmtMoeda(totalR)}</strong>) coincide com a receita total
    do cenário em "Receita por cenário".`;
  container.appendChild(nota);
}

// ---------------------------------------------------------------------------
// Sensibilidade a preço −20%
// ---------------------------------------------------------------------------

export function renderizarSensibilidadePreco(container, dadosSensib, vistaEnergia) {
  if (!container) return;
  container.innerHTML = '';
  if (!dadosSensib || !dadosSensib.porCenario || Object.keys(dadosSensib.porCenario).length === 0) {
    container.innerHTML = '<p class="nota-vista">Sem dados de sensibilidade.</p>';
    return;
  }

  const entradas = Object.entries(dadosSensib.porCenario)
    .sort((a, b) => b[1].receitaOriginal - a[1].receitaOriginal);

  const W = 860;
  const H = 130 + entradas.length * 80;
  const mg = { top: 94, right: 280, bottom: 30, left: 150 };
  const areaW = W - mg.left - mg.right;
  const barH = 24;
  const gap = 4;
  const slotH = (H - mg.top - mg.bottom) / entradas.length;

  const maxReceita = Math.max(...entradas.map(([_, d]) => d.receitaOriginal));

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', xmlns: SVG_NS });

  svg.appendChild(el('text', {
    x: W / 2, y: 20, 'text-anchor': 'middle',
    'font-size': 13, 'font-weight': 600, fill: '#007030',
  }, 'Sensibilidade: preço da classe dominante cai 20%'));

  svg.appendChild(el('text', {
    x: W / 2, y: 38, 'text-anchor': 'middle',
    'font-size': 11, fill: '#666', 'font-style': 'italic',
  }, `Vista: ${vistaEnergia === 'sem' ? 'SEM' : 'COM'} venda de energia · comparação receita antes/depois`));

  if (dadosSensib.rankingMuda) {
    svg.appendChild(el('text', {
      x: W / 2, y: 58, 'text-anchor': 'middle',
      'font-size': 12, 'font-weight': 700, fill: '#C00000',
    }, '⚠ O ranking dos cenários muda após a queda de preço'));
  } else {
    svg.appendChild(el('text', {
      x: W / 2, y: 58, 'text-anchor': 'middle',
      'font-size': 12, 'font-weight': 600, fill: '#007030',
    }, '✓ O ranking dos cenários mantém-se após a queda de preço'));
  }

  entradas.forEach(([nome, d], i) => {
    const y = mg.top + i * slotH;
    const barBaseY = y;
    const barNovoY = y + barH + gap;

    svg.appendChild(el('text', {
      x: mg.left - 12, y: y + barH + 4,
      'text-anchor': 'end', 'font-size': 13, 'font-weight': 600, fill: '#333',
    }, nome));

    svg.appendChild(el('text', {
      x: mg.left - 12, y: y + barH + 20,
      'text-anchor': 'end', 'font-size': 10, fill: '#666',
    }, `${d.classeDominante} −20%`));

    const wBase = (d.receitaOriginal / maxReceita) * areaW;
    svg.appendChild(el('rect', {
      x: mg.left, y: barBaseY, width: wBase, height: barH,
      fill: '#5a9e7c', rx: 2,
    }));
    svg.appendChild(el('text', {
      x: mg.left + 6, y: barBaseY + barH / 2 + 4,
      'font-size': 10, fill: '#fff', 'font-weight': 600, 'pointer-events': 'none',
    }, `antes: ${fmtMoeda(d.receitaOriginal)}`));

    const wNovo = (d.receitaNova / maxReceita) * areaW;
    svg.appendChild(el('rect', {
      x: mg.left, y: barNovoY, width: wNovo, height: barH,
      fill: '#C00000', rx: 2,
    }));
    svg.appendChild(el('text', {
      x: mg.left + 6, y: barNovoY + barH / 2 + 4,
      'font-size': 10, fill: '#fff', 'font-weight': 600, 'pointer-events': 'none',
    }, `depois: ${fmtMoeda(d.receitaNova)}`));

    const exposto = d.deltaPct < -5;
    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: y + barH + 4,
      'font-size': 12, 'font-weight': 700,
      fill: exposto ? '#C00000' : '#007030',
    }, `${d.deltaPct >= 0 ? '+' : ''}${d.deltaPct.toFixed(1)}%`));

    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: y + barH + 20,
      'font-size': 10, fill: '#666',
    }, exposto ? '⚠ exposição alta' : 'exposição moderada'));

    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: y + barH + 34,
      'font-size': 10, fill: '#888',
    }, `perda: ${fmtMoeda(d.delta)}`));
  });

  container.appendChild(svg);

  const rankingOrig = dadosSensib.rankingOriginal;
  const rankingNovo = dadosSensib.rankingNovo;
  let rankingHtml = '';
  if (dadosSensib.rankingMuda) {
    rankingHtml = `<br><strong style="color:#C00000;">Ranking antes:</strong>
      ${rankingOrig.join(' > ')} → <strong>depois:</strong> ${rankingNovo.join(' > ')}`;
  }

  const nota = document.createElement('p');
  nota.className = 'kpi-nota';
  nota.innerHTML = `<strong>Leitura:</strong> se o preço da classe dominante
    (a de maior receita em cada cenário) cair 20%, a receita cai entre
    ${Math.min(...entradas.map(([_, d]) => Math.abs(d.deltaPct))).toFixed(1)}% e
    ${Math.max(...entradas.map(([_, d]) => Math.abs(d.deltaPct))).toFixed(1)}%.
    Classes com exposição > 5% são assinaladas a vermelho.
    ${rankingHtml}`;
  container.appendChild(nota);
}

// ---------------------------------------------------------------------------
// IC 95% — escalas independentes por barra + FPC no n_ideal
// ---------------------------------------------------------------------------

export function renderizarIC(container, icVolume, icReceita, areaTotalHa, vistaEnergia) {
  if (!container) return;
  container.innerHTML = '';

  if (icVolume.erro && icReceita.erro) {
    container.innerHTML = `
      <p class="nota-vista">
        ⚠ Impossível calcular IC 95%: ${icVolume.erro || icReceita.erro}.
        É necessário pelo menos 2 parcelas.
      </p>`;
    return;
  }

  const W = 900;
  const H = 290;
  const mg = { top: 120, right: 240, bottom: 30, left: 150 };
  const areaW = W - mg.left - mg.right;
  const barH = 44;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', xmlns: SVG_NS });

  svg.appendChild(el('text', {
    x: W / 2, y: 20, 'text-anchor': 'middle',
    'font-size': 13, 'font-weight': 600, fill: '#007030',
  }, 'Incerteza amostral — IC 95% (estimador de razão §15.4)'));

  svg.appendChild(el('text', {
    x: W / 2, y: 38, 'text-anchor': 'middle',
    'font-size': 11, fill: '#666', 'font-style': 'italic',
  }, `n = ${icVolume.n ?? '?'} parcelas · t(${icVolume.gl ?? '?'} gl) = ${fmt(icVolume.t, 3)} · área total ${fmt(areaTotalHa, 2)} ha`));

  svg.appendChild(el('text', {
    x: W / 2, y: 54, 'text-anchor': 'middle',
    'font-size': 10, fill: '#555', 'font-style': 'italic',
  }, 'Escalas independentes por unidade — cada barra normalizada ao seu próprio intervalo [min ; máx]'));

  if (icVolume.amostraCritica) {
    svg.appendChild(el('text', {
      x: W / 2, y: 78, 'text-anchor': 'middle',
      'font-size': 12, 'font-weight': 700, fill: '#C00000',
    }, `⚠ Amostra crítica (n=${icVolume.n}) — IC muito largo. Mínimo de ${icVolume.nIdeal10 ?? '?'} parcelas (de ${icVolume.N ?? '?'} possíveis) para erro ±10%.`));
  } else if (icVolume.amostraInsuficiente) {
    svg.appendChild(el('text', {
      x: W / 2, y: 78, 'text-anchor': 'middle',
      'font-size': 11, 'font-weight': 600, fill: '#B8860B',
    }, `⚠ Amostra abaixo de 10 parcelas — IC largo. Para erro ±10%, seriam necessárias ${icVolume.nIdeal10 ?? '?'} parcelas (de ${icVolume.N ?? '?'} possíveis).`));
  } else {
    svg.appendChild(el('text', {
      x: W / 2, y: 78, 'text-anchor': 'middle',
      'font-size': 11, fill: '#007030', 'font-weight': 600,
    }, `Erro amostral: ±${icVolume.erroRel.toFixed(1)}% em volume · n_ideal para ±10%: ${icVolume.nIdeal10 ?? '—'} (de ${icVolume.N ?? '—'} possíveis)`));
  }

  const linhas = [
    { label: 'Volume (m³)', ic: icVolume, cor: '#007030', fmtUn: n => fmt(n, 0) },
    { label: `Receita (${vistaEnergia === 'sem' ? 'sem energia' : 'com energia'})`,
      ic: icReceita, cor: '#8B4513', fmtUn: n => fmtMoeda(n) },
  ].filter(l => !l.ic.erro);

  linhas.forEach((l, i) => {
    const y = mg.top + i * 90;
    const barY = y;
    const total = l.ic.total;
    const margem = l.ic.margemTotal;
    const lo = Math.max(0, total - margem);
    const hi = total + margem;
    const range = hi - lo;
    const erroRel = total > 0 ? (margem / total) * 100 : NaN;

    // Escala INDEPENDENTE: mapeia [lo, hi] → [mg.left, mg.left+areaW]
    const escala = range > 0 ? areaW / range : 0;
    const xCentral = mg.left + (total - lo) * escala;

    svg.appendChild(el('text', {
      x: mg.left - 12, y: barY + barH / 2 + 5,
      'text-anchor': 'end', 'font-size': 12, 'font-weight': 600, fill: '#333',
    }, l.label));

    // Faixa de fundo (preenche toda a largura)
    svg.appendChild(el('rect', {
      x: mg.left, y: barY, width: areaW, height: barH,
      fill: l.cor, opacity: 0.18, rx: 3,
    }));

    // Marca central
    svg.appendChild(el('line', {
      x1: xCentral, y1: barY - 5, x2: xCentral, y2: barY + barH + 5,
      stroke: l.cor, 'stroke-width': 3,
    }));

    // Bigode + caps
    svg.appendChild(el('line', {
      x1: mg.left, y1: barY + barH / 2, x2: mg.left + areaW, y2: barY + barH / 2,
      stroke: l.cor, 'stroke-width': 1.5,
    }));
    svg.appendChild(el('line', {
      x1: mg.left, y1: barY + barH / 2 - 8, x2: mg.left, y2: barY + barH / 2 + 8,
      stroke: l.cor, 'stroke-width': 1.5,
    }));
    svg.appendChild(el('line', {
      x1: mg.left + areaW, y1: barY + barH / 2 - 8, x2: mg.left + areaW, y2: barY + barH / 2 + 8,
      stroke: l.cor, 'stroke-width': 1.5,
    }));

    // Rótulos min/máx
    svg.appendChild(el('text', {
      x: mg.left, y: barY + barH + 16,
      'text-anchor': 'start', 'font-size': 9, fill: '#666',
    }, `min: ${l.fmtUn(lo)}`));
    svg.appendChild(el('text', {
      x: mg.left + areaW, y: barY + barH + 16,
      'text-anchor': 'end', 'font-size': 9, fill: '#666',
    }, `máx: ${l.fmtUn(hi)}`));

    // Valor central + IC
    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: barY + barH / 2 - 4,
      'font-size': 13, 'font-weight': 700, fill: l.cor,
    }, l.fmtUn(total)));

    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: barY + barH / 2 + 12,
      'font-size': 10, fill: '#666',
    }, `± ${l.fmtUn(margem)}`));

    svg.appendChild(el('text', {
      x: mg.left + areaW + 14, y: barY + barH / 2 + 26,
      'font-size': 10, fill: '#888',
    }, `[${l.fmtUn(lo)} ; ${l.fmtUn(hi)}]`));

    // Erro relativo — métrica comparável
    if (Number.isFinite(erroRel)) {
      svg.appendChild(el('text', {
        x: mg.left + areaW + 14, y: barY + barH / 2 + 42,
        'font-size': 11, 'font-weight': 600,
        fill: erroRel > 50 ? '#C00000' : erroRel > 20 ? '#B8860B' : '#007030',
      }, `erro rel.: ±${erroRel.toFixed(1)}%`));
    }
  });

  container.appendChild(svg);

  let notaHtml = `<strong>Leitura:</strong> o valor central é a estimativa pontual;
    o intervalo mostra onde o valor verdadeiro estaria em 95% dos casos se o inventário
    fosse repetido. Cada barra tem escala própria (volume em m³, receita em R$) — compare-as
    pelo <strong>erro relativo (%)</strong>, que é a métrica comparável. `;

  if (icVolume.amostraCritica) {
    notaHtml += `<br><span style="color:#C00000; font-weight:600;">⚠ Com apenas ${icVolume.n} parcelas,
      o IC é muito largo e o valor central tem pouca precisão prática. Para atingir
      erro ±10% (padrão do setor), seria necessário ampliar para cerca de
      ${icVolume.nIdeal10} parcelas (de um total de ${icVolume.N} possíveis no povoamento).</span>`;
  } else if (icVolume.amostraInsuficiente) {
    notaHtml += `<br><span style="color:#B8860B; font-weight:600;">Amostra com ${icVolume.n} parcelas
      ainda é pequena. n_ideal para ±10%: ${icVolume.nIdeal10} (N=${icVolume.N}).</span>`;
  } else {
    notaHtml += `Erro relativo em volume: ±${icVolume.erroRel.toFixed(1)}%.`;
  }

  const nota = document.createElement('p');
  nota.className = 'kpi-nota';
  nota.innerHTML = notaHtml;
  container.appendChild(nota);
}

// ---------------------------------------------------------------------------
// Orquestrador
// ---------------------------------------------------------------------------

export function renderizarPainelCEO({
  povoamento, resultados, areaTotalHa, vistaEnergia = 'com',
  sensibilidade, icVolume, icReceita,
}) {
  const painel = document.getElementById('painelCEO');
  if (!painel) return;
  if (!povoamento || !resultados || Object.keys(resultados).length === 0) {
    painel.hidden = true;
    return;
  }

  // FONTE DE VERDADE: povoamento.area_total_ha (não o parâmetro).
  const areaTotalSegura = (Number.isFinite(povoamento.area_total_ha) && povoamento.area_total_ha > 0)
    ? povoamento.area_total_ha
    : (Number.isFinite(areaTotalHa) && areaTotalHa > 0 ? areaTotalHa : null);

  if (!areaTotalSegura) {
    console.warn('[CEO] areaTotalHa inválida em povoamento — render abortado.');
    painel.hidden = true;
    return;
  }

  if (Number.isFinite(areaTotalHa) && Math.abs(areaTotalHa - areaTotalSegura) > 0.01) {
    console.warn(`[CEO] Divergência areaTotalHa: parâmetro=${areaTotalHa} vs povoamento=${areaTotalSegura}. Uso povoamento.`);
  }

  const areaAmostradaHa = povoamento.area_amostrada_ha;

  renderizarKPIs(document.getElementById('ceoKPIs'),
    povoamento, resultados, areaTotalSegura, vistaEnergia);

  renderizarReceitaPorCenario(document.getElementById('ceoReceitaCenarios'),
    resultados, areaAmostradaHa, areaTotalSegura, vistaEnergia);

  renderizarDecomposicaoReceita(document.getElementById('ceoDecomposicao'),
    resultados, areaAmostradaHa, areaTotalSegura, vistaEnergia);

  if (sensibilidade) {
    renderizarSensibilidadePreco(
      document.getElementById('ceoSensibilidade'), sensibilidade, vistaEnergia);
  }

  if (icVolume && icReceita) {
    renderizarIC(
      document.getElementById('ceoIC'), icVolume, icReceita, areaTotalSegura, vistaEnergia);
  }

  const radios = painel.querySelectorAll('input[name="vistaEnergiaCEO"]');
  radios.forEach(r => { r.checked = (r.value === vistaEnergia); });

  painel.hidden = false;
}