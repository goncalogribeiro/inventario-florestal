// js/graficos.js
// Etapa 2.3.3 visual — gráficos #6 e #7 do §18.
// SVG puro, sem dependências externas.
//
//  · Gráfico #7 — barras empilhadas de %V por sortimento (3 barras, uma por cenário).
//  · Gráfico #6 — perfil do fuste de uma árvore com segmentos coloridos por classe.
//
// Tooltip delegado via data-tip (evita <title> com quebras de linha inconsistentes).

import { diametroAAltura, H_STUMP } from './afilamento.js';
import { tracarArvore } from './tracamento.js';

const NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Cor por classe, derivada do dapMin (mais nobre = cor mais quente).
 * Paleta categórica (estilo Tableau) — matizes distintos para facilitar
 * a leitura de gráficos com múltiplos sortimentos.
 */
function corClasse(dapMin) {
  if (dapMin === 0)  return '#c9a227';   // Energia — âmbar
  if (dapMin <= 10)  return '#6b9bd1';   // Celulose — azul
  if (dapMin <= 18)  return '#2ca02c';   // Serraria fina / Caixaria_18 / Pallet — verde
  if (dapMin <= 25)  return '#ff7f0e';   // Serraria média / Caixaria_25 / Torno — laranja
  if (dapMin <= 33)  return '#9467bd';   // Lam / Serraria_23 — roxo
  return '#8c564b';                      // Caixaria_35 / premium extremo — castanho
}

/**
 * Anexa um único listener de tooltip ao container. Elementos com `data-tip`
 * mostram um balão ao hover.
 */
function attachTooltip(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  const tip = document.createElement('div');
  tip.className = 'grafico-tooltip';
  container.appendChild(tip);

  svg.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      tip.textContent = el.getAttribute('data-tip');
      tip.style.opacity = '1';
    });
    el.addEventListener('mousemove', (e) => {
      const r = container.getBoundingClientRect();
      tip.style.left = (e.clientX - r.left + 12) + 'px';
      tip.style.top  = (e.clientY - r.top  + 12) + 'px';
    });
    el.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
  });
}

// ---------------------------------------------------------------------------
// Gráfico #7 — Barras empilhadas de %V por cenário
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {Object} resultados - saída de executarTracamento (por nomeCenario)
 * @param {string} vistaAtual - 'com' | 'sem'
 */
