// Versão: 2.8.2+SC.r2 — sentinel:__MAIN_282_SC_R2__
// Fase 2: Schöepfer-SC como FERRAMENTA DE DIAGNÓSTICO (não motor) +
//         Prognose (Chapman-Richards bivariado + mortalidade + autodesbaste SDI).
//         Pipeline oficial continua SEMPRE em power-taper.
//
// Histórico de correções:
//   r1: Comparação SC usa o factor do PT (sem recalibração) — 150× mais rápido.
//       Log de calibração mostra alvo normalizado; sumário conciso de avisos;
//       editor de alvos ignora changes sem alteração real.
//   r2: Painel 3.5 (Prognose) com crescimento diferencial por posição sociológica,
//       mortalidade dependente da idade, autodesbaste por SDI. Sem ingrowth.
//       Prognose e desbaste são mutuamente exclusivos.

window.__MAIN_VERSION = '2.8.2+SC.r2';

import { lerArquivo, normalizarLinhas } from './parser.js';
import { filtrarHipsometria } from './chauvenet.js';
import { fitOLS, fitLM, fatorSmearing } from './regressao.js';
import { modelosPorEspecie } from './equacoes/hipsometricas.js';
import { metricasModelo } from './estatistica.js';
import { rankear } from './selecao.js';
import { N_MINIMO, R2AJ_MINIMO, N_AVISO_AMOSTRA } from './constantes.js';
import { calcularPorArvore, agregarPorParcela, estatisticasPovoamento } from './volume.js';
import { paraHectares } from './unidades.js';
import { fatorFormaInterpolado, conversaoM3Ton } from './tabelas/fatores.js';

import {
  enriquecerComAfilamento,
  agregarAfilamentoPorParcela,
  resumoAfilamentoPovoamento,
  validarIntegral,
} from './afilamento.js';

import {
  carregarCenarios,
  salvarCenarios,
  validarCenario,
  dMinimosDeCenarios,
  restaurarTodosDefaults,
} from './cenarios.js';
import { processarCenario } from './tracamento.js';
import { renderizarEditorCenarios } from './ui-cenarios.js';

import {
  garantirPainelGraficos,
  renderizarGraficosSortimentos,
  renderizarBarrasEmpilhadas,
  renderizarPerfilFuste,
} from './graficos.js';

import { renderizarPainelCEO, calcularIC } from './graficos-ceo.js';

import {
  LIMITE_FACTOR,
  CENARIO_REFERENCIA_DEFAULT,
  calcularFatorReferencia,
  aplicarFatorGlobal,
  distribuicaoFisica,
} from './calibracao-classificacao.js';

import {
  REFERENCIA_SC,
  distribuicaoSchoeffer,
  distribuicaoPowerTaperReferencia,
} from './tabelas/taper-referencia.js';

import { obterAlvosPorIdade } from './tabelas/referencia-idade.js';

import { ajustarModelosSitio, ranquearSitio } from './site-index.js';

import {
  calcularIndices,
  alturaDominanteAssmann,
  distribuicaoSociologica,
  IDADE_INDICE_DEFAULT,
} from './indices.js';

import { aplicarDesbaste, reverterDesbaste } from './desbaste.js';
import {
  renderizarEditorDesbaste,
  renderizarPreviewDesbaste,
  renderizarBalancoDesbaste
} from './ui-desbaste.js';

import { renderizarDiagnosticoDesbaste } from './ui-diagnostico.js';

import {
  enriquecerComSchoeffer,
  agregarAfilamentoSchoefferPorParcela,
  resumoAfilamentoSchoefferPovoamento,
  LABEL_MODELO_CURTO,
} from './taper-rigoroso.js';

import { PROGNOSE_DEFAULTS, projetarPovoamento } from './prognose.js';
import {
  renderizarPainelPrognose,
  renderizarProjecao,
  renderizarProjecaoDensidade,
  renderizarHistogramaDap,
  renderizarProjecaoTabela,
  renderizarBalancoProjecao,
} from './ui-prognose.js';

const QUALIDADES_EXCLUIDAS = new Set([2]);
const D_MINIMOS_FALLBACK = [6, 8];

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------
let _estadoTracamento = null;
let _estadoOriginal = null;
let _resumoDesbaste = null;
let _recalcCount = 0;
let _vistaEnergia = 'com';
let _ultimosResultados = null;

// Estado do desbaste
let _arvoresOriginais = null;
let _arvoresAtivas = null;
let _configDesbaste = null;
let _vencedorAtual = null;
let _linhasCompletas = null;

// Estado do Schöepfer diagnóstico (só diagnóstico; nunca controla o motor)
let _comparacaoSC = null;   // { resultados, factorHerdado } | { erro } | null

// Estado da prognose
let _estadoPrePrognose = null;   // snapshot { arvoresAtivas, estadoTracamento, idade, nArvoresAmostra }
let _projecaoAtual = null;       // resultado de projetarPovoamento()
let _configPrognose = { ...PROGNOSE_DEFAULTS };

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------
const log = (msg) => {
  const el = document.getElementById('log');
  if (!el) return;
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
};

// ---------------------------------------------------------------------------
// Vista com/sem energia (sincronizada)
// ---------------------------------------------------------------------------
function setVistaEnergia(vista) {
  if (vista === _vistaEnergia) return;
  _vistaEnergia = vista;
  rerenderComVista();
}

function rerenderComVista() {
  if (!_ultimosResultados || !_estadoTracamento) return;

  try { renderizarTracamento(_ultimosResultados); }
  catch (e) { log(`[Vista] ERRO traçamento — ${e.message}`); console.error(e); }

  try {
    renderizarGraficosSortimentos(
      document.getElementById('graficoSortimentos'), _ultimosResultados, _vistaEnergia);
  } catch (e) { log(`[Vista] ERRO gráfico — ${e.message}`); console.error(e); }

  try {
    renderizarComparacaoModelos(
      document.getElementById('comparacaoModelos'), _ultimosResultados, _comparacaoSC);
  } catch (e) { log(`[Vista] ERRO comparação — ${e.message}`); console.error(e); }

  const pov = _estadoTracamento.povoamento;
  if (pov) {
    try { renderizarPainelCEOCompleto(pov, _ultimosResultados); }
    catch (e) { log(`[Vista] ERRO CEO — ${e.message}`); console.error(e); }
  }

  // Reforçar avisos nos painéis re-renderizados
  if (_estadoPrePrognose) adicionarAvisosProjecao(true);
  if (_estadoOriginal) adicionarAvisosDeDesbaste(true);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
document.getElementById('arquivo').addEventListener('change', () => {
  document.getElementById('btnProcessar').disabled = false;
});

document.getElementById('btnProcessar').addEventListener('click', async () => {
  try {
    document.getElementById('log').textContent = '';
    document.getElementById('painelResultados').hidden = true;
    document.getElementById('painelDesbaste').hidden = true;
    document.getElementById('painelVolume').hidden = true;
    document.getElementById('resultadoVolume').hidden = true;
    document.getElementById('painelPrognose').hidden = true;
    document.getElementById('painelAfilamento').hidden = true;
    document.getElementById('painelCenarios').hidden = true;
    document.getElementById('painelCalibracao').hidden = true;
    document.getElementById('painelTracamento').hidden = true;
    const painelGraf = document.getElementById('painelGraficos');
    if (painelGraf) painelGraf.hidden = true;
    const selA = document.getElementById('selectArvorePerfil');
    if (selA) selA.innerHTML = '';
    const selC = document.getElementById('selectCenarioPerfil');
    if (selC) selC.innerHTML = '';
    const painelCEOEl = document.getElementById('painelCEO');
    if (painelCEOEl) painelCEOEl.hidden = true;

    // Reset total
    _estadoTracamento = null;
    _estadoOriginal = null;
    _resumoDesbaste = null;
    _recalcCount = 0;
    _ultimosResultados = null;
    _arvoresOriginais = null;
    _arvoresAtivas = null;
    _configDesbaste = null;
    _vencedorAtual = null;
    _linhasCompletas = null;
    _comparacaoSC = null;
    _estadoPrePrognose = null;
    _projecaoAtual = null;
    _configPrognose = { ...PROGNOSE_DEFAULTS };
    adicionarAvisosProjecao(false);
    adicionarAvisosDeDesbaste(false);

    log(`[main.js] v${window.__MAIN_VERSION}`);

    const file = document.getElementById('arquivo').files[0];
    if (!file) throw new Error('Selecione um ficheiro');

    log(`Lendo ficheiro: ${file.name}`);
    const linhasBrutas = await lerArquivo(file);
    log(`  ${linhasBrutas.length} linhas lidas`);

    const linhas = normalizarLinhas(linhasBrutas);
    const diag = linhas._diagnostico;

    log(`  Colunas no ficheiro: ${diag.colunasNoFicheiro.join(', ')}`);
    log(`  ${diag.aceitos} árvores com DAP+área`);
    log(`  ${diag.semAltura} sem altura medida (serão preenchidas)`);

    _linhasCompletas = linhas;
    _arvoresOriginais = linhas;
    _arvoresAtivas = linhas;
    _configDesbaste = { tipo: 'baixo', intensidadePct: 30, cadaN: 3, removerMortas: true };

    const linhasParaRegressao = linhas.filter(l => l.altura_medida);
    log(`  ${linhasParaRegressao.length} árvores com altura medida (para regressão)`);

    if (linhasParaRegressao.length < N_MINIMO) {
      throw new Error(`Amostra insuficiente para regressão: ${linhasParaRegressao.length} < ${N_MINIMO}`);
    }

    if (linhasParaRegressao.length < N_AVISO_AMOSTRA) {
      log(`  ⚠ Amostra reduzida (recomendado ≥ ${N_AVISO_AMOSTRA}).`);
    }

    const especie = document.getElementById('especie').value;
    log(`Espécie: ${especie}`);

    const aplicarChauvenet = document.getElementById('aplicarChauvenet').checked;
    let aceitos = linhasParaRegressao;
    let rejeitados = [];
    if (aplicarChauvenet) {
      const filtro = filtrarHipsometria(linhasParaRegressao);
      aceitos = filtro.aceitos;
      rejeitados = filtro.rejeitados;
      log(`Chauvenet: ${aceitos.length} aceites, ${rejeitados.length} rejeitados`);
    } else {
      log(`Chauvenet: desactivado, ${aceitos.length} linhas usadas`);
    }

    if (aceitos.length < N_MINIMO) {
      throw new Error(`Amostra insuficiente após Chauvenet: ${aceitos.length} < ${N_MINIMO}`);
    }

    const { lineares, naoLineares } = modelosPorEspecie(especie);
    const resultados = [];

    log(`\nAjustando ${lineares.length} modelos lineares...`);
    for (const modelo of lineares) {
      try {
        const X = aceitos.map(modelo.buildX);
        const y = aceitos.map(modelo.transformY);
        const fit = fitOLS(X, y);

        let cf = 1;
        if (modelo.needsSmearing) cf = fatorSmearing(fit.residuals);

        const previstos = aceitos.map((r, i) => {
          const yhat = fit.yPred[i];
          return modelo.inverseY.length >= 2 ? modelo.inverseY(yhat, r.dap) * cf : modelo.inverseY(yhat) * cf;
        });
        const observados = aceitos.map(r => r.altura);
        const metricas = metricasModelo(observados, previstos, modelo.p);

        resultados.push({ modelo, beta: fit.beta, cf, metricas });
        log(`  ✓ #${modelo.id} ${modelo.nome}: R²aj=${metricas.R2aj.toFixed(4)}, Syx%=${metricas.SyxPct.toFixed(2)}`);
      } catch (err) {
        log(`  ✗ #${modelo.id} ${modelo.nome}: ${err.message}`);
        resultados.push({ modelo, erro: err.message });
      }
    }

    if (naoLineares.length > 0) {
      log(`\nAjustando ${naoLineares.length} modelos não lineares...`);
      for (const modelo of naoLineares) {
        try {
          const x = aceitos.map(r => ({ dap: r.dap }));
          const y = aceitos.map(r => r.altura);
          const fit = fitLM(modelo.fModel, x, y, modelo.chuteInicial);
          const metricas = metricasModelo(y, fit.yPred, modelo.p_para_stats);
          resultados.push({ modelo, beta: fit.beta, cf: 1, metricas });
          log(`  ✓ #${modelo.id} ${modelo.nome}: R²aj=${metricas.R2aj.toFixed(4)}, Syx%=${metricas.SyxPct.toFixed(2)}`);
        } catch (err) {
          log(`  ✗ #${modelo.id} ${modelo.nome}: ${err.message}`);
          resultados.push({ modelo, erro: err.message });
        }
      }
    }

    const validos = resultados.filter(r => !r.erro);
    const invalidos = resultados.filter(r => r.erro);
    if (validos.length === 0) throw new Error('Nenhum modelo pôde ser ajustado. Verifique o log acima.');

    const { rankeados, problematicos } = rankear(validos);
    if (rankeados.length === 0) {
      throw new Error('Nenhum modelo conseguiu explicar a variação de altura (todos com R²aj < 0).');
    }

    const vencedor = rankeados[0];

    if (vencedor.abaixoDoIdeal) {
      const hMediaAmostra = aceitos.reduce((s, a) => s + a.altura, 0) / aceitos.length;
      const erroTipicoM = (vencedor.metricas.SyxPct * hMediaAmostra) / 100;
      log('');
      log('⚠️  RELAÇÃO HIPSOMÉTRICA FRACA');
      log(`   Melhor modelo: #${vencedor.modelo.id} ${vencedor.modelo.nome}`);
      log(`   R²aj = ${vencedor.metricas.R2aj.toFixed(4)} (ideal ≥ ${R2AJ_MINIMO})`);
      log(`   Syx  = ${vencedor.metricas.SyxPct.toFixed(2)}%  →  erro típico de ±${erroTipicoM.toFixed(2)} m por árvore`);
      log('');
      log('   CAUSA PROVÁVEL: povoamento adulto coetâneo. O motor PROSSEGUE.');
      log('');
    }

    exibirVencedor(vencedor);
    exibirRanking(rankeados, invalidos, problematicos);
    document.getElementById('painelResultados').hidden = false;

    log(`\nVencedor: #${vencedor.modelo.id} ${vencedor.modelo.nome} (soma de ranks = ${vencedor.somaRanks})`);

    _vencedorAtual = vencedor;

    document.getElementById('painelVolume').hidden = false;
    const btnVol = document.getElementById('btnVolume');
    if (!btnVol.dataset.wired) {
      document.getElementById('chkOverrideFator').addEventListener('change', (e) => {
        document.getElementById('inputFatorManual').disabled = !e.target.checked;
      });
      btnVol.dataset.wired = '1';
    }
    btnVol.onclick = () => {
      try {
        _estadoOriginal = null;
        _resumoDesbaste = null;
        _estadoPrePrognose = null;
        _projecaoAtual = null;
        executarVolume(_arvoresAtivas ?? linhas, especie, _vencedorAtual);
      } catch (e) {
        log(`[Volume] ERRO FATAL — ${e.message}`);
        console.error(e);
        alert(`Erro ao calcular volume: ${e.message}\n\nVerifique o log.`);
      }
    };

  } catch (err) {
    log(`ERRO: ${err.message}`);
    if (err.diagnostico) {
      log(`  Colunas no ficheiro: ${err.diagnostico.colunasNoFicheiro.join(', ')}`);
    }
    console.error(err);
  }
});

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'chkModoApresentacao') {
    document.body.classList.toggle('modo-apresentacao', e.target.checked);
  }
});

