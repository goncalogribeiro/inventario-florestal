// js/ui-prognose.js
// Fase 2 — UI do painel de prognose (crescimento + mortalidade, sem ingrowth).

import { PROGNOSE_DEFAULTS, taxaMortalidadePorIdade } from './prognose.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Editor de parâmetros
// ---------------------------------------------------------------------------
export function renderizarPainelPrognose(container, estadoAtual, configInicial, onChange) {
  if (!container) return;

  const cfg = {
    idadeAlvo: configInicial?.idadeAlvo ?? (estadoAtual.idadeAtual + 5),
    mortalidadeJovem: configInicial?.mortalidadeJovem ?? PROGNOSE_DEFAULTS.mortalidadeJovem,
    mortalidadeAdulta: configInicial?.mortalidadeAdulta ?? PROGNOSE_DEFAULTS.mortalidadeAdulta,
    aplicarSDI: configInicial?.aplicarSDI ?? PROGNOSE_DEFAULTS.aplicarSDI,
    sdiOcupacaoMax: configInicial?.sdiOcupacaoMax ?? PROGNOSE_DEFAULTS.sdiOcupacaoMax,
    crescimentoDiferencial: configInicial?.crescimentoDiferencial ?? PROGNOSE_DEFAULTS.crescimentoDiferencial,
  };

  const fmt = (n, c = 2) => Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';
  const fmtN = (n) => Number.isFinite(n) ? Math.round(n).toLocaleString('pt-BR') : '—';

  function render() {
    const mortJovem = taxaMortalidadePorIdade(estadoAtual.idadeAtual, cfg);
    const mortNaIdadeAlvo = taxaMortalidadePorIdade(cfg.idadeAlvo, cfg);

    container.innerHTML = `
      <div class="aviso-pendente" style="border-left-color:#2B579A; background:#e8f0fa; margin-bottom:12px;">
        <strong>Estado atual:</strong>
        idade ${estadoAtual.idadeAtual} anos ·
        hDom ${fmt(estadoAtual.hDomAtual, 2)} m ·
        Dg ${fmt(estadoAtual.dgAtual, 2)} cm ·
        N ${fmtN(estadoAtual.nHaAtual)} /ha ·
        G ${fmt(estadoAtual.gHaAtual, 2)} m²/ha
      </div>

      <table class="ed-tabela prognose-tabela">
        <tbody>
          <tr>
            <td><strong>Idade alvo</strong></td>
            <td>
              <input type="number" id="prognoseIdadeAlvo"
                     value="${cfg.idadeAlvo}" min="${estadoAtual.idadeAtual + 1}" max="80" step="1"
                     style="width:90px; padding:5px 8px; text-align:right;">
              <span style="color:#666;">anos</span>
            </td>
            <td colspan="2" style="color:#666; font-size:12px; font-style:italic;">
              Horizonte da projeção. Mínimo: idade + 1.
            </td>
          </tr>
          <tr>
            <td><strong>Mortalidade jovem</strong></td>
            <td>
              <input type="number" id="prognoseMortJovem"
                     value="${cfg.mortalidadeJovem}" min="0" max="15" step="0.1"
                     style="width:80px; padding:5px 8px; text-align:right;">
              <span style="color:#666;">%/ano</span>
            </td>
            <td colspan="2" style="color:#666; font-size:12px; font-style:italic;">
              Taxa até 8 anos. Pinus taeda: 2–4%/ano (competição inicial).
            </td>
          </tr>
          <tr>
            <td><strong>Mortalidade adulta</strong></td>
            <td>
              <input type="number" id="prognoseMortAdulta"
                     value="${cfg.mortalidadeAdulta}" min="0" max="10" step="0.1"
                     style="width:80px; padding:5px 8px; text-align:right;">
              <span style="color:#666;">%/ano</span>
            </td>
            <td colspan="2" style="color:#666; font-size:12px; font-style:italic;">
              Taxa a partir dos 15 anos. Pinus taeda: 0,5–1,5%/ano.
            </td>
          </tr>
          <tr>
            <td><strong>Autodesbaste SDI</strong></td>
            <td colspan="3">
              <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="prognoseSDI" ${cfg.aplicarSDI ? 'checked' : ''}>
                Limitar N ao SDI máximo × ocupação
              </label>
              <span style="color:#666; font-size:12px; margin-left:12px;">
                ocupação máx.:
                <input type="number" id="prognoseSDIOcup"
                       value="${cfg.sdiOcupacaoMax}" min="0.2" max="0.9" step="0.05"
                       style="width:70px; padding:3px 6px; text-align:right;"
                       ${cfg.aplicarSDI ? '' : 'disabled'}>
              </span>
            </td>
          </tr>
          <tr>
            <td><strong>Crescimento diferencial</strong></td>
            <td colspan="3">
              <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="prognoseCrescDif" ${cfg.crescimentoDiferencial ? 'checked' : ''}>
                Dominantes crescem mais que dominadas (distribuição "abre" com o tempo)
              </label>
            </td>
          </tr>
        </tbody>
      </table>

      <div style="background:#f4f4f4; padding:10px; border-radius:4px; margin-top:10px; font-size:12px;">
        <strong>Mortalidade calculada:</strong>
        aos <strong>${estadoAtual.idadeAtual}</strong> anos → <strong>${mortJovem.toFixed(2)}%/ano</strong> ·
        aos <strong>${cfg.idadeAlvo}</strong> anos → <strong>${mortNaIdadeAlvo.toFixed(2)}%/ano</strong>
      </div>

      <p class="ref-nota" style="margin-top:10px;">
        <strong>Modelo:</strong> Chapman-Richards bivariado (H_dom via índice de sítio + Dg via CR) +
        mortalidade dependente da idade + autodesbaste por Reineke (SDI).
        Cada árvore cresce em função da sua posição sociológica, e as mais
        vulneráveis morrem primeiro. Sem ingrowth (recrutamento) — não há em plantio comercial.
      </p>
    `;

    const inpIdade = container.querySelector('#prognoseIdadeAlvo');
    const inpMJ    = container.querySelector('#prognoseMortJovem');
    const inpMA    = container.querySelector('#prognoseMortAdulta');
    const chkSDI   = container.querySelector('#prognoseSDI');
    const inpOcup  = container.querySelector('#prognoseSDIOcup');
    const chkDif   = container.querySelector('#prognoseCrescDif');

    const emitir = () => onChange({ ...cfg });

    inpIdade?.addEventListener('change', () => {
      const v = parseInt(inpIdade.value, 10);
      if (Number.isFinite(v) && v > estadoAtual.idadeAtual) {
        cfg.idadeAlvo = v; emitir();
      } else {
        inpIdade.value = cfg.idadeAlvo;
      }
    });
    inpMJ?.addEventListener('change', () => {
      const v = parseFloat(inpMJ.value);
      if (Number.isFinite(v) && v >= 0) { cfg.mortalidadeJovem = v; emitir(); }
    });
    inpMA?.addEventListener('change', () => {
      const v = parseFloat(inpMA.value);
      if (Number.isFinite(v) && v >= 0) { cfg.mortalidadeAdulta = v; emitir(); }
    });
    chkSDI?.addEventListener('change', () => {
      cfg.aplicarSDI = chkSDI.checked;
      if (inpOcup) inpOcup.disabled = !cfg.aplicarSDI;
      emitir();
    });
    inpOcup?.addEventListener('change', () => {
      const v = parseFloat(inpOcup.value);
      if (Number.isFinite(v) && v > 0 && v <= 1) { cfg.sdiOcupacaoMax = v; emitir(); }
    });
    chkDif?.addEventListener('change', () => {
      cfg.crescimentoDiferencial = chkDif.checked; emitir();
    });
  }

  render();
}

