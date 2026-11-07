// js/ui-cenarios.js
// Etapa 2.3.4 — Editor de cenários.
//
// Uso:
//   renderizarEditorCenarios(container, cenarios, onChange)
//
// O container é preenchido com um editor de tabela editável por cenário.
// Toda edição dispara onChange(novosCenarios). Erros de validação são
// mostrados inline, por cenário, sem bloquear os outros.
//
// Delegação de eventos: um único listener por container.

import { validarCenario, restaurarCenarioDefault } from './cenarios.js';

export function renderizarEditorCenarios(container, cenarios, onChange) {
  if (!container) return;

  // Cópia local — o caller recebe uma referência viva a este modelo
  let modelo = JSON.parse(JSON.stringify(cenarios));

  // ---- Helpers de renderização -----------------------------------------
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderSecao(nomeCen) {
    const cen = modelo[nomeCen];
    const classes = cen.classes;

    const rows = classes.map((c, i) => `
      <tr data-idx="${i}">
        <td><input data-field="nome" value="${escAttr(c.nome)}"></td>
        <td><input data-field="comprimento" type="number" step="0.01" min="0.01"
                   value="${c.comprimento}"></td>
        <td><input data-field="dapMin" type="number" step="1" min="0"
                   value="${c.dapMin}"></td>
        <td><input data-field="dapMax" type="number" step="1" min="0"
                   value="${c.dapMax != null ? c.dapMax : ''}"
                   placeholder="sem limite"></td>
        <td><input data-field="preco" type="number" step="0.01" min="0"
                   value="${c.preco}"></td>
        <td><button data-action="remove-class" title="Remover classe"
                    class="btn-icone">×</button></td>
      </tr>`).join('');

    return `
      <section class="ed-cenario" data-cen="${escAttr(nomeCen)}">
        <header>
          <h3>${escAttr(nomeCen)}</h3>
          <button data-action="reset" class="btn-secundario btn-pequeno">
            Restaurar default
          </button>
        </header>
        <div class="tabela-container">
          <table class="ed-tabela">
            <thead>
              <tr>
                <th>Sortimento</th>
                <th>Comp. (m)</th>
                <th>DAP min (cm)</th>
                <th>DAP max (cm)</th>
                <th>R$/ton</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <button data-action="add-class" class="btn-secundario btn-pequeno">
          + Adicionar classe
        </button>
        <div class="ed-erros" data-role="erros"></div>
      </section>`;
  }

  function renderTudo() {
    const blocos = Object.keys(modelo).map(renderSecao).join('');
    container.innerHTML = blocos;
    atualizarErros();
  }

  function atualizarErros() {
    for (const sec of container.querySelectorAll('section.ed-cenario')) {
      const nome = sec.dataset.cen;
      const cenario = modelo[nome];
      const v = validarCenario(cenario);
      const errosEl = sec.querySelector('[data-role="erros"]');
      if (!errosEl) continue;
      if (v.ok) {
        errosEl.innerHTML = '';
        errosEl.classList.remove('visivel');
        sec.classList.remove('invalido');
      } else {
        errosEl.innerHTML = v.erros.map(e => `<div>⚠ ${escAttr(e)}</div>`).join('');
        errosEl.classList.add('visivel');
        sec.classList.add('invalido');
      }
    }
  }

  // ---- Delegação de eventos -------------------------------------------
  container.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-field]');
    if (!input) return;

    const sec = input.closest('section.ed-cenario');
    const tr  = input.closest('tr[data-idx]');
    if (!sec || !tr) return;

    const nomeCen = sec.dataset.cen;
    const idx = parseInt(tr.dataset.idx, 10);
    const cenario = modelo[nomeCen];
    const cls = cenario.classes[idx];
    if (!cls) return;

    const field = input.dataset.field;
    if (field === 'nome') {
      cls.nome = input.value;
    } else if (field === 'dapMax') {
      const raw = input.value.trim();
      cls.dapMax = raw === '' ? null : parseFloat(raw);
    } else {
      cls[field] = parseFloat(input.value);
    }

    atualizarErros();
    onChange(modelo);
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const sec = btn.closest('section.ed-cenario');

    if (action === 'reset' && sec) {
      const nome = sec.dataset.cen;
      if (!confirm(`Restaurar "${nome}" para os valores padrão?`)) return;
      modelo[nome] = restaurarCenarioDefault(nome);
      renderTudo();
      onChange(modelo);
    } else if (action === 'add-class' && sec) {
      const cenario = modelo[sec.dataset.cen];
      let n = 1;
      while (cenario.classes.some(c => c.nome === `Nova ${n}`)) n++;
      cenario.classes.push({
        nome: `Nova ${n}`,
        comprimento: 2.40,
        dapMin: 10,
        dapMax: null,
        preco: 100,
      });
      renderTudo();
      onChange(modelo);
    } else if (action === 'remove-class') {
      const tr = btn.closest('tr[data-idx]');
      if (!tr || !sec) return;
      const idx = parseInt(tr.dataset.idx, 10);
      const cenario = modelo[sec.dataset.cen];
      if (!confirm(`Remover a classe "${cenario.classes[idx].nome}"?`)) return;
      cenario.classes.splice(idx, 1);
      renderTudo();
      onChange(modelo);
    }
  });

  renderTudo();
}