document.addEventListener('change', (e) => {
  if (e.target && e.target.name === 'vistaEnergiaCEO') {
    setVistaEnergia(e.target.value);
  }
});

// ---------------------------------------------------------------------------
// Painel de Desbaste (Simulação)
// ---------------------------------------------------------------------------
function prepararPainelDesbaste() {
  if (!_estadoTracamento) return;

  const painel = document.getElementById('painelDesbaste');
  const editor = document.getElementById('editorDesbaste');
  const preview = document.getElementById('previewDesbaste');
  const containerDiag = document.getElementById('diagnosticoDesbaste');
  const containerBalanco = document.getElementById('tabelaBalancoDesbaste');
  const divResultado = document.getElementById('resultadoDesbaste');
  const btnReverter = document.getElementById('btnReverterDesbaste');
  const btnAplicar = document.getElementById('btnAplicarDesbaste');

  if (!painel || !editor || !preview) return;

  painel.hidden = false;

  // Guard: prognose ativa
  if (_estadoPrePrognose) {
    editor.innerHTML = `
      <div class="aviso-pendente" style="border-left-color:#2B579A; background:#e8f0fa;">
        <strong>⚠ Prognose simulada está ativa.</strong> Reverta a prognose no Painel 3.5
        antes de aplicar um desbaste. Nesta versão, prognose e desbaste são
        <em>mutuamente exclusivos</em>.
      </div>`;
    preview.innerHTML = '';
    if (btnAplicar) btnAplicar.disabled = true;
    if (btnReverter) btnReverter.disabled = !_estadoOriginal;
    return;
  }

  if (btnAplicar) btnAplicar.disabled = false;

  if (containerDiag && _estadoTracamento) {
    const pov = _estadoTracamento.povoamento;
    const idade = _estadoTracamento.idade;
    const hDom = _estadoTracamento.hDom || pov.H_media;
    const isLocal = _estadoTracamento.isCalculado || 24;
    renderizarDiagnosticoDesbaste(containerDiag, pov, idade, hDom, isLocal);
  }

  if (_estadoOriginal && _resumoDesbaste) {
    btnReverter.disabled = false;
    divResultado.hidden = false;
    if (containerBalanco) {
      renderizarBalancoDesbaste(containerBalanco, _resumoDesbaste, _estadoOriginal.povoamento, _estadoTracamento.povoamento);
    }
    adicionarAvisosDeDesbaste(true);
  } else {
    btnReverter.disabled = true;
    divResultado.hidden = true;
    adicionarAvisosDeDesbaste(false);
  }

  const onConfigChange = (novaConfig) => {
    _configDesbaste = novaConfig;
    const r = aplicarDesbaste(_estadoTracamento.arvoresAfiladas, _configDesbaste);
    renderizarPreviewDesbaste(preview, r.resumo, _estadoTracamento.povoamento, r.remanescentes);
    flashStatus('✓ pré-visualização actualizada', 'statusDesbaste');
  };

  renderizarEditorDesbaste(editor, _configDesbaste, onConfigChange);

  const r = aplicarDesbaste(_estadoTracamento.arvoresAfiladas, _configDesbaste);
  renderizarPreviewDesbaste(preview, r.resumo, _estadoTracamento.povoamento, r.remanescentes);

  btnAplicar.onclick = () => {
    try {
      if (_estadoPrePrognose) {
        log(`[Desbaste] Bloqueado: prognose simulada está ativa. Reverta primeiro.`);
        return;
      }
      if (!_estadoOriginal) {
        _estadoOriginal = JSON.parse(JSON.stringify(_estadoTracamento));
      }

      const resultado = aplicarDesbaste(_estadoTracamento.arvoresAfiladas, _configDesbaste);

      _resumoDesbaste = resultado.resumo;

      const chavesRemanescentes = new Set(resultado.remanescentes.map(a => String(a.parcela) + '-' + String(a.arvore)));
      const linhasRemanescentes = _arvoresOriginais.filter(a => chavesRemanescentes.has(String(a.parcela) + '-' + String(a.arvore)));
      _arvoresAtivas = linhasRemanescentes;

      log(`\n[Desbaste] Simulação aplicada. Recalculando pipeline...`);

      executarVolume(_arvoresAtivas, document.getElementById('especie').value, _vencedorAtual);

      flashStatus('✓ desbaste aplicado — pipeline recalculado', 'statusDesbaste');
    } catch (e) {
      log(`[Desbaste] ERRO — ${e.message}`);
      console.error(e);
    }
  };

  btnReverter.onclick = () => {
    if (!_estadoOriginal) return;

    _estadoTracamento = JSON.parse(JSON.stringify(_estadoOriginal));
    _estadoOriginal = null;
    _resumoDesbaste = null;
    _arvoresAtivas = _arvoresOriginais;

    executarTracamento();
    renderizarVolume(_estadoTracamento.porParcela, _estadoTracamento.povoamento, false, _estadoTracamento.especie);

    adicionarAvisosDeDesbaste(false);
    divResultado.hidden = true;
    btnReverter.disabled = true;

    log(`\n[Desbaste] Simulação revertida. Povoamento original restaurado.`);
    flashStatus('✓ povoamento original restaurado', 'statusDesbaste');
  };
}

function adicionarAvisosDeDesbaste(mostrar) {
  const paineis = ['painelVolume', 'painelAfilamento', 'painelTracamento', 'painelGraficos', 'painelCEO'];
  document.querySelectorAll('.aviso-desbaste-ativo').forEach(el => el.remove());

  if (!mostrar) return;

  paineis.forEach(id => {
    const painel = document.getElementById(id);
    if (!painel || painel.hidden) return;

    const aviso = document.createElement('div');
    aviso.className = 'aviso-pendente aviso-desbaste-ativo';
    aviso.style.borderLeftColor = '#E67E22';
    aviso.style.background = '#fff8e1';
    aviso.style.marginBottom = '16px';
    aviso.innerHTML = `
      <strong>⚠ Dados Simulados (Pós-Desbaste)</strong> — Estes resultados representam 
      o povoamento <strong>remanescente</strong> após a intervenção configurada no painel 2.5.
      Para ver o povoamento original, reverta a simulação.
    `;
    painel.insertBefore(aviso, painel.firstChild);
  });
}

// ---------------------------------------------------------------------------
// Painel de Prognose (Fase 2)
// ---------------------------------------------------------------------------
function prepararPainelPrognose() {
  if (!_estadoTracamento) return;

  const painel       = document.getElementById('painelPrognose');
  const config       = document.getElementById('configuracaoPrognose');
  const grafico      = document.getElementById('graficoPrognose');
  const graficoDens  = document.getElementById('graficoPrognoseDensidade');
  const graficoHist  = document.getElementById('graficoPrognoseHistograma');
  const tabela       = document.getElementById('tabelaPrognose');
  const containerBal = document.getElementById('tabelaBalancoProjecao');
  const divResultado = document.getElementById('resultadoPrognose');
  const btnAplicar   = document.getElementById('btnAplicarPrognose');
  const btnReverter  = document.getElementById('btnReverterPrognose');

  if (!painel || !config) return;

  painel.hidden = false;

  // ── Guard: desbaste ativo ─────────────────────────────────────────────
  if (_estadoOriginal) {
    config.innerHTML = `
      <div class="aviso-pendente" style="border-left-color:#E67E22; background:#fff8e1;">
        <strong>⚠ Desbaste simulado está ativo.</strong> Reverta o desbaste no Painel 2.5
        antes de aplicar uma prognose. Prognose e desbaste são <em>mutuamente exclusivos</em>.
      </div>`;
    btnAplicar.disabled = true;
    btnReverter.disabled = !_estadoPrePrognose;
    return;
  }

  // ── Estado "projeção aplicada" ────────────────────────────────────────
  if (_estadoPrePrognose && _projecaoAtual && !_projecaoAtual.erro) {
    config.innerHTML = `
      <div class="aviso-pendente" style="border-left-color:#2B579A; background:#e8f0fa;">
        <strong>✓ Prognose aplicada.</strong> Os painéis 3 a 8 mostram o povoamento
        projetado para <strong>${_projecaoAtual.idadeAlvo} anos</strong>.
        Reverta para ajustar os parâmetros e reaplicar.
      </div>`;
    try {
      renderizarProjecao(grafico, _projecaoAtual);
      renderizarProjecaoDensidade(graficoDens, _projecaoAtual);
      renderizarHistogramaDap(graficoHist, _projecaoAtual, _estadoPrePrognose.arvoresAtivas);
      renderizarProjecaoTabela(tabela, _projecaoAtual);
      renderizarBalancoProjecao(containerBal, _projecaoAtual, buildEstadoAntes(_estadoPrePrognose));
    } catch (e) { log(`[Prognose] render ERROR — ${e.message}`); }

    divResultado.hidden = false;
    btnAplicar.disabled = true;
    btnReverter.disabled = false;
    adicionarAvisosProjecao(true);
    return;
  }

  // ── Estado normal ─────────────────────────────────────────────────────
  const estadoAtual = buildEstadoAtual();
  if (!estadoAtual) {
    config.innerHTML = `<div class="aviso-pendente">Estado atual incompleto para prognose.</div>`;
    btnAplicar.disabled = true;
    btnReverter.disabled = true;
    return;
  }

  divResultado.hidden = true;
  btnAplicar.disabled = false;
  btnReverter.disabled = true;
  adicionarAvisosProjecao(false);

  const renderPreview = () => {
    try {
      _projecaoAtual = projetarPovoamento(estadoAtual, _configPrognose);
      renderizarProjecao(grafico, _projecaoAtual);
      renderizarProjecaoDensidade(graficoDens, _projecaoAtual);
      renderizarHistogramaDap(graficoHist, _projecaoAtual, estadoAtual.arvoresAfiladas);
      renderizarProjecaoTabela(tabela, _projecaoAtual);
    } catch (e) {
      log(`[Prognose] ERRO preview — ${e.message}`);
      console.error(e);
    }
  };

  const onChange = (novaConfig) => {
    _configPrognose = novaConfig;
    renderPreview();
    flashStatus('✓ projeção actualizada', 'statusPrognose');
  };

  renderizarPainelPrognose(config, estadoAtual, _configPrognose, onChange);
  renderPreview();

  btnAplicar.onclick = () => {
    if (!_projecaoAtual || _projecaoAtual.erro) return;
    try {
      _estadoPrePrognose = {
        arvoresAtivas: _arvoresAtivas,
        estadoTracamento: JSON.parse(JSON.stringify(_estadoTracamento)),
        idade: _estadoTracamento.idade,
        nArvoresAmostra: _estadoTracamento.arvoresAfiladas.length,
      };

      _arvoresAtivas = _projecaoAtual.arvoresFuturas;
      document.getElementById('inputIdade').value = String(_projecaoAtual.idadeAlvo);

      const r = _projecaoAtual.resumo;
      log(`\n[Prognose] Aplicada: idade ${_estadoPrePrognose.idade} → ${_projecaoAtual.idadeAlvo} anos.`);
      log(`  hDom: ${fmt(estadoAtual.hDomAtual, 2)} → ${fmt(r.hDomFinal, 2)} m (Δ=${r.deltaHdom >= 0 ? '+' : ''}${fmt(r.deltaHdom, 2)})`);
      log(`  Dg:   ${fmt(estadoAtual.dgAtual, 2)} → ${fmt(r.dgFinal, 2)} cm (Δ=${r.deltaDg >= 0 ? '+' : ''}${fmt(r.deltaDg, 2)})`);
      log(`  N/ha: ${fmtInteiro(estadoAtual.nHaAtual)} → ${fmtInteiro(r.nHaFinal)} (Δ=${r.deltaNha >= 0 ? '+' : ''}${fmtInteiro(r.deltaNha)})`);
      log(`  G/ha: ${fmt(estadoAtual.gHaAtual, 2)} → ${fmt(r.gHaFinal, 2)} m²/ha (Δ=${r.deltaGha >= 0 ? '+' : ''}${fmt(r.deltaGha, 2)})`);
      log(`  Mortalidade: ${r.nArvoresMortas} árvores removidas de ${r.nArvoresAtuais} (${((r.nArvoresMortas / Math.max(1, r.nArvoresAtuais)) * 100).toFixed(1)}%)`);
      log(`  Coerência: Dg alvo ${fmt(r.dgFinal, 2)} vs alcançado ${fmt(r.dgAtingido, 2)} cm após ${r.iteracoesCoerencia} iterações.`);

      executarVolume(_arvoresAtivas, _estadoTracamento.especie, _vencedorAtual);
      flashStatus('✓ projeção aplicada — pipeline recalculado', 'statusPrognose');
    } catch (e) {
      log(`[Prognose] ERRO aplicar — ${e.message}`);
      console.error(e);
    }
  };

  btnReverter.onclick = () => {
    if (!_estadoPrePrognose) return;
    try {
      _arvoresAtivas = _estadoPrePrognose.arvoresAtivas;
      _estadoTracamento = JSON.parse(JSON.stringify(_estadoPrePrognose.estadoTracamento));
      document.getElementById('inputIdade').value = String(_estadoPrePrognose.idade);

      _estadoPrePrognose = null;
      _projecaoAtual = null;

      executarVolume(_arvoresAtivas, _estadoTracamento.especie, _vencedorAtual);
      adicionarAvisosProjecao(false);

      log(`\n[Prognose] Revertida. Estado original restaurado.`);
      flashStatus('✓ projeção revertida', 'statusPrognose');
    } catch (e) {
      log(`[Prognose] ERRO reverter — ${e.message}`);
      console.error(e);
    }
  };
}