// ---------------------------------------------------------------------------
// Gráfico 1 — trajetória (H_dom + Dg)
// ---------------------------------------------------------------------------
export function renderizarProjecao(container, proj) {
  if (!container) return;
  container.innerHTML = '';
  if (!proj || proj.erro || !proj.snapshots || proj.snapshots.length === 0) {
    container.innerHTML = `<p class="aviso-pendente">${proj?.erro || 'Sem projeção.'}</p>`;
    return;
  }

  const snaps = proj.snapshots;
  const W = 860, H = 320;
  const mg = { top: 40, right: 70, bottom: 50, left: 70 };
  const areaW = W - mg.left - mg.right;
  const areaH = H - mg.top - mg.bottom;

  const fmt = (n, c = 1) => Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';

  const minA = snaps[0].idade;
  const maxA = snaps[snaps.length - 1].idade;
  const maxH = Math.max(...snaps.map(s => s.hDom)) * 1.10;
  const maxDg = Math.max(...snaps.map(s => s.dg)) * 1.10;

  const xA = (a) => mg.left + ((a - minA) / Math.max(1, maxA - minA)) * areaW;
  const yH = (h) => mg.top + areaH - (h / maxH) * areaH;
  const yDg = (d) => mg.top + areaH - (d / maxDg) * areaH;

  const el = (tag, attrs = {}, text = null) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  };

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', xmlns: SVG_NS });

  svg.appendChild(el('text', { x: W / 2, y: 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: '#007030' },
    `Trajetória projetada — ${minA} → ${maxA} anos`));
  svg.appendChild(el('text', { x: W / 2, y: 36, 'text-anchor': 'middle', 'font-size': 11, fill: '#666', 'font-style': 'italic' },
    'Chapman-Richards bivariado · H_dom via índice de sítio · Dg via CR'));

  for (let v = 0; v <= maxH; v += Math.max(1, maxH / 6)) {
    const y = yH(v);
    svg.appendChild(el('line', { x1: mg.left, y1: y, x2: W - mg.right, y2: y,
      stroke: '#f0f0f0', 'stroke-width': 1 }));
    svg.appendChild(el('text', { x: mg.left - 8, y: y + 4, 'text-anchor': 'end',
      'font-size': 10, fill: '#007030' }, v.toFixed(0)));
  }
  for (let v = 0; v <= maxDg; v += Math.max(2, maxDg / 6)) {
    const y = yDg(v);
    svg.appendChild(el('text', { x: W - mg.right + 8, y: y + 4, 'text-anchor': 'start',
      'font-size': 10, fill: '#8B4513' }, v.toFixed(0)));
  }
  const stepA = Math.max(1, Math.round((maxA - minA) / 8));
  for (let a = minA; a <= maxA; a += stepA) {
    const x = xA(a);
    svg.appendChild(el('line', { x1: x, y1: mg.top, x2: x, y2: mg.top + areaH,
      stroke: '#f0f0f0', 'stroke-width': 1 }));
    svg.appendChild(el('text', { x, y: mg.top + areaH + 16, 'text-anchor': 'middle',
      'font-size': 10, fill: '#666' }, a));
  }

  const pathH = snaps.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xA(s.idade)} ${yH(s.hDom)}`).join(' ');
  const pathDg = snaps.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xA(s.idade)} ${yDg(s.dg)}`).join(' ');
  svg.appendChild(el('path', { d: pathH, fill: 'none', stroke: '#007030', 'stroke-width': 2.5 }));
  svg.appendChild(el('path', { d: pathDg, fill: 'none', stroke: '#8B4513', 'stroke-width': 2.5, 'stroke-dasharray': '6,3' }));

  const snapIni = snaps[0];
  const snapFim = snaps[snaps.length - 1];
  svg.appendChild(el('circle', { cx: xA(snapIni.idade), cy: yH(snapIni.hDom), r: 5, fill: '#007030' }));
  svg.appendChild(el('circle', { cx: xA(snapFim.idade), cy: yH(snapFim.hDom), r: 5, fill: '#007030' }));
  svg.appendChild(el('circle', { cx: xA(snapIni.idade), cy: yDg(snapIni.dg), r: 5, fill: '#8B4513' }));
  svg.appendChild(el('circle', { cx: xA(snapFim.idade), cy: yDg(snapFim.dg), r: 5, fill: '#8B4513' }));

  svg.appendChild(el('line', { x1: mg.left, y1: mg.top + areaH, x2: W - mg.right, y2: mg.top + areaH,
    stroke: '#999', 'stroke-width': 1 }));
  svg.appendChild(el('line', { x1: mg.left, y1: mg.top, x2: mg.left, y2: mg.top + areaH,
    stroke: '#007030', 'stroke-width': 1 }));
  svg.appendChild(el('line', { x1: W - mg.right, y1: mg.top, x2: W - mg.right, y2: mg.top + areaH,
    stroke: '#8B4513', 'stroke-width': 1 }));

  svg.appendChild(el('text', { x: 20, y: mg.top + areaH / 2, 'text-anchor': 'middle',
    'font-size': 11, fill: '#007030', 'font-weight': 600,
    transform: `rotate(-90 20 ${mg.top + areaH / 2})` }, 'hDom (m)'));
  svg.appendChild(el('text', { x: W - 20, y: mg.top + areaH / 2, 'text-anchor': 'middle',
    'font-size': 11, fill: '#8B4513', 'font-weight': 600,
    transform: `rotate(90 ${W - 20} ${mg.top + areaH / 2})` }, 'Dg (cm)'));
  svg.appendChild(el('text', { x: W / 2, y: H - 12, 'text-anchor': 'middle',
    'font-size': 11, fill: '#666' }, 'idade (anos)'));

  svg.appendChild(el('text', { x: xA(snapFim.idade) + 8, y: yH(snapFim.hDom) - 6,
    'font-size': 11, 'font-weight': 700, fill: '#007030' }, `${fmt(snapFim.hDom, 2)} m`));
  svg.appendChild(el('text', { x: xA(snapFim.idade) + 8, y: yDg(snapFim.dg) + 14,
    'font-size': 11, 'font-weight': 700, fill: '#8B4513' }, `${fmt(snapFim.dg, 2)} cm`));

  container.appendChild(svg);

  if (proj.aviso) {
    const p = document.createElement('p');
    p.className = 'nota-vista';
    p.style.background = '#fff8e1';
    p.style.borderLeft = '3px solid #E67E22';
    p.style.padding = '6px 12px';
    p.textContent = '⚠ ' + proj.aviso;
    container.appendChild(p);
  }
}