export function renderizarBarrasEmpilhadas(container, resultados, vistaAtual = 'com') {
  if (!container) return;
  container.innerHTML = '';

  const nomes = Object.keys(resultados || {});
  if (nomes.length === 0) return;

  // Dimensões
  const W = 720, H = 420;
  const M = { top: 30, right: 20, bottom: 70, left: 60 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  const barSlot = PW / nomes.length;
  const barW = Math.min(120, barSlot * 0.55);

  const svg = [];
  svg.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}" role="img" aria-label="Distribuição por sortimento">`);

  // Grid horizontal (0, 25, 50, 75, 100 %)
  for (let pct = 0; pct <= 100; pct += 25) {
    const y = M.top + PH - (pct / 100) * PH;
    svg.push(`<line x1="${M.left}" y1="${y}" x2="${W - M.right}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`);
    svg.push(`<text x="${M.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${pct}%</text>`);
  }

  // Barras
  nomes.forEach((nomeCen, i) => {
    const r = resultados[nomeCen];
    const rec = vistaAtual === 'com' ? r.receitaComEnergia : r.receitaSemEnergia;
    const volTotal = rec.volComercial;
    if (!(volTotal > 0)) return;

    // Ordenar do mais nobre ao menos (topo = mais nobre)
    const classes = Object.values(rec.porClasse).sort((a, b) => b.dapMin - a.dapMin);

    const xBar = M.left + i * barSlot + (barSlot - barW) / 2;
    let yAcum = M.top + PH;

    classes.forEach((c) => {
      const pct = (c.volume / volTotal) * 100;
      if (pct <= 0) return;

      const hSeg = (pct / 100) * PH;
      const ySeg = yAcum - hSeg;

      const ehEnergia = c.dapMin === 0;
      const naoVendida = ehEnergia && vistaAtual === 'sem';

      const fill = corClasse(c.dapMin);
      const opacity = naoVendida ? 0.4 : 1;

      // Tooltip (com/sem ambos, para clareza)
      const tonCom = ehEnergia
        ? (c.volume * rec.fatorM3Ton).toFixed(2)
        : (c.toneladas).toFixed(2);
      const rCom = ehEnergia
        ? (c.volume * rec.fatorM3Ton * c.preco).toFixed(2)
        : (c.receita).toFixed(2);
      const semStr = ehEnergia
        ? '— (não vendida)'
        : `${tonCom} ton · R$ ${rCom}`;

      const tip = `${c.nome} | V: ${c.volume.toFixed(2)} m³ (${pct.toFixed(1)}%) | com: ${tonCom} ton · R$ ${rCom} | sem: ${semStr}`;

      svg.push(`<rect x="${xBar}" y="${ySeg}" width="${barW}" height="${hSeg}" fill="${fill}" opacity="${opacity}" stroke="#fff" stroke-width="0.5" data-tip="${escapeHtml(tip)}"/>`);

      // Label de % dentro (só se >= 6% e não for energia não vendida)
      if (pct >= 6 && !naoVendida) {
        const corTxt = c.dapMin <= 10 ? '#fff' : '#fff';
        svg.push(`<text x="${xBar + barW / 2}" y="${ySeg + hSeg / 2 + 4}" text-anchor="middle" font-size="11" fill="${corTxt}" font-weight="600" pointer-events="none">${pct.toFixed(0)}%</text>`);
      }

      yAcum = ySeg;
    });

    // Receita total em cima da barra
    const xCentro = xBar + barW / 2;
    svg.push(`<text x="${xCentro}" y="${M.top - 10}" text-anchor="middle" font-size="11" fill="#444" font-weight="600">R$ ${rec.receitaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</text>`);
    // Nome do cenário em baixo
    svg.push(`<text x="${xCentro}" y="${M.top + PH + 22}" text-anchor="middle" font-size="13" fill="#007030" font-weight="600">${escapeHtml(nomeCen)}</text>`);
  });

  // Eixo Y
  svg.push(`<text x="20" y="${M.top + PH / 2}" text-anchor="middle" font-size="12" fill="#007030" font-weight="600" transform="rotate(-90 20 ${M.top + PH / 2})">% do volume físico</text>`);

  svg.push('</svg>');

  // Empacotar
  const wrap = document.createElement('div');
  wrap.className = 'grafico-svg-wrapper';
  wrap.innerHTML = svg.join('');
  container.appendChild(wrap);

  // Legenda (HTML, com flex-wrap)
  const todas = new Map();
  nomes.forEach((n) => {
    const r = resultados[n];
    const rec = vistaAtual === 'com' ? r.receitaComEnergia : r.receitaSemEnergia;
    Object.values(rec.porClasse).forEach((c) => {
      if (!todas.has(c.nome)) todas.set(c.nome, { nome: c.nome, dapMin: c.dapMin });
    });
  });
  const ord = Array.from(todas.values()).sort((a, b) => a.dapMin - b.dapMin);
  const leg = document.createElement('div');
  leg.className = 'legenda-barras';
  leg.innerHTML = ord.map((c) =>
    `<span class="item"><span class="swatch" style="background:${corClasse(c.dapMin)}"></span>${escapeHtml(c.nome)}</span>`
  ).join('');
  container.appendChild(leg);

  attachTooltip(wrap);
}

// ---------------------------------------------------------------------------
// Gráfico #6 — Perfil do fuste com traçamento
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {Object} arvore - enriquecida por enriquecerComAfilamento
 * @param {Object} cenario - cenário completo (com classes[])
 * @param {Array<number>} dMinimos - para desenhar as linhas H_c
 */