function buildEstadoAtual() {
  if (!_estadoTracamento) return null;
  const p = _estadoTracamento.povoamento;
  if (!p) return null;

  const dgAtual = (p.G_ha > 0 && p.N_ha > 0)
    ? 100 * Math.sqrt((4 * p.G_ha) / (Math.PI * p.N_ha))
    : null;

  if (!(dgAtual > 0)) return null;

  return {
    idadeAtual: _estadoTracamento.idade,
    hDomAtual: _estadoTracamento.hDom ?? p.H_media,
    dgAtual,
    nHaAtual: p.N_ha,
    gHaAtual: p.G_ha,
    areaTotalHa: _estadoTracamento.areaTotalHa,
    areaAmostradaHa: _estadoTracamento.areaAmostradaHa,
    modeloVencedorSitio: _estadoTracamento.modeloVencedorSitio,
    especie: _estadoTracamento.especie,
    arvoresAfiladas: _estadoTracamento.arvoresAfiladas,
  };
}

function buildEstadoAntes(snap) {
  const st = snap.estadoTracamento;
  const p = st.povoamento;
  const dgAtual = (p.G_ha > 0 && p.N_ha > 0)
    ? 100 * Math.sqrt((4 * p.G_ha) / (Math.PI * p.N_ha)) : null;

  return {
    idadeAtual: snap.idade,
    hDomAtual: st.hDom ?? p.H_media,
    dgAtual,
    nHaAtual: p.N_ha,
    gHaAtual: p.G_ha,
    areaTotalHa: st.areaTotalHa,
    areaAmostradaHa: st.areaAmostradaHa,
    modeloVencedorSitio: st.modeloVencedorSitio,
    especie: st.especie,
    arvoresAfiladas: snap.arvoresAtivas,
    nArvoresAmostra: snap.nArvoresAmostra,
  };
}

function adicionarAvisosProjecao(mostrar) {
  const paineis = ['painelVolume', 'painelAfilamento', 'painelTracamento', 'painelGraficos', 'painelCEO'];
  document.querySelectorAll('.aviso-projecao-ativo').forEach(el => el.remove());
  if (!mostrar) return;

  paineis.forEach(id => {
    const painel = document.getElementById(id);
    if (!painel || painel.hidden) return;

    const aviso = document.createElement('div');
    aviso.className = 'aviso-pendente aviso-projecao-ativo';
    aviso.style.borderLeftColor = '#2B579A';
    aviso.style.background = '#e8f0fa';
    aviso.style.marginBottom = '16px';
    aviso.innerHTML = `
      <strong>🔵 Dados Projetados (Futuro)</strong> — Estes resultados representam
      o povoamento <strong>projetado</strong> para uma idade futura segundo o modelo
      Chapman-Richards bivariado. Para ver o povoamento atual, reverta a projeção
      no painel 3.5.
    `;
    painel.insertBefore(aviso, painel.firstChild);
  });
}

// ---------------------------------------------------------------------------
// Previsão de altura
// ---------------------------------------------------------------------------
function preverAltura(vencedor, dap) {
  const m = vencedor.modelo;
  const beta = vencedor.beta;
  const cf = vencedor.cf || 1;
  if (m.fModel) return m.fModel(beta, { dap });
  const X = m.buildX({ dap, altura: 0 });
  const yhat = X.reduce((s, x, i) => s + x * beta[i], 0);
  return m.inverseY.length >= 2 ? m.inverseY(yhat, dap) * cf : m.inverseY(yhat) * cf;
}

// ---------------------------------------------------------------------------
// Índice de sítio — modelo padrão
// ---------------------------------------------------------------------------
function construirModeloSitioDefault(especie, subespecie) {
  const COEFS = {
    Pinus: { taeda: { b0: 41.09, b1: 0.0603, b2: 0.795 }, elliottii: { b0: 40.50, b1: 0.0580, b2: 0.800 } },
    Eucalipto: { 'default': { b0: 35.00, b1: 0.0900, b2: 0.950 } },
  };
  const grupo = COEFS[especie];
  if (!grupo) return null;
  const coef = grupo[subespecie] ?? grupo['default'] ?? Object.values(grupo)[0];
  if (!coef) return null;

  return {
    modelo: {
      id: 'CR-default',
      nome: 'Chapman-Richards (padrão)',
      indiceSitio: (H, A, beta, Iref = IDADE_INDICE_DEFAULT) =>
        H * Math.pow((1 - Math.exp(-beta[1] * Iref)) / (1 - Math.exp(-beta[1] * A)), beta[2]),
    },
    beta: [coef.b0, coef.b1, coef.b2],
    metricas: { R2aj: null, SyxPct: null, vies: null, n: 0 },
    origem: 'default',
  };
}

function ajustarSitioSePossivel(arvores, idade, especie, subespecie) {
  const hDomInfo = alturaDominanteAssmann(arvores);
  if (!hDomInfo) return { modelo: null, motivo: 'sem H_dom' };

  const pares = hDomInfo.porParcela.map(p => ({ A: idade, H: p.hDom }));
  const idades = new Set(pares.map(p => p.A));

  if (idades.size < 3) {
    return {
      modelo: construirModeloSitioDefault(especie, subespecie),
      motivo: `apenas ${idades.size} idade(s) nos dados`,
      pares: pares.length,
    };
  }

  try {
    const resultados = ajustarModelosSitio(pares);
    const ranking = ranquearSitio(resultados);
    if (ranking.vencedor) return { modelo: ranking.vencedor, motivo: null, pares: pares.length };
    return { modelo: construirModeloSitioDefault(especie, subespecie), motivo: 'nenhum modelo passou', pares: pares.length };
  } catch (e) {
    return { modelo: construirModeloSitioDefault(especie, subespecie), motivo: `erro: ${e.message}`, pares: pares.length };
  }
}