// ---------------------------------------------------------------------------
// Gráfico 2 — densidade (N/ha + G/ha)
// ---------------------------------------------------------------------------
export function renderizarProjecaoDensidade(container, proj) {
  if (!container) return;
  container.innerHTML = '';
  if (!proj || proj.erro || !proj.snapshots) {
    container.innerHTML = `<p class="aviso-pendente">${proj?.erro || 'Sem projeção.'}</p>`;
    return;
  }
  const snaps = proj.snapshots;
  const W = 860, H = 260;
  const mg = { top: 30, right: 80, bottom: 40, left: 70 };
  const areaW = W - mg.left - mg.right;
  const areaH = H - mg.top - mg.bottom;

  const fmt = (n, c = 0) => Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';

  const minA = snaps[0].idade;
  const maxA = snaps[snaps.length - 1].idade;
  const maxN = Math.max(...snaps.map(s => s.nHa)) * 1.10;
  const maxG = Math.max(...snaps.map(s => s.gHa)) * 1.10;

  const xA = (a) => mg.left + ((a - minA) / Math.max(1, maxA - minA)) * areaW;
  const yN = (n) => mg.top + areaH - (n / maxN) * areaH;
  const yG = (g) => mg.top + areaH - (g / maxG) * areaH;

  const el = (tag, attrs = {}, text = null) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  };

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', xmlns: SVG_NS });

  svg.appendChild(el('text', { x: W / 2, y: 18, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: '#2B579A' },
    'Densidade e Área Basal'));

  for (let v = 0; v <= maxN; v += Math.max(100, maxN / 5)) {
    const y = yN(v);
    svg.appendChild(el('line', { x1: mg.left, y1: y, x2: W - mg.right, y2: y,
      stroke: '#f0f0f0', 'stroke-width': 1 }));
    svg.appendChild(el('text', { x: mg.left - 8, y: y + 4, 'text-anchor': 'end',
      'font-size': 10, fill: '#2B579A' }, Math.round(v)));
  }
  for (let v = 0; v <= maxG; v += Math.max(5, maxG / 5)) {
    const y = yG(v);
    svg.appendChild(el('text', { x: W - mg.right + 8, y: y + 4, 'text-anchor': 'start',
      'font-size': 10, fill: '#B8860B' }, v.toFixed(0)));
  }
  const stepA = Math.max(1, Math.round((maxA - minA) / 8));
  for (let a = minA; a <= maxA; a += stepA) {
    const x = xA(a);
    svg.appendChild(el('text', { x, y: mg.top + areaH + 14, 'text-anchor': 'middle',
      'font-size': 10, fill: '#666' }, a));
  }

  const pathN = snaps.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xA(s.idade)} ${yN(s.nHa)}`).join(' ');
  const pathG = snaps.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xA(s.idade)} ${yG(s.gHa)}`).join(' ');
  svg.appendChild(el('path', { d: pathN, fill: 'none', stroke: '#2B579A', 'stroke-width': 2.5 }));
  svg.appendChild(el('path', { d: pathG, fill: 'none', stroke: '#B8860B', 'stroke-width': 2.5, 'stroke-dasharray': '6,3' }));

  svg.appendChild(el('line', { x1: mg.left, y1: mg.top + areaH, x2: W - mg.right, y2: mg.top + areaH,
    stroke: '#999', 'stroke-width': 1 }));

  svg.appendChild(el('text', { x: 20, y: mg.top + areaH / 2, 'text-anchor': 'middle',
    'font-size': 10, fill: '#2B579A', 'font-weight': 600,
    transform: `rotate(-90 20 ${mg.top + areaH / 2})` }, 'N/ha'));
  svg.appendChild(el('text', { x: W - 18, y: mg.top + areaH / 2, 'text-anchor': 'middle',
    'font-size': 10, fill: '#B8860B', 'font-weight': 600,
    transform: `rotate(90 ${W - 18} ${mg.top + areaH / 2})` }, 'G (m²/ha)'));

  const legY = H - 8;
  svg.appendChild(el('line', { x1: mg.left, y1: legY, x2: mg.left + 20, y2: legY, stroke: '#2B579A', 'stroke-width': 2.5 }));
  svg.appendChild(el('text', { x: mg.left + 26, y: legY + 4, 'font-size': 10, fill: '#2B579A' }, 'N/ha'));
  svg.appendChild(el('line', { x1: mg.left + 80, y1: legY, x2: mg.left + 100, y2: legY, stroke: '#B8860B', 'stroke-width': 2.5, 'stroke-dasharray': '6,3' }));
  svg.appendChild(el('text', { x: mg.left + 106, y: legY + 4, 'font-size': 10, fill: '#B8860B' }, 'G (m²/ha)'));

  container.appendChild(svg);
}