export function renderizarPerfilFuste(container, arvore, cenario, dMinimos = []) {
  if (!container) return;
  container.innerHTML = '';

  if (!arvore || !Number.isFinite(arvore.beta) || !Number.isFinite(arvore.dap) || !Number.isFinite(arvore.altura)) {
    container.innerHTML = '<p class="aviso-pendente">Árvore sem perfil válido (β/DAP/H em falta).</p>';
    return;
  }

  const trac = tracarArvore(arvore, cenario);
  if (trac.erro) {
    container.innerHTML = `<p class="aviso-pendente">${escapeHtml(trac.erro)}</p>`;
    return;
  }

  const { beta, dap, altura } = arvore;

  // Dimensões
  const W = 520, H = 540;
  const M = { top: 30, right: 110, bottom: 40, left: 50 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  const xCentro = M.left + PW / 2;
  const dapMaxPlot = dap * 1.1;
  const yDeAltura = (h) => M.top + PH - (h / altura) * PH;
  const xDeDiametro = (d) => xCentro + (d / (dapMaxPlot * 2)) * PW;

  // SVG string
  const svg = [];
  svg.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}" role="img" aria-label="Perfil do fuste com traçamento">`);

  // Fundo da área de plotagem
  svg.push(`<rect x="${M.left}" y="${M.top}" width="${PW}" height="${PH}" fill="#fafafa" stroke="#e0e0e0"/>`);

  // Grid horizontal (Y = altura em m)
  const passoAlt = altura > 20 ? 5 : 2.5;
  for (let h = 0; h <= altura; h += passoAlt) {
    const y = yDeAltura(h);
    svg.push(`<line x1="${M.left}" y1="${y}" x2="${M.left + PW}" y2="${y}" stroke="#eee" stroke-width="1"/>`);
    svg.push(`<text x="${M.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666">${h.toFixed(0)}</text>`);
  }
  // Grid vertical (X = diâmetro em cm)
  for (let d = 0; d <= dapMaxPlot; d += dapMaxPlot / 4) {
    const xR = xDeDiametro(d);
    const xL = 2 * xCentro - xR;
    svg.push(`<line x1="${xR}" y1="${M.top}" x2="${xR}" y2="${M.top + PH}" stroke="#eee" stroke-width="1"/>`);
    svg.push(`<line x1="${xL}" y1="${M.top}" x2="${xL}" y2="${M.top + PH}" stroke="#eee" stroke-width="1"/>`);
    svg.push(`<text x="${xR}" y="${M.top + PH + 14}" text-anchor="middle" font-size="10" fill="#666">${d.toFixed(0)}</text>`);
  }

  // Perfil outline (via path, amostrado)
  const N = 60;
  const pontos = [];
  for (let i = 0; i <= N; i++) {
    const h = (altura * i) / N;
    const d = diametroAAltura(beta, dap, altura, h);
    pontos.push({ h, d });
  }
  let path = `M ${xDeDiametro(pontos[0].d)} ${yDeAltura(pontos[0].h)}`;
  for (let i = 1; i <= N; i++) path += ` L ${xDeDiametro(pontos[i].d)} ${yDeAltura(pontos[i].h)}`;
  for (let i = N; i >= 0; i--) path += ` L ${2 * xCentro - xDeDiametro(pontos[i].d)} ${yDeAltura(pontos[i].h)}`;
  path += ' Z';
  svg.push(`<path d="${path}" fill="#e8f5ec" stroke="#007030" stroke-width="1.2"/>`);

  // Toco (0 → H_STUMP) em cinza
  const dTopo = diametroAAltura(beta, dap, altura, H_STUMP);
  const yTocoBase = yDeAltura(0);
  const yTocoTopo = yDeAltura(H_STUMP);
  svg.push(`<polygon points="${xDeDiametro(dTopo)},${yTocoBase} ${2*xCentro - xDeDiametro(dTopo)},${yTocoBase} ${2*xCentro - xDeDiametro(dTopo)},${yTocoTopo} ${xDeDiametro(dTopo)},${yTocoTopo}" fill="#888" opacity="0.7" stroke="#555" stroke-width="0.5" data-tip="Toco | 0 → ${H_STUMP.toFixed(2)} m | V ${trac.volumeToco.toFixed(3)} m³"/>`);

  // Toras
  trac.toras.forEach((t) => {
    const h1 = t.h1;
    const h2 = Math.min(t.h2, altura);
    const d1 = diametroAAltura(beta, dap, altura, h1);
    const d2 = diametroAAltura(beta, dap, altura, h2);
    const y1 = yDeAltura(h1);
    const y2 = yDeAltura(h2);
    const xR1 = xDeDiametro(d1);
    const xR2 = xDeDiametro(d2);
    const xL1 = 2 * xCentro - xR1;
    const xL2 = 2 * xCentro - xR2;
    const pts = `${xL1},${y1} ${xR1},${y1} ${xR2},${y2} ${xL2},${y2}`;

    const tip = `${t.classe} | comp ${t.comprimento.toFixed(2)} m | h ${h1.toFixed(2)} → ${h2.toFixed(2)} | V ${t.volume.toFixed(3)} m³ | d topo ${t.dTopo.toFixed(1)} cm`;
    svg.push(`<polygon points="${pts}" fill="${corClasse(t.dapMin)}" opacity="0.85" stroke="#fff" stroke-width="0.5" data-tip="${escapeHtml(tip)}"/>`);
  });

  // Resíduo (se descartado, apenas contorno tracejado; se energia reduzida, já está em trac.toras? Não — está em trac.residuo)
  if (trac.residuo) {
    const h1 = trac.residuo.h1;
    const h2 = Math.min(trac.residuo.h2, altura);
    const d1 = diametroAAltura(beta, dap, altura, h1);
    const d2 = diametroAAltura(beta, dap, altura, h2);
    const y1 = yDeAltura(h1), y2 = yDeAltura(h2);
    const xR1 = xDeDiametro(d1), xR2 = xDeDiametro(d2);
    const xL1 = 2 * xCentro - xR1, xL2 = 2 * xCentro - xR2;
    const pts = `${xL1},${y1} ${xR1},${y1} ${xR2},${y2} ${xL2},${y2}`;
    const cor = trac.residuo.tipo === 'energia_reduzida' ? corClasse(0) : '#ccc';
    const tracejado = trac.residuo.tipo === 'energia_reduzida' ? '' : ' stroke-dasharray="3,3"';
    const tip = `${trac.residuo.tipo === 'energia_reduzida' ? 'Energia (resíduo)' : 'Descartado'} | ${trac.residuo.comprimento.toFixed(2)} m | V ${trac.residuo.volume.toFixed(3)} m³`;
    svg.push(`<polygon points="${pts}" fill="${cor}" opacity="0.6" stroke="#666" stroke-width="0.5"${tracejado} data-tip="${escapeHtml(tip)}"/>`);
  }

  // Linhas H_c (dMinimos)
  dMinimos.forEach((d) => {
    const hc = arvore.alturaComercial?.[d];
    if (!Number.isFinite(hc) || hc <= 0 || hc >= altura) return;
    const y = yDeAltura(hc);
    svg.push(`<line x1="${M.left}" y1="${y}" x2="${M.left + PW}" y2="${y}" stroke="#666" stroke-dasharray="4,3" stroke-width="1"/>`);
    svg.push(`<text x="${M.left + PW + 6}" y="${y + 4}" font-size="10" fill="#666">H_c(${d}) = ${hc.toFixed(1)}</text>`);
  });

  // Eixo X (label)
  svg.push(`<text x="${xCentro}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#007030" font-weight="600">diâmetro (cm)</text>`);
  // Eixo Y (label)
  svg.push(`<text x="14" y="${M.top + PH / 2}" text-anchor="middle" font-size="11" fill="#007030" font-weight="600" transform="rotate(-90 14 ${M.top + PH / 2})">altura (m)</text>`);

  svg.push('</svg>');

  // Empacotar
  const wrap = document.createElement('div');
  wrap.className = 'grafico-svg-wrapper';
  wrap.innerHTML = svg.join('');
  container.appendChild(wrap);

  // Legenda / resumo das classes
  const resumo = new Map();
  trac.toras.forEach((t) => {
    const key = t.classe;
    if (!resumo.has(key)) resumo.set(key, { nome: t.classe, dapMin: t.dapMin, n: 0, vol: 0 });
    const r = resumo.get(key);
    r.n++;
    r.vol += t.volume;
  });
  if (trac.residuo && trac.residuo.tipo === 'energia_reduzida') {
    const key = trac.residuo.classe || 'Energia';
    if (!resumo.has(key)) resumo.set(key, { nome: key, dapMin: 0, n: 0, vol: 0 });
    const r = resumo.get(key);
    r.n++;
    r.vol += trac.residuo.volume;
  }

  const leg = document.createElement('div');
  leg.className = 'legenda-barras';
  leg.innerHTML = Array.from(resumo.values()).map((c) =>
    `<span class="item"><span class="swatch" style="background:${corClasse(c.dapMin)}"></span>${escapeHtml(c.nome)}: ${c.n} tora(s) · ${c.vol.toFixed(2)} m³</span>`
  ).join('');
  container.appendChild(leg);

  attachTooltip(wrap);
}