// ---------------------------------------------------------------------------
// Pipeline de volume
// ---------------------------------------------------------------------------
function executarVolume(linhas, especie, vencedor) {
  const idade        = parseFloat(document.getElementById('inputIdade').value);
  const areaValor    = parseFloat(document.getElementById('inputAreaTotal').value);
  const unidade      = document.getElementById('selectUnidadeArea').value;
  const usaOverride  = document.getElementById('chkOverrideFator').checked;
  const fatorManual  = parseFloat(document.getElementById('inputFatorManual').value);

  if (!(idade > 0))     { alert('Idade do povoamento inválida.'); return; }
  if (!(areaValor > 0)) { alert('Área total do projeto inválida.'); return; }
  if (usaOverride && !(fatorManual > 0)) { alert('Fator de forma manual inválido.'); return; }

  let areaTotalHa;
  try { areaTotalHa = paraHectares(areaValor, unidade); }
  catch (e) { alert(e.message); return; }

  const areasParcelas = new Set();
  let areaAmostradaM2 = 0;
  for (const l of linhas) {
    const key = String(l.parcela);
    if (!areasParcelas.has(key)) {
      areasParcelas.add(key);
      areaAmostradaM2 += Number(l.area_parcela) || 0;
    }
  }
  const areaAmostradaHa = areaAmostradaM2 / 10000;

  if (areaAmostradaHa > 0 && areaTotalHa < areaAmostradaHa) {
    alert(`Área total (${areaTotalHa.toFixed(4)} ha) é MENOR que a amostrada (${areaAmostradaHa.toFixed(4)} ha).`);
    return;
  }

  const cenarios = carregarCenarios();
  let dMinimos = dMinimosDeCenarios(cenarios);
  if (dMinimos.length === 0) dMinimos = [...D_MINIMOS_FALLBACK];

  const estrategiaAltura = document.querySelector('input[name="estrategiaAltura"]:checked')?.value ?? 'equacao';

  let alturaMediaMedidas = null;
  if (estrategiaAltura === 'media') {
    const alturas = linhas.filter(l => l.altura_medida && Number.isFinite(l.altura)).map(l => l.altura);
    if (alturas.length > 0) alturaMediaMedidas = alturas.reduce((s, h) => s + h, 0) / alturas.length;
  }

  const arvoresFiltradas = linhas.filter(l => !QUALIDADES_EXCLUIDAS.has(l.qualidade));

  let nPreenchidasMedia = 0;
  let nPreenchidasEquacao = 0;
  const arvores = arvoresFiltradas.map(a => {
    if (a.altura_medida && Number.isFinite(a.altura)) return a;
    let altura;
    if (alturaMediaMedidas !== null) { altura = alturaMediaMedidas; nPreenchidasMedia++; }
    else { altura = preverAltura(vencedor, a.dap); nPreenchidasEquacao++; }
    return { ...a, altura, altura_medida: false };
  });

  let enriquecidas, porParcela, povoamento;
  try {
    enriquecidas = calcularPorArvore(arvores, especie, idade, usaOverride ? fatorManual : null);
    porParcela   = agregarPorParcela(enriquecidas);
    povoamento   = estatisticasPovoamento(enriquecidas, areaTotalHa);
  } catch (e) { alert('Erro no volume: ' + e.message); return; }

  const fatorEfetivo = povoamento.fator_forma_aplicado;
  let statsAfil, parcAfil, povAfil, validAfil;
  try {
    statsAfil = enriquecerComAfilamento(enriquecidas, especie, fatorEfetivo, dMinimos);
    parcAfil  = agregarAfilamentoPorParcela(enriquecidas, dMinimos);
    povAfil   = resumoAfilamentoPovoamento(enriquecidas, dMinimos);
    validAfil = validarIntegral(enriquecidas, fatorEfetivo);
  } catch (e) {
    statsAfil = { nTotal: enriquecidas.length, nCalibrados: 0, nFallback: 0, nIgnorados: enriquecidas.length };
    parcAfil = {}; povAfil = null; validAfil = { nVerificados: 0, erros: [] };
  }

  // ---- Enriquecimento Schöepfer (diagnóstico) ----
  let statsAfilSC, parcAfilSC, povAfilSC;
  try {
    statsAfilSC = enriquecerComSchoeffer(enriquecidas, dMinimos);
    parcAfilSC  = agregarAfilamentoSchoefferPorParcela(enriquecidas, dMinimos);
    povAfilSC   = resumoAfilamentoSchoefferPovoamento(enriquecidas, dMinimos);
    log(`[Afilamento/SC] Diagnóstico Schöepfer: ${statsAfilSC.nUsadas}/${statsAfilSC.nTotal} árvores com perfil válido.`);
  } catch (e) {
    log(`[Afilamento/SC] ERRO — ${e.message}`);
    statsAfilSC = { nUsadas: 0, nTotal: enriquecidas.length, nIgnoradas: enriquecidas.length };
    parcAfilSC = {}; povAfilSC = null;
  }

  const distSocio = distribuicaoSociologica(arvores);

  const sitInfo = ajustarSitioSePossivel(arvores, idade, especie, 'taeda');
  const modeloVencedorSitio = sitInfo.modelo;

  const hDomInfo = alturaDominanteAssmann(arvores);
  const hDom = hDomInfo?.hDomPov ?? null;
  let isCalculado = null;
  if (hDom && modeloVencedorSitio?.modelo?.indiceSitio) {
    try {
      isCalculado = modeloVencedorSitio.modelo.indiceSitio(hDom, idade, modeloVencedorSitio.beta);
      log(`[Diagnóstico] hDom = ${hDom.toFixed(2)} m, IS local = ${isCalculado.toFixed(2)} m.`);
    } catch (e) { console.warn("Erro ao calcular IS", e); }
  }

  const refIdade = obterAlvosPorIdade(idade);

  let fatorM3Ton;
  try { fatorM3Ton = conversaoM3Ton(especie, idade); }
  catch (e) { fatorM3Ton = 1.0; }

  let refNome = CENARIO_REFERENCIA_DEFAULT;
  if (!cenarios[refNome]) refNome = Object.keys(cenarios)[0];

  _estadoTracamento = {
    arvoresAfiladas: enriquecidas,
    fatorM3Ton,
    areaAmostradaHa: povoamento.area_amostrada_ha,
    dMinimos,
    cenarios,
    alvos: [...refIdade.alvos],
    alvosFonte: refIdade.fonte,
    alvosFaixa: refIdade.faixa,
    cenarioReferencia: refNome,
    povoamento,
    areaTotalHa,
    porParcela,
    arvoresAlturas: arvores,
    especie,
    idade,
    modeloVencedorSitio,
    distSocio,
    hDom,
    isCalculado,
    estrategiaAltura,
    _afilamentoData: {
      statsAfil, parcAfil, povAfil, validAfil,
      statsAfilSC, parcAfilSC, povAfilSC,
      dMinimos,
    },
  };
  _recalcCount = 0;
  _comparacaoSC = null;

  const editorEl = document.getElementById('editorCenarios');
  const onEditorChange = (novosCenarios) => {
    _estadoTracamento.cenarios = novosCenarios;
    if (!novosCenarios[_estadoTracamento.cenarioReferencia]) {
      _estadoTracamento.cenarioReferencia = Object.keys(novosCenarios)[0];
    }
    salvarCenarios(novosCenarios);
    flashStatus('✓ salvo - recalculando...');
    popularSelectCenarioReferencia();
    renderizarAlvos(document.getElementById('calibracaoAlvos'), novosCenarios, _estadoTracamento.alvos);
    executarTracamento();
  };

  renderizarEditorCenarios(editorEl, cenarios, onEditorChange);
  document.getElementById('painelCenarios').hidden = false;

  document.getElementById('btnRestaurarTodos').onclick = () => {
    if (!confirm('Restaurar todos os cenários para os valores padrão?')) return;
    const novos = restaurarTodosDefaults();
    _estadoTracamento.cenarios = novos;
    _estadoTracamento.cenarioReferencia = CENARIO_REFERENCIA_DEFAULT;
    salvarCenarios(novos);
    renderizarEditorCenarios(editorEl, novos, onEditorChange);
    popularSelectCenarioReferencia();
    renderizarAlvos(document.getElementById('calibracaoAlvos'), novos, _estadoTracamento.alvos);
    executarTracamento();
  };

  document.getElementById('btnRecalcular').onclick = () => {
    if (document.activeElement) document.activeElement.blur();
    else executarTracamento();
  };

  document.getElementById('painelCalibracao').hidden = false;
  popularSelectCenarioReferencia();

  const selRef = document.getElementById('selectCenarioReferencia');
  if (selRef && !selRef.dataset.wired) {
    selRef.addEventListener('change', () => {
      _estadoTracamento.cenarioReferencia = selRef.value;
      flashStatus('✓ referência actualizada', 'statusCalibracao');
      executarTracamento();
    });
    selRef.dataset.wired = '1';
  }

  renderizarAlvos(document.getElementById('calibracaoAlvos'), cenarios, _estadoTracamento.alvos);

  document.getElementById('btnRestaurarAlvos').onclick = () => {
    const ref = obterAlvosPorIdade(_estadoTracamento.idade);
    _estadoTracamento.alvos = [...ref.alvos];
    _estadoTracamento.alvosFonte = ref.fonte;
    _estadoTracamento.alvosFaixa = ref.faixa;
    renderizarAlvos(document.getElementById('calibracaoAlvos'), _estadoTracamento.cenarios, _estadoTracamento.alvos);
    flashStatus('✓ alvos restaurados', 'statusCalibracao');
    executarTracamento();
  };

  document.getElementById('btnAplicarCalibracao').onclick = () => {
    if (document.activeElement) document.activeElement.blur();
    else executarTracamento();
  };

  executarTracamento();

  renderizarVolume(porParcela, povoamento, usaOverride, especie);
  renderizarAfilamento(
    statsAfil, parcAfil, povAfil, validAfil, dMinimos,
    statsAfilSC, parcAfilSC, povAfilSC);
  document.getElementById('resultadoVolume').hidden = false;

  prepararPainelDesbaste();
  prepararPainelPrognose();
}