// ---------------------------------------------------------------------------
// Histograma — distribuição de DAP antes vs depois
// ---------------------------------------------------------------------------
export function renderizarHistogramaDap(container, proj, arvoresAtuais) {
  if (!container) return;
  container.innerHTML = '';
  if (!proj || proj.erro || !proj.arvoresFuturas || !Array.isArray(arvoresAtuais)) {
    container.innerHTML = `<p class="aviso-pendente">Sem dados para histograma.</p>`;
    return;
  }

  const dapsAntes = arvoresAtuais.map(a => a.dap).filter(Number.isFinite);
  const dapsDepois = proj.arvoresFuturas.map(a => a.dap).filter(Number.isFinite);
  if (dapsAntes.length === 0 || dapsDepois.length === 0) {
    container.innerHTML = `<p class="aviso-pendente">DAPs inválidos.</p>`;
    return;
  }

  const minD = Math.min(...dapsAntes, ...dapsDepois);
  const maxD = Math.max(...dapsAntes, ...dapsDepois);
  const step = Math.max(2, Math.ceil((maxD - minD) / 12));
  const nBins = Math.ceil((maxD - minD) / step);

  const bins = Array.from({ length: nBins }, (_, i) => ({
    min: minD + i * step,
    max: minD + (i + 1) * step,
    antes: 0, depois: 0,
  }));

  const atribuir = (d) => {
    const idx = Math.min(nBins - 1, Math.floor((d - minD) / step));
    return idx;
  };
  dapsAntes.forEach(d => { const i = atribuir(d); if (i >= 0) bins[i].antes++; });
  dapsDepois.forEach(d => { const i = atribuir(d); if (i >= 0) bins[i].depois++; });

  const maxCount = Math.max(...bins.map(b => Math.max(b.antes, b.depois))) * 1.1;

  const W = 860, H = 280;
  const mg = { top: 30, right: 30, bottom: 50, left: 60 };
  const areaW = W - mg.left - mg.right;
  const areaH = H - mg.top - mg.bottom;
  const slotW = areaW / nBins;
  const barW = slotW * 0.4;

  const yCount = (n) => mg.top + areaH - (n / maxCount) * areaH;

  const el = (tag, attrs = {}, text = null) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  };

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', xmlns: SVG_NS });

  svg.appendChild(el('text', { x: W / 2, y: 18, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: '#007030' },
    'Distribuição de DAP — antes vs depois'));
  svg.appendChild(el('text', { x: W / 2, y: 34, 'text-anchor': 'middle', 'font-size': 10, fill: '#666', 'font-style': 'italic' },
    'A distribuição "abre" com o tempo: dominantes crescem mais, suprimidas morrem.'));

  bins.forEach((b, i) => {
    const xSlot = mg.left + i * slotW;

    if (b.antes > 0) {
      const x = xSlot + (slotW - barW) / 2 - barW / 2;
      const y = yCount(b.antes);
      svg.appendChild(el('rect', {
        x, y, width: barW, height: yCount(0) - y,
        fill: '#c0c0c0', opacity: 0.8,
      }));
    }
    if (b.depois > 0) {
      const x = xSlot + (slotW - barW) / 2 + barW / 2;
      const y = yCount(b.depois);
      svg.appendChild(el('rect', {
        x, y, width: barW, height: yCount(0) - y,
        fill: '#2B579A', opacity: 0.85,
      }));
    }

    svg.appendChild(el('text', {
      x: xSlot + slotW / 2, y: mg.top + areaH + 16,
      'text-anchor': 'middle', 'font-size': 9, fill: '#666',
    }, b.min.toFixed(0) + '-' + b.max.toFixed(0)));
  });

  for (let v = 0; v <= maxCount; v += Math.max(10, maxCount / 5)) {
    const y = yCount(v);
    svg.appendChild(el('line', { x1: mg.left, y1: y, x2: W - mg.right, y2: y, stroke: '#f0f0f0' }));
    svg.appendChild(el('text', { x: mg.left - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 9, fill: '#666' }, Math.round(v)));
  }
  svg.appendChild(el('text', { x: 14, y: mg.top + areaH / 2, 'text-anchor': 'middle',
    'font-size': 10, fill: '#333', transform: `rotate(-90 14 ${mg.top + areaH / 2})` }, 'árvores (amostra)'));
  svg.appendChild(el('text', { x: mg.left + areaW / 2, y: H - 8, 'text-anchor': 'middle',
    'font-size': 10, fill: '#666' }, 'DAP (cm)'));

  svg.appendChild(el('rect', { x: mg.left + 20, y: H - 30, width: 12, height: 12, fill: '#c0c0c0' }));
  svg.appendChild(el('text', { x: mg.left + 36, y: H - 20, 'font-size': 10, fill: '#333' },
    `antes (${dapsAntes.length} árvores)`));
  svg.appendChild(el('rect', { x: mg.left + 170, y: H - 30, width: 12, height: 12, fill: '#2B579A' }));
  svg.appendChild(el('text', { x: mg.left + 186, y: H - 20, 'font-size': 10, fill: '#333' },
    `depois (${dapsDepois.length} árvores)`));

  container.appendChild(svg);
}

