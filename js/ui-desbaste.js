// js/ui-desbaste.js
// Etapa 2.6 — Editor e preview do desbaste.

const TIPOS = [
  { valor: 'baixo',       label: 'Baixo — remove árvores de menor DAP' },
  { valor: 'alto',        label: 'Alto — remove árvores de maior DAP' },
  { valor: 'sistematico', label: 'Sistemático — remove 1 a cada N árvores' },
  { valor: 'selectivo',   label: 'Selectivo — remove dominadas/suprimidas e defeituosas' },
];

export function renderizarEditorDesbaste(container, config, onChange) {
  if (!container) return;

  const cfg = {
    tipo: config?.tipo ?? 'baixo',
    intensidadePct: config?.intensidadePct ?? 30,
    cadaN: config?.cadaN ?? 3,
    removerMortas: config?.removerMortas ?? true,
  };

  function render() {
    const isSistematico = cfg.tipo === 'sistematico';
    const isSelectivo   = cfg.tipo === 'selectivo';

    container.innerHTML = `
      <table class="ed-tabela desbaste-tabela">
        <tbody>
          <tr>
            <td><strong>Tipo</strong></td>
            <td colspan="3">
              <select id="desbasteTipo" style="width:100%; padding:6px 10px; font-family:inherit; font-size:13px; border:1px solid #d0d0d0; border-radius:3px;">
                ${TIPOS.map(t => `<option value="${t.valor}" ${t.valor === cfg.tipo ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </td>
          </tr>
          <tr ${isSistematico ? 'style="display:none"' : ''}>
            <td><strong>Intensidade</strong></td>
            <td>
              <input type="number" id="desbasteIntensidade"
                     value="${cfg.intensidadePct}" min="0" max="90" step="1"
                     style="width:80px; text-align:right; padding:5px 8px; border:1px solid #d0d0d0; border-radius:3px;">
              <span style="color:#666;">% das árvores</span>
            </td>
            <td colspan="2" style="color:#666; font-size:12px; font-style:italic;">
              ${isSelectivo
                ? 'Remove primeiro as dominadas/suprimidas e árvores com defeito grave.'
                : 'Percentagem de árvores removidas do total da amostra.'}
            </td>
          </tr>
          <tr ${isSistematico ? '' : 'style="display:none"'}>
            <td><strong>Frequência</strong></td>
            <td>
              <span style="color:#666;">1 a cada</span>
              <input type="number" id="desbasteCadaN"
                     value="${cfg.cadaN}" min="2" max="10" step="1"
                     style="width:70px; text-align:right; padding:5px 8px; border:1px solid #d0d0d0; border-radius:3px;">
              <span style="color:#666;">árvores</span>
            </td>
            <td colspan="2" style="color:#666; font-size:12px; font-style:italic;">
              Desbaste sistemático — remove 1 a cada N, em ordem de ficheiro.
            </td>
          </tr>
          <tr>
            <td><strong>Remover mortas</strong></td>
            <td colspan="3">
              <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="desbasteRemoverMortas" ${cfg.removerMortas ? 'checked' : ''}>
                Excluir do cálculo árvores com qualidade=2 (mortas)
              </label>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="ref-nota" style="margin-top:10px;">
        O desbaste altera apenas as árvores do inventário. O volume, o afilamento,
        o traçamento e a receita serão recalculados sobre as árvores remanescentes.
        Use <em>Reverter</em> para voltar ao povoamento original.
      </p>
    `;

    const sel = container.querySelector('#desbasteTipo');
    const inpIntens = container.querySelector('#desbasteIntensidade');
    const inpCadaN = container.querySelector('#desbasteCadaN');
    const chkMortas = container.querySelector('#desbasteRemoverMortas');

    sel.addEventListener('change', () => {
      cfg.tipo = sel.value;
      render();
      onChange({ ...cfg });
    });
    if (inpIntens) {
      inpIntens.addEventListener('change', () => {
        const v = parseFloat(inpIntens.value);
        if (Number.isFinite(v) && v >= 0) { cfg.intensidadePct = v; onChange({ ...cfg }); }
      });
    }
    if (inpCadaN) {
      inpCadaN.addEventListener('change', () => {
        const v = parseInt(inpCadaN.value, 10);
        if (Number.isFinite(v) && v >= 2) { cfg.cadaN = v; onChange({ ...cfg }); }
      });
    }
    chkMortas.addEventListener('change', () => {
      cfg.removerMortas = chkMortas.checked;
      onChange({ ...cfg });
    });
  }

  render();
}

export function renderizarPreviewDesbaste(container, resumo) {
  if (!container) return;
  if (!resumo || resumo.nAntes === 0) {
    container.innerHTML = '';
    return;
  }

  const fmt = (n, c = 1) => Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })
    : '—';

  const deltaDAP = (resumo.dapMedioDepois != null && resumo.dapMedioAntes != null)
    ? resumo.dapMedioDepois - resumo.dapMedioAntes
    : null;

  container.innerHTML = `
    <table class="ed-tabela desbaste-preview">
      <thead>
        <tr>
          <th>Métrica</th>
          <th>Antes</th>
          <th>Depois</th>
          <th>Δ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Árvores</td>
          <td>${resumo.nAntes}</td>
          <td>${resumo.nDepois}</td>
          <td style="color:#C00000;">−${resumo.nRemovidas}</td>
        </tr>
        <tr>
          <td>Área basal (amostra)</td>
          <td>${fmt(resumo.gAntes, 4)} m²</td>
          <td>${fmt(resumo.gDepois, 4)} m²</td>
          <td style="color:#C00000;">−${fmt(resumo.gRemovidaPct, 1)}%</td>
        </tr>
        <tr>
          <td>DAP médio</td>
          <td>${fmt(resumo.dapMedioAntes, 2)} cm</td>
          <td>${fmt(resumo.dapMedioDepois, 2)} cm</td>
          <td>${deltaDAP != null ? `${deltaDAP >= 0 ? '+' : ''}${fmt(deltaDAP, 2)} cm` : '—'}</td>
        </tr>
        <tr>
          <td>Dg</td>
          <td>${fmt(resumo.dgAntes, 2)} cm</td>
          <td>${fmt(resumo.dgDepois, 2)} cm</td>
          <td>${resumo.dgDepois != null && resumo.dgAntes != null
              ? `${(resumo.dgDepois - resumo.dgAntes) >= 0 ? '+' : ''}${fmt(resumo.dgDepois - resumo.dgAntes, 2)} cm`
              : '—'}</td>
        </tr>
      </tbody>
    </table>
  `;
}

export function renderizarBalancoDesbaste(container, resumo, povoamentoAntes, povoamentoDepois) {
  if (!container) return;

  const fmt = (n, c = 1) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';

  const gAntes = povoamentoAntes.G_ha;
  const gDepois = povoamentoDepois.G_ha;
  const gRemovida = gAntes - gDepois;

  const volAntes = povoamentoAntes.V_ha;
  const volDepois = povoamentoDepois.V_ha;
  const volRemovido = volAntes - volDepois;

  container.innerHTML = `
    <table class="ed-tabela" style="width: 100%; border-collapse: collapse; text-align: right;">
      <thead>
        <tr style="background: #444; color: #fff;">
          <th style="text-align: left; padding: 8px;">Métrica</th>
          <th style="padding: 8px;">Original</th>
          <th style="padding: 8px; color: #ff9999;">Removido</th>
          <th style="padding: 8px; color: #99ff99;">Remanescente</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align: left;"><strong>Nº de Árvores (amostra)</strong></td>
          <td>${resumo.nAntes}</td>
          <td style="color: #C00000;">−${resumo.nRemovidas}</td>
          <td style="color: #007030;"><strong>${resumo.nDepois}</strong></td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="text-align: left;"><strong>Área Basal (m²/ha)</strong></td>
          <td>${fmt(gAntes)}</td>
          <td style="color: #C00000;">−${fmt(gRemovida)}</td>
          <td style="color: #007030;"><strong>${fmt(gDepois)}</strong></td>
        </tr>
        <tr>
          <td style="text-align: left;"><strong>Volume Total (m³/ha)</strong></td>
          <td>${fmt(volAntes)}</td>
          <td style="color: #C00000;">−${fmt(volRemovido)}</td>
          <td style="color: #007030;"><strong>${fmt(volDepois)}</strong></td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="text-align: left;"><strong>DAP Médio (cm)</strong></td>
          <td>${fmt(resumo.dapMedioAntes, 2)}</td>
          <td>—</td>
          <td style="color: #007030;"><strong>${fmt(resumo.dapMedioDepois, 2)}</strong></td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top: 12px; background: #e8f5ec; padding: 12px; border-left: 4px solid #007030; border-radius: 4px;">
      <strong>Conclusão:</strong> O desbaste removeu <strong>${fmt(resumo.gRemovidaPct, 1)}%</strong> da área basal 
      e <strong>${fmt((volRemovido/volAntes)*100, 1)}%</strong> do volume. 
      Em troca, o DAP médio das árvores que ficaram aumentou 
      <strong>${fmt(resumo.dapMedioDepois - resumo.dapMedioAntes, 2)} cm</strong>.
    </div>
  `;
}