// ---------------------------------------------------------------------------
// Selector de cenário de referência
// ---------------------------------------------------------------------------
function popularSelectCenarioReferencia() {
  const sel = document.getElementById('selectCenarioReferencia');
  if (!sel || !_estadoTracamento) return;
  const cenarios = _estadoTracamento.cenarios;
  const nomes = Object.keys(cenarios);
  const refAtual = _estadoTracamento.cenarioReferencia;

  sel.innerHTML = '';
  for (const nome of nomes) {
    const opt = document.createElement('option');
    opt.value = nome;
    opt.textContent = nome;
    if (nome === refAtual) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ---------------------------------------------------------------------------
// Normalização dos alvos
// ---------------------------------------------------------------------------
function normalizarAlvos(alvos) {
  const soma = alvos.reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0) || 1;
  return alvos.map(v => (Number.isFinite(v) && v > 0 ? v : 0) / soma * 100);
}

// ---------------------------------------------------------------------------
// Traçamento + calibração + CEO  — OFICIAL (sempre power-taper)
// ---------------------------------------------------------------------------
function executarTracamento() {
  if (!_estadoTracamento) return;
  const { arvoresAfiladas: enriquecidas, fatorM3Ton, cenarios } = _estadoTracamento;
  const alvos = _estadoTracamento.alvos;
  const refNome = _estadoTracamento.cenarioReferencia;

  _recalcCount++;

  const refCenario = cenarios[refNome];
  if (!refCenario || !validarCenario(refCenario).ok) {
    log(`[Calibração] ERRO: cenário de referência "${refNome}" inválido.`);
    return;
  }

  // ============================================================
  // PIPELINE OFICIAL — power-taper
  // ============================================================
  const calibRef = calcularFatorReferencia(enriquecidas, refCenario, alvos);
  if (calibRef.avisos.length > 0) {
    for (const a of calibRef.avisos) log(`[Calibração] ${refNome}: ${a}`);
  }

  const alvosNorm = normalizarAlvos(alvos);
  const classesRef = [...refCenario.classes].sort((a, b) => b.dapMin - a.dapMin);

  classesRef.forEach((cls, k) => {
    const f = calibRef.factorPorRank[k] ?? 1;
    const alvoNorm = alvosNorm[k] ?? 0;
    const alvoCru  = alvos[k] ?? 0;
    const cum = calibRef.cumActual[k] ?? 0;
    const anterior = k > 0 ? (calibRef.cumActual[k - 1] ?? 0) : 0;
    const pct = cum - anterior;
    const delta = pct - alvoNorm;
    const flag = Math.abs(delta) < 0.5 ? '✓' : (Math.abs(delta) < 2.0 ? '~' : '⚠');
    const notaCru = Math.abs(alvoCru - alvoNorm) > 0.05
      ? ` (cru=${alvoCru.toFixed(1)}%)` : '';
    log(`  ${flag} ${cls.nome.padEnd(14)} factor=${f.toFixed(3)} ` +
        `→ ${pct.toFixed(1).padStart(5)}% ` +
        `(alvo=${alvoNorm.toFixed(1).padStart(5)}%${notaCru}, Δ=${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp)`);
  });

  const classesNoMin = [];
  const classesNoMax = [];
  classesRef.forEach((cls, k) => {
    if (!(cls.dapMin > 0)) return;
    const f = calibRef.factorPorRank[k] ?? 1;
    const alvoNorm = alvosNorm[k] ?? 0;
    const cum = calibRef.cumActual[k] ?? 0;
    const anterior = k > 0 ? (calibRef.cumActual[k - 1] ?? 0) : 0;
    const pct = cum - anterior;
    const delta = pct - alvoNorm;
    const entry = { nome: cls.nome, alvo: alvoNorm, pct, delta };
    if (Math.abs(f - LIMITE_FACTOR.min) < 1e-6) classesNoMin.push(entry);
    if (Math.abs(f - LIMITE_FACTOR.max) < 1e-6) classesNoMax.push(entry);
  });

  if (classesNoMin.length + classesNoMax.length > 0) {
    log('');
    if (classesNoMin.length > 0) {
      log(`⚠️  ${classesNoMin.length} classe(s) no factor MÍNIMO (${LIMITE_FACTOR.min}):`);
      for (const c of classesNoMin) {
        log(`   · ${c.nome.padEnd(14)} alvo=${c.alvo.toFixed(1)}% · real=${c.pct.toFixed(1)}% · Δ=${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(1)} pp`);
      }
      log(`   → O povoamento não tem árvores grandes suficientes. Alvos de classes nobres`);
      log(`     provavelmente IRREALISTAS para esta idade/sítio.`);
      log(`     Sugestão: Painel 6 → "Restaurar alvos default" (alvos por idade).`);
    }
    if (classesNoMax.length > 0) {
      log(`⚠️  ${classesNoMax.length} classe(s) no factor MÁXIMO (${LIMITE_FACTOR.max}):`);
      for (const c of classesNoMax) {
        log(`   · ${c.nome.padEnd(14)} alvo=${c.alvo.toFixed(1)}% · real=${c.pct.toFixed(1)}% · Δ=${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(1)} pp`);
      }
      log(`   → Classes com factor no máximo indicam pouca pressão de competição`);
      log(`     ou alvos demasiado conservadores.`);
    }
    log('');
  }

  const resultados = {};
  const fisicoMap = {};

  for (const [nomeCenario, cenario] of Object.entries(cenarios)) {
    if (!validarCenario(cenario).ok) continue;
    try {
      const rFisico = processarCenario(enriquecidas, cenario, fatorM3Ton);
      fisicoMap[nomeCenario] = rFisico;

      const cenarioCalibrado = aplicarFatorGlobal(cenario, calibRef.factorPorRank);
      const rCalibrado = processarCenario(enriquecidas, cenarioCalibrado, fatorM3Ton);
      resultados[nomeCenario] = rCalibrado;

      log(`[Traçamento] ${nomeCenario}: V=${fmt(rCalibrado.receitaComEnergia.volComercial, 3)} m³ · ` +
          `R$=${fmt(rCalibrado.receitaComEnergia.receitaTotal, 2)}`);
    } catch (e) {
      log(`[Traçamento] ${nomeCenario}: ERRO — ${e.message}`);
    }
  }

  // ============================================================
  // DIAGNÓSTICO — Schöepfer-SC  (usa o factor do PT)
  // ============================================================
  try {
    _comparacaoSC = calcularComparacaoSchoeffer(
      enriquecidas, cenarios, fatorM3Ton, calibRef);
    if (_comparacaoSC && !_comparacaoSC.erro) {
      const nRes = Object.keys(_comparacaoSC.resultados || {}).length;
      const fatores = _comparacaoSC.factorHerdado.map(f => f.toFixed(2)).join('/');
      log(`[Comparação SC] ${nRes} cenário(s) — factor herdado do PT (${fatores}).`);
    } else if (_comparacaoSC?.erro) {
      log(`[Comparação SC] indisponível — ${_comparacaoSC.erro}`);
    }
  } catch (e) {
    log(`[Comparação SC] ERRO fatal — ${e.message}`);
    _comparacaoSC = { erro: e.message };
  }

  let diagRef = null;
  try {
    diagRef = {
      schoeffer: distribuicaoSchoeffer(enriquecidas),
      power: distribuicaoPowerTaperReferencia(enriquecidas),
      alvos
    };
  } catch (e) { log(`[Referência SC] ERRO — ${e.message}`); }

  _ultimosResultados = resultados;
  renderizarTracamento(resultados);

  try {
    renderizarComparacaoModelos(
      document.getElementById('comparacaoModelos'), resultados, _comparacaoSC);
  } catch (e) {
    log(`[Comparação] ERRO no render — ${e.message}`);
    console.error(e);
  }

  try {
    renderizarResultadoCalibracao(
      document.getElementById('calibracaoResultado'),
      calibRef, resultados, fisicoMap, alvos, refNome, diagRef);
  } catch (e) { log(`[Calibração] ERRO — ${e.message}`); }

  try {
    garantirPainelGraficos();
    renderizarGraficosSortimentos(document.getElementById('graficoSortimentos'), resultados, _vistaEnergia);
    renderizarPerfilCompleto();
  } catch (e) { log(`[Gráficos] ERRO — ${e.message}`); }

  try {
    const povCEO = _estadoTracamento.povoamento;
    if (povCEO) renderizarPainelCEOCompleto(povCEO, resultados);
  } catch (e) { log(`[CEO] ERRO — ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Comparação Schöepfer (herda o factor do PT)
// ---------------------------------------------------------------------------
function calcularComparacaoSchoeffer(arvores, cenarios, fatorM3Ton, calibRefPT) {
  if (!calibRefPT || !Array.isArray(calibRefPT.factorPorRank) || calibRefPT.factorPorRank.length === 0) {
    return { erro: 'Fator de referência do PT indisponível' };
  }

  const processarSC = (a, c, f) => processarCenario(a, c, f, { modelo: 'schoeffer' });

  const resultados = {};
  for (const [nomeCen, cen] of Object.entries(cenarios)) {
    if (!validarCenario(cen).ok) continue;
    try {
      const cenCalib = aplicarFatorGlobal(cen, calibRefPT.factorPorRank);
      resultados[nomeCen] = processarSC(arvores, cenCalib, fatorM3Ton);
    } catch (e) {
      log(`[Comparação SC] ${nomeCen}: ERRO — ${e.message}`);
    }
  }

  return { resultados, factorHerdado: calibRefPT.factorPorRank };
}

// ---------------------------------------------------------------------------
// Painel de comparação — Power Taper (oficial) vs Schöepfer-SC (diagnóstico)
// ---------------------------------------------------------------------------
function renderizarComparacaoModelos(container, resultadosPT, comparacaoSC) {
  if (!container) return;

  if (!comparacaoSC || comparacaoSC.erro) {
    container.innerHTML = `
      <h3 style="margin-top:0; color:#666;">Comparação Power Taper vs Schöepfer-SC</h3>
      <p class="nota-vista">
        Comparação indisponível: ${comparacaoSC?.erro || '—'}
      </p>`;
    return;
  }

  const resultadosSC = comparacaoSC.resultados || {};
  const cenarios = Object.keys(resultadosPT).filter(n => resultadosSC[n]);

  if (cenarios.length === 0) {
    container.innerHTML = `
      <h3 style="margin-top:0; color:#666;">Comparação Power Taper vs Schöepfer-SC</h3>
      <p class="nota-vista">Nenhum cenário comum entre os dois modelos.</p>`;
    return;
  }

  const fmt = (n, c = 2) => Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';
  const fmtInt = (n) => Number.isFinite(n) ? Math.round(n).toLocaleString('pt-BR') : '—';

  const somaClasse = (rec, pred) => Object.values(rec.porClasse)
    .filter(pred).reduce((s, c) => s + c.volume, 0);

  let blocos = '';
  for (const nomeCen of cenarios) {
    const rPT = resultadosPT[nomeCen];
    const rSC = resultadosSC[nomeCen];
    const recPT = _vistaEnergia === 'com' ? rPT.receitaComEnergia : rPT.receitaSemEnergia;
    const recSC = _vistaEnergia === 'com' ? rSC.receitaComEnergia : rSC.receitaSemEnergia;

    const metricas = [
      ['Volume total (m³)',       recPT.volComercial,  recSC.volComercial,  2],
      ['Nº de toras',             rPT.consolidado.nToras, rSC.consolidado.nToras, 0],
      ['Nº toras reduzidas',      rPT.consolidado.nTorasReduzidas, rSC.consolidado.nTorasReduzidas, 0],
      ['Volume energia (m³)',     somaClasse(recPT, c => c.dapMin === 0), somaClasse(recSC, c => c.dapMin === 0), 2],
      ['Volume nobre ≥16 cm',     somaClasse(recPT, c => c.dapMin >= 16), somaClasse(recSC, c => c.dapMin >= 16), 2],
      ['Toneladas comerciais',    recPT.tonComercial,  recSC.tonComercial,  2],
      ['Receita total (R$)',      recPT.receitaTotal,  recSC.receitaTotal,  2],
    ];

    const deltaPct = (a, b) => (a === 0 || !Number.isFinite(a) || !Number.isFinite(b))
      ? '—' : (((b - a) / a) * 100).toFixed(1) + '%';

    const rows = metricas.map(([m, a, b, casas]) => {
      const delta = (Number.isFinite(a) && Number.isFinite(b)) ? (b - a) : NaN;
      return `<tr>
        <td>${m}</td>
        <td>${casas === 0 ? fmtInt(a) : fmt(a, casas)}</td>
        <td>${casas === 0 ? fmtInt(b) : fmt(b, casas)}</td>
        <td>${casas === 0 ? fmtInt(delta) : fmt(delta, casas)}</td>
        <td>${deltaPct(a, b)}</td>
      </tr>`;
    }).join('');

    blocos += `
      <h4 style="margin-top:16px; margin-bottom:8px;">${nomeCen}</h4>
      <div class="tabela-container">
        <table class="ed-tabela">
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Power Taper (oficial)</th>
              <th>Schöepfer-SC (diagnóstico)</th>
              <th>Δ (SC − PT)</th>
              <th>Δ %</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  container.innerHTML = `
    <div style="background:#fff8e1; border-left:4px solid #E67E22;
                padding:12px 16px; margin-bottom:16px; border-radius:4px;">
      <h4 style="margin:0 0 4px 0; color:#8B4513; font-size:13px;">
        ⚠ Schöepfer-SC é diagnóstico — não afeta resultados oficiais
      </h4>
      <p style="margin:0; font-size:12px; color:#333;">
        Os coeficientes Schöepfer-SC (Santos et al., 2019) são de <strong>referência</strong>
        e exigem cubagem rigorosa (d₁, d₂, d₄, d₆…) para calibração local.
        Enquanto esse módulo não estiver disponível, os resultados oficiais
        (volumes, sortimentos, receita, painel CEO) usam exclusivamente o
        <strong>Power Taper Calibrado</strong>. Os valores Schöepfer abaixo servem
        apenas para avaliar a sensibilidade dos resultados ao perfil do fuste.
      </p>
    </div>

    <h3 style="margin-top:0; color:#007030;">Comparação entre modelos de afilamento</h3>
    <p class="nota-vista">
      Ambos os modelos usam o <strong>mesmo factor de calibração</strong>
      (calculado no Power Taper). A diferença observada isola apenas o
      efeito do <strong>perfil do fuste</strong>.
    </p>
    ${blocos}`;
}

// ---------------------------------------------------------------------------
// Painel CEO completo
// ---------------------------------------------------------------------------
function renderizarPainelCEOCompleto(povCEO, resultados) {
  let indices = null;
  try {
    indices = calcularIndices({
      arvores: _estadoTracamento.arvoresAlturas,
      povoamento: povCEO,
      especie: _estadoTracamento.especie,
      idade: _estadoTracamento.idade,
      subespecie: 'taeda',
      modeloVencedor: _estadoTracamento.modeloVencedorSitio,
    });
  } catch (e) { log(`[Índices] ERRO — ${e.message}`); }

  renderizarIndices(document.getElementById('ceoIndices'), indices, _estadoTracamento.especie);

  try {
    const container = garantirContainerSociologia();
    if (container) renderizarSociologia(container, _estadoTracamento.distSocio);
  } catch (e) { log(`[Sociologia] ERRO — ${e.message}`); }

  let sensibilidade = null;
  try {
    sensibilidade = calcularSensibilidade(
      resultados, _estadoTracamento.cenarios, _estadoTracamento.arvoresAfiladas,
      _estadoTracamento.fatorM3Ton, _vistaEnergia);
    _estadoTracamento._ultimaSensibilidade = sensibilidade;
  } catch (e) { log(`[CEO] ERRO sensibilidade — ${e.message}`); }

  let icData = null;
  try {
    icData = calcularICCompleto(
      resultados, _estadoTracamento.porParcela, _estadoTracamento.areaTotalHa,
      _estadoTracamento.cenarios, _estadoTracamento.fatorM3Ton, _vistaEnergia);
    _estadoTracamento._ultimoIC = icData;
  } catch (e) { log(`[CEO] ERRO IC — ${e.message}`); }

  renderizarPainelCEO({
    povoamento: povCEO,
    resultados,
    areaTotalHa: _estadoTracamento.areaTotalHa,
    vistaEnergia: _vistaEnergia,
    sensibilidade: sensibilidade ?? null,
    icVolume: icData?.volume ?? null,
    icReceita: icData?.receita ?? null,
  });

  const ctxEl = document.getElementById('ceoContexto');
  if (ctxEl) {
    ctxEl.textContent = `${Object.keys(resultados).length} cenários · ` +
      `${povCEO.n_arvores} árvores · ${fmt(_estadoTracamento.areaTotalHa, 2)} ha`;
  }
}

// ---------------------------------------------------------------------------
// Sociologia — container + render
// ---------------------------------------------------------------------------
function garantirContainerSociologia() {
  let el = document.getElementById('ceoSociologia');
  if (el) return el;

  const painelCEO = document.getElementById('painelCEO');
  if (!painelCEO) return null;

  const header = document.createElement('h3');
  header.textContent = 'Composição sociológica (classes de copa)';
  header.id = 'ceoSociologiaHeader';

  el = document.createElement('div');
  el.id = 'ceoSociologia';

  const ref = document.getElementById('ceoReceitaCenarios');
  if (ref && ref.parentNode === painelCEO) {
    const h3Antes = ref.previousElementSibling;
    if (h3Antes && h3Antes.tagName === 'H3' && h3Antes.textContent.includes('Receita')) {
      painelCEO.insertBefore(header, h3Antes);
      painelCEO.insertBefore(el, h3Antes);
    } else {
      painelCEO.insertBefore(header, ref);
      painelCEO.insertBefore(el, ref);
    }
  } else {
    painelCEO.appendChild(header);
    painelCEO.appendChild(el);
  }
  return el;
}

function renderizarSociologia(container, dist) {
  if (!container) return;
  container.innerHTML = '';

  if (!dist || dist.total === 0) {
    container.innerHTML = '<p class="nota-vista">Sem coluna <code>dominancia</code> no ficheiro — composição sociológica indisponível.</p>';
    return;
  }

  const classes = [
    { key: 'dominante',   label: 'Dominante',   cor: '#007030' },
    { key: 'codominante', label: 'Codominante', cor: '#2B579A' },
    { key: 'dominada',    label: 'Dominada',    cor: '#B8860B' },
    { key: 'suprimida',   label: 'Suprimida',   cor: '#C00000' },
  ];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, text = null) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  };
  const fmt0 = (n) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—';

  const W = 860;
  const H = 100 + classes.length * 58;
  const mg = { top: 76, right: 280, bottom: 40, left: 150 };
  const areaW = W - mg.left - mg.right;
  const barH = 32;
  const slotH = (H - mg.top - mg.bottom) / classes.length;
  const maxPorHa = Math.max(...classes.map(c => dist.porHa[c.key] ?? 0), 1);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', xmlns: SVG_NS });

  svg.appendChild(el('text', { x: W / 2, y: 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: '#007030' }, 'Composição sociológica (classes de copa)'));
  svg.appendChild(el('text', { x: W / 2, y: 38, 'text-anchor': 'middle', 'font-size': 11, fill: '#666', 'font-style': 'italic' }, `${dist.total} árvores classificadas · área amostrada ${fmt(dist.areaTotalHa, 2)} ha`));

  const pctDom = dist.pct.dominante + dist.pct.codominante;
  const corResumo = pctDom >= 40 ? '#007030' : pctDom >= 25 ? '#B8860B' : '#C00000';
  svg.appendChild(el('text', { x: W / 2, y: 54, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: corResumo }, `Dominantes + codominantes: ${pctDom.toFixed(1)}% (${fmt0(dist.porHa.dominante + dist.porHa.codominante)} /ha)`));
  svg.appendChild(el('text', { x: W / 2, y: 68, 'text-anchor': 'middle', 'font-size': 10, fill: '#888', 'font-style': 'italic' }, 'Referência técnica: ≥40% de dominantes+codominantes = povoamento saudável'));

  classes.forEach((c, i) => {
    const y = mg.top + i * slotH;
    const barY = y + (slotH - barH) / 2;
    const valorHa = dist.porHa[c.key] ?? 0;
    const pct = dist.pct[c.key] ?? 0;
    const n = dist.contagem[c.key] ?? 0;
    const w = (valorHa / maxPorHa) * areaW;

    svg.appendChild(el('text', { x: mg.left - 12, y: barY + barH / 2 + 5, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 600, fill: '#333' }, c.label));
    svg.appendChild(el('rect', { x: mg.left, y: barY, width: Math.max(w, 2), height: barH, fill: c.cor, rx: 3 }));
    if (pct >= 6) svg.appendChild(el('text', { x: mg.left + w - 8, y: barY + barH / 2 + 5, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 700, fill: '#fff', 'pointer-events': 'none' }, `${pct.toFixed(1)}%`));
    svg.appendChild(el('text', { x: mg.left + areaW + 14, y: barY + barH / 2 + 2, 'font-size': 13, 'font-weight': 700, fill: c.cor }, `${fmt0(valorHa)} /ha`));
    svg.appendChild(el('text', { x: mg.left + areaW + 14, y: barY + barH / 2 + 18, 'font-size': 10, fill: '#666' }, `${pct.toFixed(1)}% · ${n} árv. (amostra)`));
  });

  container.appendChild(svg);

  const estado = pctDom >= 40 ? 'adequado' : pctDom >= 25 ? 'abaixo do ideal' : 'crítico';
  const nota = document.createElement('p');
  nota.className = 'kpi-nota';
  nota.innerHTML = `<strong>Diagnóstico:</strong> com <strong style="color:${corResumo};">${pctDom.toFixed(1)}%</strong> de dominantes+codominantes, o povoamento está em estado <strong style="color:${corResumo};">${estado}</strong>.`;
  container.appendChild(nota);
}

// ---------------------------------------------------------------------------
// Sensibilidade a preço −20%
// ---------------------------------------------------------------------------
function calcularSensibilidade(resultados, cenarios, enriquecidas, fatorM3Ton, vistaEnergia) {
  const porCenario = {};
  for (const [nome, cenario] of Object.entries(cenarios)) {
    if (!resultados[nome]) continue;
    const rec = vistaEnergia === 'sem' ? resultados[nome].receitaSemEnergia : resultados[nome].receitaComEnergia;

    let dominante = null; let maior = -Infinity;
    for (const [classe, c] of Object.entries(rec.porClasse)) {
      if (c.receita > maior) { maior = c.receita; dominante = classe; }
    }
    if (!dominante) continue;

    const cenCopia = JSON.parse(JSON.stringify(cenario));
    const cls = cenCopia.classes.find(c => c.nome === dominante);
    if (!cls) continue;
    const precoOriginal = cls.preco;
    cls.preco = precoOriginal * 0.80;

    let rNovo;
    try { rNovo = processarCenario(enriquecidas, cenCopia, fatorM3Ton); } catch (e) { continue; }
    const recNova = vistaEnergia === 'sem' ? rNovo.receitaSemEnergia : rNovo.receitaComEnergia;

    const delta = recNova.receitaTotal - rec.receitaTotal;
    const deltaPct = rec.receitaTotal > 0 ? (delta / rec.receitaTotal) * 100 : 0;

    porCenario[nome] = { classeDominante: dominante, precoOriginal, precoReduzido: cls.preco, receitaOriginal: rec.receitaTotal, receitaNova: recNova.receitaTotal, delta, deltaPct };
  }

  const rankingOriginal = Object.entries(porCenario).sort((a, b) => b[1].receitaOriginal - a[1].receitaOriginal).map(([nome]) => nome);
  const rankingNovo = Object.entries(porCenario).sort((a, b) => b[1].receitaNova - a[1].receitaNova).map(([nome]) => nome);

  return { porCenario, rankingOriginal, rankingNovo, rankingMuda: rankingOriginal[0] !== rankingNovo[0] };
}

// ---------------------------------------------------------------------------
// IC completo
// ---------------------------------------------------------------------------
function calcularICCompleto(resultados, porParcela, areaTotalHa, cenarios, fatorM3Ton, vistaEnergia) {
  if (!porParcela || porParcela.length < 2) return { volume: { erro: 'n < 2' }, receita: { erro: 'n < 2' } };

  let vencNome = null; let maior = -Infinity;
  for (const [nome, r] of Object.entries(resultados)) {
    const rec = vistaEnergia === 'sem' ? r.receitaSemEnergia : r.receitaComEnergia;
    if (rec.receitaTotal > maior) { maior = rec.receitaTotal; vencNome = nome; }
  }
  if (!vencNome) return { volume: { erro: 'sem cenário' }, receita: { erro: 'sem cenário' } };

  const icVol = calcularIC(porParcela, 'V_m3', areaTotalHa);

  const rVenc = resultados[vencNome];
  const receitaPorParcela = {};
  for (const p of porParcela) receitaPorParcela[String(p.parcela)] = { parcela: p.parcela, area_m2: p.area_m2, receita: 0 };

  for (const t of rVenc.tracamentos) {
    if (t.erro) continue;
    const key = String(t.arvore.parcela);
    if (!receitaPorParcela[key]) continue;

    for (const tora of t.toras) {
      if (vistaEnergia === 'sem' && tora.dapMin === 0) continue;
      receitaPorParcela[key].receita += (tora.volume * fatorM3Ton) * tora.preco;
    }
    if (vistaEnergia === 'com' && t.residuo && t.residuo.tipo === 'energia_reduzida') {
      receitaPorParcela[key].receita += (t.residuo.volume * fatorM3Ton) * t.residuo.preco;
    }
  }

  const icRec = calcularIC(Object.values(receitaPorParcela), 'receita', areaTotalHa);
  return { volume: icVol, receita: icRec, cenarioVencedor: vencNome };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n, casas = 3) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function fmtInteiro(n) {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('pt-BR');
}

function flashStatus(msg, id = 'statusCenarios') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visivel');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visivel'), 2500);
}