// ---------------------------------------------------------------------------
// Tabela anual
// ---------------------------------------------------------------------------
export function renderizarProjecaoTabela(container, proj) {
  if (!container || !proj || proj.erro) return;
  const snaps = proj.snapshots;
  const fmt = (n, c = 1) => Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';
  const fmtN = (n) => Number.isFinite(n) ? Math.round(n).toLocaleString('pt-BR') : '—';

  const rows = snaps.map((s, i) => {
    const isIni = i === 0;
    const isFim = i === snaps.length - 1;
    const cls = isFim ? 'vencedor' : '';
    const mort = s.mortalidadeAno != null ? fmtN(s.mortalidadeAno) : '—';
    return `<tr class="${cls}">
      <td>${isFim ? `<strong>${s.idade}</strong>` : s.idade}</td>
      <td>${fmt(s.hDom, 2)}</td>
      <td>${fmt(s.dg, 2)}</td>
      <td>${fmtN(s.nHa)}</td>
      <td>${fmt(s.gHa, 2)}</td>
      <td style="color:#C00000;">${mort}</td>
      <td>${s.sdiOcupacao != null ? (s.sdiOcupacao * 100).toFixed(0) + '%' : '—'}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="tabela-container">
      <table class="ed-tabela prognose-tabela-dados">
        <thead>
          <tr>
            <th>Idade</th>
            <th>hDom (m)</th>
            <th>Dg (cm)</th>
            <th>N/ha</th>
            <th>G (m²/ha)</th>
            <th>Mortes no ano</th>
            <th>Ocupação SDI</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Balanço (antes → depois)
// ---------------------------------------------------------------------------
export function renderizarBalancoProjecao(container, proj, estadoAntes) {
  if (!container) return;
  if (!proj || proj.erro || !proj.resumo) {
    container.innerHTML = `<p class="aviso-pendente">Sem dados de projeção.</p>`;
    return;
  }

  const fmt = (n, c = 2) => Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';
  const fmtN = (n) => Number.isFinite(n) ? Math.round(n).toLocaleString('pt-BR') : '—';
  const r = proj.resumo;

  const sdiAntes = estadoAntes.nHaAtual * Math.pow(estadoAntes.dgAtual / 25, 1.605);
  const sdiMax = estadoAntes.especie === 'Eucalipto' ? 1200 : 1002;

  container.innerHTML = `
    <table class="ed-tabela prognose-balanco">
      <thead>
        <tr style="background:#2B579A; color:#fff;">
          <th style="text-align:left; padding:8px;">Métrica</th>
          <th style="padding:8px;">Antes (${estadoAntes.idadeAtual}a)</th>
          <th style="padding:8px;">Depois (${r.idadeAlvo}a)</th>
          <th style="padding:8px;">Δ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>hDom (m)</strong></td>
          <td>${fmt(estadoAntes.hDomAtual)}</td>
          <td><strong>${fmt(r.hDomFinal)}</strong></td>
          <td style="color:#007030;">+${fmt(r.deltaHdom)}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><strong>Dg (cm)</strong></td>
          <td>${fmt(estadoAntes.dgAtual)}</td>
          <td><strong>${fmt(r.dgFinal)}</strong></td>
          <td style="color:#007030;">+${fmt(r.deltaDg)}</td>
        </tr>
        <tr>
          <td><strong>N/ha</strong></td>
          <td>${fmtN(estadoAntes.nHaAtual)}</td>
          <td><strong>${fmtN(r.nHaFinal)}</strong></td>
          <td style="color:${r.deltaNha >= 0 ? '#007030' : '#C00000'};">
            ${r.deltaNha >= 0 ? '+' : ''}${fmtN(r.deltaNha)}
          </td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><strong>G (m²/ha)</strong></td>
          <td>${fmt(estadoAntes.gHaAtual)}</td>
          <td><strong>${fmt(r.gHaFinal)}</strong></td>
          <td style="color:#007030;">+${fmt(r.deltaGha)}</td>
        </tr>
        <tr>
          <td><strong>Ocupação SDI</strong></td>
          <td>${(sdiAntes / sdiMax * 100).toFixed(0)}%</td>
          <td><strong>${r.sdiOcupacaoFinal != null ? (r.sdiOcupacaoFinal * 100).toFixed(0) + '%' : '—'}</strong></td>
          <td>—</td>
        </tr>
      </tbody>
    </table>

    <table class="ed-tabela prognose-balanco" style="margin-top:16px;">
      <thead>
        <tr style="background:#555; color:#fff;">
          <th style="text-align:left; padding:8px;">Balanço de árvores (amostra)</th>
          <th style="padding:8px; text-align:right;">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Árvores atuais</td>
          <td style="text-align:right;">${fmtN(r.nArvoresAtuais)}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td>Árvores projetadas (sobreviventes)</td>
          <td style="text-align:right;"><strong>${fmtN(r.nArvoresProjetadas)}</strong></td>
        </tr>
        <tr>
          <td style="color:#C00000;"><strong>Mortes (mortalidade natural + autodesbaste)</strong></td>
          <td style="text-align:right; color:#C00000; font-weight:700;">−${fmtN(r.nArvoresMortas)}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td>Iterações de coerência (N/Dg/G)</td>
          <td style="text-align:right;">${r.iteracoesCoerencia ?? '—'}</td>
        </tr>
        <tr>
          <td>Dg alcançado (após iteração)</td>
          <td style="text-align:right;">${fmt(r.dgAtingido)} cm ${Math.abs((r.dgAtingido ?? 0) - r.dgFinal) < 0.1 ? '✓' : '⚠'}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 12px; background: #e8f0fa; padding: 12px; border-left: 4px solid #2B579A; border-radius: 4px;">
      <strong>Leitura:</strong> ao projetar de <strong>${r.idadeAtual}</strong> para
      <strong>${r.idadeAlvo} anos</strong>, cada árvore remanescente cresceu em DAP e altura.
      As <strong>${fmtN(r.nArvoresMortas)}</strong> árvores removidas correspondem a
      <strong>${((r.nArvoresMortas / Math.max(1, r.nArvoresAtuais)) * 100).toFixed(1)}%</strong> da amostra —
      prioritariamente suprimidas e dominadas (as mais vulneráveis).
      O <strong>Dg subiu ${fmt(r.deltaDg)} cm</strong> e o <strong>G ganhou ${fmt(r.deltaGha)} m²/ha</strong>,
      enquanto <strong>N caiu ${fmtN(Math.abs(r.deltaNha))}/ha</strong>.
    </div>
  `;
}