// ---------------------------------------------------------------------------
// API auxiliar — usada por main.js e graficos-ceo.js
// ---------------------------------------------------------------------------

/**
 * Mostra o painel de gráficos. Idempotente.
 */
export function garantirPainelGraficos() {
  const painel = document.getElementById('painelGraficos');
  if (painel) painel.hidden = false;
}

/**
 * Nome canónico para o gráfico de barras empilhadas do §18 (#7).
 * Delega em `renderizarBarrasEmpilhadas` para manter uma única implementação.
 */
export function renderizarGraficosSortimentos(container, resultados, vistaAtual = 'com') {
  renderizarBarrasEmpilhadas(container, resultados, vistaAtual);
}

/**
 * Constrói um mapa {nomeClasse → corHex} a partir dos resultados de
 * traçamento. Usado pelo painel CEO (decomposição de receita) para
 * garantir que cada classe tem a mesma cor em todos os gráficos.
 */
export function construirMapaCores(resultados) {
  const mapa = {};
  for (const r of Object.values(resultados || {})) {
    const rec = r?.receitaComEnergia ?? r?.receitaSemEnergia;
    if (!rec?.porClasse) continue;
    for (const c of Object.values(rec.porClasse)) {
      if (!c?.nome) continue;
      if (!(c.nome in mapa)) {
        mapa[c.nome] = corClasse(c.dapMin ?? 0);
      }
    }
  }
  return mapa;
}