// ---------------------------------------------------------------------------
// Calibração — UI de alvos
// ---------------------------------------------------------------------------
function renderizarAlvos(container, cenarios, alvos) {
  if (!container) return;
  const scens = Object.keys(cenarios);
  const n = alvos.length;
  const refNome = _estadoTracamento?.cenarioReferencia;
  const idadeAtual = _estadoTracamento?.idade ?? 0;

  const refIdade = obterAlvosPorIdade(idadeAtual);
  const faixaTxt = `${refIdade.faixa.idadeMin}–${refIdade.faixa.idadeMax} anos`;

  const classesPorRank = [];
  for (let k = 0; k < n; k++) {
    classesPorRank[k] = {};
    for (const [nome, c] of Object.entries(cenarios)) {
      const sorted = [...c.classes].sort((a, b) => b.dapMin - a.dapMin);
      classesPorRank[k][nome] = sorted[k]?.nome ?? '—';
    }
  }

  const rows = [];
  for (let k = 0; k < n; k++) {
    const tags = scens.map(s => {
      const destacar = (s === refNome) ? 'tag-cen-ref' : 'tag-cen';
      return `<span class="${destacar}">${s}: <strong>${classesPorRank[k][s]}</strong></span>`;
    }).join(' ');
    const posicao = k === 0 ? '1º (mais nobre)' : (k === n - 1 ? `${k + 1}º (menos nobre)` : `${k + 1}º`);
    const alvo = alvos[k];

    const faixa = refIdade.faixas[k];
    let refCell = '—';
    let refClass = '';

    if (faixa) {
      if (faixa.pctMin === faixa.pctMax) {
        refCell = `${faixa.pctMin} %`;
      } else {
        refCell = `${faixa.pctMin} – ${faixa.pctMax} %`;
      }
      refClass = (alvo >= faixa.pctMin && alvo <= faixa.pctMax) ? 'ref-ok' : 'ref-fora';
    }

    rows.push(`
      <tr>
        <td>${posicao}</td>
        <td>${tags}</td>
        <td><input type="number" data-alvo-idx="${k}" value="${alvo}" step="0.1" min="0" max="100"></td>
        <td class="ref-band ${refClass}">${refCell}</td>
      </tr>
    `);
  }

  const soma = alvos.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  const somaEl = Math.abs(soma - 100) > 0.1
    ? `<p class="alerta-soma">⚠ Soma actual: ${soma.toFixed(1)}% — normalizada para 100% no cálculo.</p>`
    : `<p class="ok-soma">✓ Soma: 100%</p>`;

  const bannerIdade = `
    <div style="background: #e8f0fa; border-left: 4px solid #2B579A; padding: 12px 16px; margin-bottom: 16px; border-radius: 4px;">
      <h4 style="margin: 0 0 4px 0; color: #2B579A; font-size: 14px;">
        📅 Referência etária aplicada: ${faixaTxt}
      </h4>
      <p style="margin: 0; font-size: 13px; color: #333;">
        Os alvos abaixo foram carregados automaticamente para a idade de <strong>${idadeAtual} anos</strong>.<br>
        Fonte: <em>${refIdade.fonte}</em>
      </p>
    </div>
  `;

  container.innerHTML = `
    ${bannerIdade}
    <table class="ed-tabela alvos-tabela">
      <thead>
        <tr>
          <th>Posição</th>
          <th>Classe por cenário <span class="dim">(★ = referência)</span></th>
          <th>% alvo</th>
          <th>Referência (${faixaTxt})</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    ${somaEl}
    <p class="ref-nota" style="border-top:1px solid #ddd; padding-top:8px; margin-top:8px;">
      <em>Edite conforme dados locais mais precisos para o seu povoamento.</em>
    </p>
  `;

  container.querySelectorAll('input[data-alvo-idx]').forEach(inp => {
    const idx = parseInt(inp.dataset.alvoIdx, 10);
    const valorOriginal = _estadoTracamento.alvos[idx];

    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (!Number.isFinite(v) || v < 0) {
        inp.value = valorOriginal;
        return;
      }
      if (Math.abs(v - valorOriginal) < 1e-9) {
        return;
      }
      const novos = [..._estadoTracamento.alvos];
      novos[idx] = v;
      _estadoTracamento.alvos = novos;
      flashStatus('✓ alvo actualizado — recalculando...', 'statusCalibracao');
      renderizarAlvos(container, _estadoTracamento.cenarios, novos);
      executarTracamento();
    });

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });
  });
}

// ---------------------------------------------------------------------------
// Calibração — resultado por cenário
// ---------------------------------------------------------------------------
function renderizarResultadoCalibracao(container, calibRef, resultados, fisicoMap, alvos, refNome, diagRef) {
  if (!container) return;
  if (!resultados || Object.keys(resultados).length === 0) { container.innerHTML = ''; return; }

  let refTableHTML = '';
  if (diagRef) {
    const { schoeffer, power } = diagRef;
    const rows = schoeffer.classes.map((c, i) => {
      const p = power.classes[i];
      return `
        <tr>
          <td>${c.nome}</td>
          <td class="ref-band-cell">${c.pctMin} – ${c.pctMax}%</td>
          <td>${p.pct.toFixed(1)}%</td>
          <td>${c.pct.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');

    refTableHTML = `
      <div class="referencia-table referencia-teorica">
        <h4>Referência teórica SC — corte final 19–22 anos (informativo)</h4>
        <p class="nota">
          Valores <strong>teóricos</strong> obtidos por integral do fuste até
          d(h) = limiar (35/25/18/8 cm). Não passam pelo traçamento por toras
          nem pela calibração. Servem apenas de contexto para povoamentos maduros.
        </p>
        <div class="tabela-container">
          <table class="ed-tabela referencia-tabela-dados">
            <thead>
              <tr>
                <th>Sortimento</th>
                <th>Bandas SC</th>
                <th>Power taper (teórico)</th>
                <th>Schöepfer-SC (teórico)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  const blocos = Object.entries(resultados).map(([nomeCenario, rCalibrado]) => {
    const classesRankeadas = [...rCalibrado.cenario.classes].sort((a, b) => (a._rankAlvo ?? 0) - (b._rankAlvo ?? 0));

    const distC = distribuicaoFisica(rCalibrado);
    const rFisico = fisicoMap[nomeCenario];
    const distF = rFisico ? distribuicaoFisica(rFisico) : {};
    const ehReferencia = (nomeCenario === refNome);

    const rows = classesRankeadas.map((cls, k) => {
      const alvo = alvos[k] ?? 0;
      const fis = distF[cls.nome]?.pct ?? 0;
      const cal = distC[cls.nome]?.pct ?? 0;
      const dapOrig = cls._dapMinOriginal ?? cls.dapMin;
      const dapEff = cls.dapMin;
      const factor = cls._factorCalibracao ?? 1;
      const refBand = REFERENCIA_SC[k];
      const bandStr = refBand ? `${refBand.pctMin}–${refBand.pctMax}%` : '—';
      const inBand = refBand ? (cal >= refBand.pctMin && cal <= refBand.pctMax) : null;
      const corCal = inBand === null ? '#333' : inBand ? '#007030' : '#C00000';

      let alvoCell, deltaCell;
      if (ehReferencia) {
        const delta = cal - alvo;
        const corDelta = Math.abs(delta) < 0.5 ? '#007030' : Math.abs(delta) < 2.0 ? '#B8860B' : '#C00000';
        alvoCell = `${alvo.toFixed(1)}%`;
        deltaCell = `<td style="color:${corDelta}; font-weight:600;">${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp</td>`;
      } else {
        alvoCell = `<span class="dim">—</span>`;
        deltaCell = `<td class="dim">resultante</td>`;
      }

      return `
        <tr>
          <td>${cls.nome}</td>
          <td class="ref-band-cell">${bandStr}</td>
          <td>${dapOrig.toFixed(1)}</td>
          <td>${dapEff.toFixed(1)}</td>
          <td>${factor.toFixed(3)}</td>
          <td>${fis.toFixed(1)}%</td>
          <td style="color:${corCal}; font-weight:600;">${cal.toFixed(1)}%</td>
          <td>${alvoCell}</td>
          ${deltaCell}
        </tr>
      `;
    }).join('');

    const vFis = rFisico ? rFisico.receitaComEnergia.volComercial : 0;
    const vCal = rCalibrado.receitaComEnergia.volComercial;
    const badge = ehReferencia
      ? `<span class="badge-referencia">★ referência — alvos definidos pelo utilizador</span>`
      : `<span class="badge-herdado">factor herdado de "${refNome}" — distribuição resultante</span>`;

    return `
      <div class="calibracao-cenario ${ehReferencia ? 'eh-referencia' : ''}">
        <h4>${nomeCenario} ${badge}</h4>
        <div class="tabela-container">
          <table class="ed-tabela calibracao-tabela">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Banda SC (19–22a)</th>
                <th>DAPmin orig.</th>
                <th>DAPmin efectivo</th>
                <th>Factor</th>
                <th>%V físico</th>
                <th>%V calibrado</th>
                <th>Alvo</th>
                <th>Δ / nota</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="nota-vista">
          Volume físico: ${fmt(vFis, 3)} m³ · Volume calibrado: ${fmt(vCal, 3)} m³
          (idêntico — a calibração só muda a classificação, não o volume).
        </p>
      </div>
    `;
  }).join('');

  container.innerHTML = refTableHTML + blocos;
}

// ---------------------------------------------------------------------------
// Volume — render
// ---------------------------------------------------------------------------
function renderizarVolume(porParcela, pov, override, especie) {
  document.getElementById('spanFatorAplicado').textContent = fmt(pov.fator_forma_aplicado, 4);

  const avisoEl = document.getElementById('avisoPendenteFator');
  if (override) {
    avisoEl.style.display = 'none';
  } else {
    const idade = parseFloat(document.getElementById('inputIdade').value);
    const { extrapolado } = fatorFormaInterpolado(especie, idade);
    if (extrapolado) {
      avisoEl.textContent = extrapolado === 'baixo'
        ? `⚠ Idade ${idade} anos abaixo do mínimo tabelado. Fator foi clamped.`
        : `⚠ Idade ${idade} anos acima do máximo tabelado. Fator foi clamped.`;
      avisoEl.style.display = 'block';
    } else {
      avisoEl.style.display = 'none';
    }
  }

  const tbP = document.querySelector('#tabParcelas tbody');
  tbP.innerHTML = '';
  for (const p of porParcela) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.parcela}</td><td>${fmt(p.area_m2, 2)}</td><td>${p.n}</td>
      <td>${fmtInteiro(p.N_ha)}</td>
      <td>${fmt(p.G_m2, 4)}</td><td>${fmt(p.G_ha, 3)}</td>
      <td>${fmt(p.V_m3, 4)}</td><td><strong>${fmt(p.V_ha, 3)}</strong></td>
      <td>${fmt(p.DAP_medio, 2)}</td><td>${fmt(p.H_media, 2)}</td>`;
    if (p.area_inconsistente) tr.title = '⚠ Áreas diferentes dentro da mesma parcela';
    tbP.appendChild(tr);
  }

  document.querySelector('#tabPovoamento tbody').innerHTML = `
    <tr><td>Nº de árvores amostradas</td><td>${pov.n_arvores}</td></tr>
    <tr><td>Nº de parcelas</td><td>${pov.n_parcelas}</td></tr>
    <tr><td>Área amostrada</td><td>${fmt(pov.area_amostrada_m2, 2)} m² (${fmt(pov.area_amostrada_ha, 4)} ha)</td></tr>
    <tr><td>Área total do projeto</td><td>${fmt(pov.area_total_ha, 4)} ha</td></tr>
    <tr><td><strong>N / ha</strong></td><td><strong>${fmtInteiro(pov.N_ha)}</strong></td></tr>
    <tr><td>N total (projeto)</td><td>${fmtInteiro(pov.N_total)}</td></tr>
    <tr><td><strong>G / ha</strong></td><td><strong>${fmt(pov.G_ha, 3)} m²/ha</strong></td></tr>
    <tr><td>G total (projeto)</td><td>${fmt(pov.G_total_m2, 2)} m²</td></tr>
    <tr><td><strong>V / ha</strong></td><td><strong>${fmt(pov.V_ha, 3)} m³/ha</strong></td></tr>
    <tr><td>V total (projeto)</td><td>${fmt(pov.V_total_m3, 2)} m³</td></tr>
    <tr><td>DAP médio</td><td>${fmt(pov.DAP_medio, 2)} cm (min ${fmt(pov.DAP_min,1)}, max ${fmt(pov.DAP_max,1)})</td></tr>
    <tr><td>H média</td><td>${fmt(pov.H_media, 2)} m (min ${fmt(pov.H_min,1)}, max ${fmt(pov.H_max,1)})</td></tr>`;
}

// ---------------------------------------------------------------------------
// Afilamento — render
// ---------------------------------------------------------------------------
function renderizarAfilamento(statsAfil, porParcelaAfil, povoAfil, validacao, dMinimos,
                              statsAfilSC, porParcelaAfilSC, povoAfilSC) {
  const painel = document.getElementById('painelAfilamento');
  if (painel) painel.hidden = false;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  if (povoAfil) {
    setTxt('spanBetaMedio', fmt(povoAfil.betaMedio, 4));
    setTxt('spanBetaMin',   fmt(povoAfil.betaMin, 4));
    setTxt('spanBetaMax',   fmt(povoAfil.betaMax, 4));
    setTxt('spanHc6', fmt(povoAfil.alturaComercialMedio?.[6], 2) + ' m');
    setTxt('spanHc8', fmt(povoAfil.alturaComercialMedio?.[8], 2) + ' m');
  }

  const avisoEl = document.getElementById('avisoAfilamento');
  if (avisoEl) {
    const partes = [];
    if (statsAfil.nFallback > 0) partes.push(`${statsAfil.nFallback} árvore(s) em fallback`);
    if (statsAfil.nIgnorados > 0) partes.push(`${statsAfil.nIgnorados} árvore(s) ignorada(s)`);
    if (validacao.erros.length > 0) partes.push(`${validacao.erros.length} divergência(s) de integral`);
    if (partes.length > 0) { avisoEl.textContent = '⚠ ' + partes.join(' · '); avisoEl.hidden = false; }
    else avisoEl.hidden = true;
  }

  const tbP = document.querySelector('#tabAfilamentoParcela tbody');
  if (tbP) {
    const cabecalhoHc = dMinimos.map(d => `<th>H_c(${d}) médio (m)</th>`).join('');
    const thead = document.querySelector('#tabAfilamentoParcela thead');
    if (thead) thead.innerHTML = `<tr><th>Parcela</th><th>Calibradas</th><th>β médio</th><th>β (min – max)</th>${cabecalhoHc}</tr>`;
    tbP.innerHTML = '';
    for (const [parcela, r] of Object.entries(porParcelaAfil)) {
      const tr = document.createElement('tr');
      const colsHc = dMinimos.map(d => `<td>${fmt(r.alturaComercialMedio?.[d], 2)}</td>`).join('');
      tr.innerHTML = `<td>${parcela}</td><td>${r.nCalibrados}/${r.nTotal}</td><td>${fmt(r.betaMedio, 4)}</td><td>${fmt(r.betaMin, 4)} – ${fmt(r.betaMax, 4)}</td>${colsHc}`;
      tbP.appendChild(tr);
    }
  }

  const tbPov = document.querySelector('#tabAfilamentoPovoamento tbody');
  if (tbPov && povoAfil) {
    const linhas = [
      ['Calibradas', `${povoAfil.nCalibrados}`],
      ['β médio', fmt(povoAfil.betaMedio, 4)],
      ['β (min – max)', `${fmt(povoAfil.betaMin, 4)} – ${fmt(povoAfil.betaMax, 4)}`],
    ];
    for (const d of dMinimos) {
      linhas.push([`H_c(${d}) médio`, `${fmt(povoAfil.alturaComercialMedio?.[d], 2)} m`]);
      linhas.push([`H_c(${d}) (min – max)`, `${fmt(povoAfil.alturaComercialMin?.[d], 2)} – ${fmt(povoAfil.alturaComercialMax?.[d], 2)} m`]);
    }
    tbPov.innerHTML = linhas.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');

    if (povoAfilSC) {
      tbPov.innerHTML += `
        <tr><td colspan="2" style="background:#fff8e1; font-size:11px; color:#8B4513;
            text-transform:uppercase; padding:6px 8px; border-top:2px solid #E67E22;">
          H_c diagnóstico (Schöepfer-SC, ref. Santos 2019) — não oficial
        </td></tr>`;
      for (const d of dMinimos) {
        const hcPT = povoAfil.alturaComercialMedio?.[d];
        const hcSC = povoAfilSC.alturaComercialMedio?.[d];
        const delta = (Number.isFinite(hcPT) && Number.isFinite(hcSC)) ? hcSC - hcPT : null;
        tbPov.innerHTML += `
          <tr>
            <td>H_c(${d}) Schöepfer</td>
            <td>${fmt(hcSC, 2)} m
              <span class="dim">(Δ ${delta != null ? (delta >= 0 ? '+' : '') + fmt(delta, 2) + ' m' : '—'} vs PT)</span>
            </td>
          </tr>`;
      }
    }
  }

  const auditEl = document.getElementById('auditoriaAfilamento');
  if (auditEl) {
    const nSC = statsAfilSC?.nUsadas ?? 0;
    auditEl.textContent = `Auditoria (Power Taper): ${validacao.nVerificados} integrais verificadas · ${validacao.erros.length} fora de tolerância · fallback ${statsAfil.nFallback}/${statsAfil.nTotal} · Schöepfer diagnóstico: ${nSC}/${statsAfilSC?.nTotal ?? 0} árvores`;
  }
}

// ---------------------------------------------------------------------------
// Perfil do fuste
// ---------------------------------------------------------------------------
function renderizarPerfilCompleto() {
  const container  = document.getElementById('graficoPerfil');
  const selArvore  = document.getElementById('selectArvorePerfil');
  const selCenario = document.getElementById('selectCenarioPerfil');
  if (!container || !selArvore || !selCenario || !_estadoTracamento) return;

  const { arvoresAfiladas: enriquecidas, cenarios, dMinimos } = _estadoTracamento;
  if (!enriquecidas || enriquecidas.length === 0) return;

  if (selArvore.options.length === 0) {
    const candidatas = enriquecidas.map((a, i) => ({ a, i }))
      .filter(({ a }) => Number.isFinite(a.beta) && Number.isFinite(a.dap) && a.dap > 0 && Number.isFinite(a.altura) && a.altura > 1.3)
      .sort((x, y) => y.a.dap - x.a.dap);

    for (const { a, i } of candidatas) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Parc. ${a.parcela} · Árv. ${a.arvore ?? '?'} · DAP ${a.dap.toFixed(1)} cm · H ${a.altura.toFixed(1)} m`;
      selArvore.appendChild(opt);
    }
  }

  if (selCenario.options.length === 0) {
    for (const nome of Object.keys(cenarios)) {
      const opt = document.createElement('option');
      opt.value = nome; opt.textContent = nome; selCenario.appendChild(opt);
    }
  }

  if (!selArvore.dataset.wired) {
    selArvore.addEventListener('change', renderizarPerfilCompleto);
    selCenario.addEventListener('change', renderizarPerfilCompleto);
    selArvore.dataset.wired = '1';
  }

  const idxArvore   = parseInt(selArvore.value, 10);
  const nomeCenario = selCenario.value;
  const arvore      = enriquecidas[idxArvore];
  const cenario     = cenarios[nomeCenario];
  if (!arvore || !cenario) return;

  try {
    renderizarPerfilFuste(container, arvore, cenario, dMinimos ?? []);
  } catch (e) {
    log(`[Perfil] ERRO — ${e.message}`);
    container.innerHTML = `<p class="aviso-pendente">Erro: ${e.message}</p>`;
  }
}

// ---------------------------------------------------------------------------
// Traçamento — render
// ---------------------------------------------------------------------------
function renderizarTracamento(resultados) {
  const painel = document.getElementById('painelTracamento');
  const alvo   = document.getElementById('tabelaTracamento');
  if (!painel || !alvo) return;

  const nomes = Object.keys(resultados);
  if (nomes.length === 0) { painel.hidden = true; return; }

  let vistaAtual = _vistaEnergia;

  function receita(r) { return vistaAtual === 'com' ? r.receitaComEnergia : r.receitaSemEnergia; }
  function somaEnergia(rec) {
    const classes = Object.values(rec.porClasse).filter(c => c.ehEnergia);
    return {
      volume: classes.reduce((s, c) => s + c.volume, 0),
      toneladas: classes.reduce((s, c) => s + c.toneladas, 0),
      receita: classes.reduce((s, c) => s + c.receita, 0),
      existe: classes.length > 0,
      contabilizado: classes.some(c => c.contabilizado),
    };
  }

  const conteudoEl = document.createElement('div');
  const toggleEl = document.createElement('div');
  toggleEl.className = 'toggle-energia';
  toggleEl.innerHTML = `
    <strong>Rentabilidade:</strong>
    <label><input type="radio" name="vistaEnergia" value="com" ${vistaAtual === 'com' ? 'checked' : ''}> Com venda de energia</label>
    <label><input type="radio" name="vistaEnergia" value="sem" ${vistaAtual === 'sem' ? 'checked' : ''}> Sem venda de energia</label>
  `;

  function aplicarVista() {
    const usarCom = vistaAtual === 'com';

    const metricas = [
      ['V toras (m³)',           r => fmt(receita(r).volComercial, 2)],
      ['Nº de toras',            r => r.consolidado.nToras],
      ['Nº de toras reduzidas',  r => r.consolidado.nTorasReduzidas],
      ['Energia (V / ton / R$)', r => {
        const e = somaEnergia(receita(r));
        if (!e.existe) return '—';
        const volStr = `${fmt(e.volume, 2)} m³`;
        if (!e.contabilizado) return `${volStr} (não vendida)`;
        return `${volStr} · ${fmt(e.toneladas, 2)} ton · ${fmt(e.receita, 2)} R$`;
      }],
      ['Toneladas comerciais',   r => fmt(receita(r).tonComercial, 2)],
      ['Receita comercial (R$)', r => fmt(receita(r).receitaTotal, 2)],
      ['V descartado (m³)',      r => fmt(r.consolidado.volumeDescartado, 3)],
      ['V toco (m³)',            r => fmt(r.consolidado.volumeToco, 3)],
      ['Erros de invariante',    r => r.validacao.erros.length],
    ];

    const thCen = nomes.map(n => `<th>${n}</th>`).join('');
    const linhas = metricas.map(([label, fn]) => {
      const tds = nomes.map(n => `<td>${fn(resultados[n])}</td>`).join('');
      return `<tr><td>${label}</td>${tds}</tr>`;
    }).join('');

    const blocosClasse = nomes.map(nomeCen => {
      const r = resultados[nomeCen];
      const rec = receita(r);
      const classes = Object.values(rec.porClasse).sort((a, b) => (b.dapMin ?? 0) - (a.dapMin ?? 0));
      const volTotal = rec.volComercial;
      const tonTotal = rec.tonComercial;

      const rows = classes.map(c => {
        const naoContab = !c.contabilizado;
        const pctV   = volTotal > 0 ? (c.volume / volTotal) * 100 : 0;
        const pctTon = tonTotal > 0 ? (c.toneladas / tonTotal) * 100 : 0;
        const notaRed = c.nTorasReduzidas > 0 ? ` <small>(${c.nTorasReduzidas} red.)</small>` : '';
        const notaNaoVend = naoContab ? ' <small class="na">(não vendida)</small>' : '';

        const cellTon    = naoContab ? '<td class="na">—</td>' : `<td>${fmt(c.toneladas, 2)}</td>`;
        const cellPctTon = naoContab ? '<td class="na">—</td>' : `<td>${fmt(pctTon, 1)}%</td>`;
        const cellR      = naoContab ? '<td class="na">—</td>' : `<td>${fmt(c.receita, 2)}</td>`;

        return `
          <tr class="${naoContab ? 'nao-vendida' : ''}">
            <td>${c.nome}${notaNaoVend}</td>
            <td>${c.nToras}${notaRed}</td>
            <td>${fmt(c.volume, 2)}</td>
            <td>${fmt(pctV, 1)}%</td>
            ${cellTon}
            ${cellPctTon}
            <td>${fmt(c.preco, 2)}</td>
            ${cellR}
          </tr>`;
      }).join('');

      const rowTotal = `
        <tr class="vencedor">
          <td><strong>Total</strong></td>
          <td><strong>${r.consolidado.nToras}</strong></td>
          <td><strong>${fmt(volTotal, 2)}</strong></td>
          <td><strong>100,0%</strong></td>
          <td><strong>${fmt(tonTotal, 2)}</strong></td>
          <td><strong>100,0%</strong></td>
          <td>—</td>
          <td><strong>${fmt(rec.receitaTotal, 2)}</strong></td>
        </tr>`;

      return `
        <h4>${nomeCen}</h4>
        <div class="tabela-container">
          <table class="tab-sortimento">
            <thead>
              <tr><th>Sortimento</th><th>Nº toras</th><th>V (m³)</th><th>%V</th><th>ton</th><th>%ton</th><th>R$/ton</th><th>R$</th></tr>
            </thead>
            <tbody>${rows}${rowTotal}</tbody>
          </table>
        </div>`;
    }).join('');

    const notaBase = usarCom ? 'Base das percentagens: todas as toras (inclui energia).' : 'Base das percentagens: apenas toras comerciais (exclui energia).';

    conteudoEl.innerHTML = `
      <h3>Quadro síntese</h3>
      <div class="tabela-container">
        <table>
          <thead><tr><th>Métrica</th>${thCen}</tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      <h3 style="margin-top:24px;">Detalhe por sortimento</h3>
      <p class="nota-vista">${notaBase} Ordenado por nobreza (dapMin desc). Toco e resíduo descartado nunca entram.</p>
      ${blocosClasse}
    `;
  }

  toggleEl.addEventListener('change', (e) => {
    if (e.target.name === 'vistaEnergia') {
      vistaAtual = e.target.value;
      aplicarVista();
      setVistaEnergia(e.target.value);
    }
  });

  alvo.innerHTML = '';
  alvo.appendChild(toggleEl);
  alvo.appendChild(conteudoEl);
  aplicarVista();
  painel.hidden = false;
}

// ---------------------------------------------------------------------------
// Índices — KPIs com alertas
// ---------------------------------------------------------------------------
function renderizarIndices(container, indices, especie) {
  if (!container) return;
  if (!indices) {
    container.innerHTML = '<p class="nota-vista">Índices indisponíveis — verifique os dados de altura e DAP.</p>';
    return;
  }

  const fmtN = (n, c = 1) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';
  const bgFrom = (cor) => {
    if (cor === '#C00000') return '#fff5f5';
    if (cor === '#B8860B') return '#fff8e1';
    if (cor === '#007030') return '#e8f5ec';
    return '#fff';
  };

  const card = (label, valor, unidade, sub, cor, bg = '#fff') => `
    <div class="kpi-card" style="border-top-color:${cor}; background:${bg};">
      <div class="kpi-label">${label}</div>
      <div class="kpi-valor" style="color:${cor};">${valor} <small>${unidade}</small></div>
      <div class="kpi-sub">${sub}</div>
    </div>`;

  const ierClass = indices.ierClass ?? { cor: '#888', label: '—' };
  const idrClass = indices.idrClass ?? { cor: '#888', label: '—' };
  const vespa = indices.riscoVespa ?? { cor: '#888', label: '—', detalhe: '' };

  const html = [
    card('Índice de Sítio', fmtN(indices.indiceSitio), 'm', `H_dom aos ${indices.idadeIndice} anos · ${indices.modeloSitio ?? '—'}`, '#007030'),
    card('Altura Dominante', fmtN(indices.hDom), 'm', `idade ${indices.idade} anos (Assmann)`, '#2B579A'),
    card('IMA', fmtN(indices.ima), 'm³/ha·ano', 'V / idade', '#B8860B'),
    card('Dg', fmtN(indices.dg), 'cm', 'diâmetro quadrático médio', '#8B4513'),
    card('IER (Hart-Becking)', fmtN(indices.ier), '%', ierClass.label, ierClass.cor, bgFrom(ierClass.cor)),
    card('IDR (Reineke)', fmtN(indices.pctIdr), '% do máximo', `${idrClass.label} · ${fmtN(indices.idr, 0)} / ${fmtN(indices.idrMax, 0)}`, idrClass.cor, bgFrom(idrClass.cor)),
    card('Risco de vespa-da-madeira', fmtN(vespa.risco, 0), '/ 5', `${vespa.label} · ${vespa.detalhe}`, vespa.cor, vespa.risco >= 4 ? '#fff5f5' : vespa.risco >= 2 ? '#fff8e1' : '#e8f5ec'),
  ].join('');

  container.innerHTML = `
    <div class="kpi-grid">${html}</div>
    <p class="kpi-nota">
      <strong>Alertas:</strong> IER e IDR classificados segundo faixas de literatura
      (Pinus: IER 21% livre, 16% severo; IDRmax 1.100). Risco de vespa segundo
      Embrapa (Batista et al., 2012). <strong>Vermelho</strong> = acção recomendada;
      <strong>amarelo</strong> = monitorar; <strong>verde</strong> = adequado.
    </p>`;
}

// ---------------------------------------------------------------------------
// Etapa 1 — Exibição
// ---------------------------------------------------------------------------
function exibirVencedor(r) {
  const el = document.getElementById('vencedor');
  const nomesVars = ['DAP', 'DAP²', 'DAP³', 'DAP⁴', 'DAP⁵', 'DAP⁶', 'DAP⁷'];
  const eq = 'h = ' + r.beta.map((b, i) => i === 0 ? b.toFixed(6) : `+ ${b.toFixed(6)}·${nomesVars[i - 1] || 'x' + i}`).join(' ');

  const aviso = r.abaixoDoIdeal ? `
    <div class="aviso-pendente" style="margin-bottom:14px; border-left-color:#C00000;">
      <strong>⚠ Relação hipsométrica fraca</strong> — R²aj = ${r.metricas.R2aj.toFixed(3)} (ideal ≥ ${R2AJ_MINIMO}).<br>
      Isto é <strong>esperado em povoamentos adultos coetâneos</strong>. A equação será usada para preencher as alturas em falta.<br>
      <em>Se preferir, no painel 3 escolha "Altura média das árvores medidas".</em>
    </div>
  ` : '';

  el.innerHTML = `
    ${aviso}
    <div class="equacao-vencedora">
      <h3>#${r.modelo.id} — ${r.modelo.nome}</h3>
      <p><em>${r.modelo.expressao}</em></p>
      <p><strong>Forma com coeficientes estimados:</strong><br><code>${eq}</code></p>
      ${r.cf !== 1 ? `<p><strong>Fator de correção (Smearing):</strong> ${r.cf.toFixed(6)}</p>` : ''}
      <div>
        <span class="metrica">R²aj: <strong>${r.metricas.R2aj.toFixed(4)}</strong></span>
        <span class="metrica">Syx%: <strong>${r.metricas.SyxPct.toFixed(2)}</strong></span>
        <span class="metrica">DMP%: <strong>${r.metricas.DMP.toFixed(2)}</strong></span>
        <span class="metrica">Viés%: <strong>${r.metricas.vies.toFixed(4)}</strong></span>
        <span class="metrica">n: <strong>${r.metricas.n}</strong></span>
      </div>
    </div>
  `;
}

function exibirRanking(rankeados, rejeitados, problematicos) {
  const linhas = rankeados.map((r, i) => {
    const flag = r.abaixoDoIdeal ? ' ⚠' : '';
    return `
      <tr class="${i === 0 ? 'vencedor' : ''}">
        <td>${i + 1}${flag}</td><td>#${r.modelo.id}</td><td>${r.modelo.nome}</td>
        <td>${r.metricas.R2aj.toFixed(4)}</td>
        <td>${r.metricas.SyxPct.toFixed(2)}</td>
        <td>${r.metricas.DMP.toFixed(2)}</td>
        <td>${r.metricas.vies.toFixed(4)}</td>
        <td>${r.somaRanks}</td>
      </tr>
    `;
  }).join('');

  const rej = problematicos.map(r => `
    <tr class="rejeitado">
      <td>—</td><td>#${r.modelo.id}</td><td>${r.modelo.nome}</td>
      <td>${r.metricas.R2aj.toFixed(4)}</td>
      <td>${r.metricas.SyxPct.toFixed(2)}</td>
      <td colspan="3">Rejeitado: R²aj &lt; 0 (pior que a média)</td>
    </tr>
  `).join('');

  const errs = rejeitados.map(r => `
    <tr class="rejeitado">
      <td>—</td><td>#${r.modelo.id}</td><td>${r.modelo.nome}</td>
      <td colspan="5">Erro de ajuste: ${r.erro}</td>
    </tr>
  `).join('');

  const nAbaixo = rankeados.filter(r => r.abaixoDoIdeal).length;

  document.getElementById('ranking').innerHTML = `
    <h3>Ranking de modelos hipsométricos</h3>
    ${nAbaixo > 0 ? `
      <p class="nota-vista" style="background:#fff8e1; padding:8px 12px; border-left:3px solid #f0ad4e; margin-bottom:12px;">
        <strong>⚠ ${nAbaixo} de ${rankeados.length} modelos estão abaixo do ideal (R²aj &lt; ${R2AJ_MINIMO}).</strong>
        Isto é normal em povoamentos adultos. Modelos marcados com ⚠ continuam utilizáveis.
      </p>
    ` : ''}
    <table>
      <thead>
        <tr><th>Rank</th><th>#</th><th>Modelo</th><th>R²aj</th><th>Syx%</th><th>DMP%</th><th>Viés%</th><th>Soma Ranks</th></tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>

    ${problematicos.length > 0 ? `
      <h3 style="margin-top:24px; color:#888;">Modelos rejeitados (R²aj &lt; 0)</h3>
      <table>
        <thead><tr><th>—</th><th>#</th><th>Modelo</th><th>R²aj</th><th>Syx%</th><th colspan="3">Motivo</th></tr></thead>
        <tbody>${rej}</tbody>
      </table>
    ` : ''}

    ${rejeitados.length > 0 ? `
      <h3 style="margin-top:24px; color:#888;">Modelos com erro de ajuste</h3>
      <table>
        <thead><tr><th>—</th><th>#</th><th>Modelo</th><th colspan="5">Erro</th></tr></thead>
        <tbody>${errs}</tbody>
      </table>
    ` : ''}
  `;
}