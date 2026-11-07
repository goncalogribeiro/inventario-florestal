// js/ui-diagnostico.js
import { obterLimitesAreaBasal, calcularNpPadoin, projetarCrescimentoAreaBasal } from './desbaste-diagnostico.js';

// Função auxiliar: Densidade Alvo para Toras Grossas
function calcularDensidadeAlvoTorasGrossas(hDom) {
  return Math.round(Math.max(300, 900 - (hDom * 18)));
}

export function renderizarDiagnosticoDesbaste(container, povoamento, idade, hDom, isLocal) {
  if (!container) return;

  const gAtual = povoamento.G_ha;
  const limites = obterLimitesAreaBasal(isLocal);
  const projecao = projetarCrescimentoAreaBasal(gAtual, idade, limites.gatilhoMax, 'moderado');
  
  const npPotencial = calcularNpPadoin(hDom, 14);
  const nAlvoTorasGrossas = calcularDensidadeAlvoTorasGrossas(hDom);
  const nAtual = povoamento.N_ha;
  const dapMedio = povoamento.DAP_medio;

  // Definição do status
  let status, cor, mensagem, acao;
  if (gAtual < limites.gatilhoMin) {
    status = 'Aguardar'; cor = '#007030';
    mensagem = 'A floresta está em crescimento livre.';
    acao = 'Não há necessidade de desbaste imediato.';
  } else if (gAtual < limites.gatilhoIdeal) {
    status = 'Ponto de Corte'; cor = '#B8860B';
    mensagem = 'A floresta atingiu o ponto de corte inicial.';
    acao = 'Pode aguardar, mas o desbaste já é tecnicamente viável.';
  } else if (gAtual <= limites.gatilhoMax) {
    status = 'Ponto Ideal'; cor = '#E67E22';
    mensagem = 'A floresta está na janela ideal de desbaste.';
    acao = 'Desbaste recomendado para maximizar o crescimento.';
  } else {
    status = 'Crítico'; cor = '#C00000';
    mensagem = 'Área basal excessiva. Competição severa instalada.';
    acao = '🚨 Desbaste URGENTE. Alto risco de estagnação.';
  }

  const fmt = (n, c = 1) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—';

  // Cálculos para os Gráficos SVG
  const svgWidth = 100;
  const svgHeight = 20;
  
  // Percentagem da Área Basal no Termómetro (0 a 100%)
  // Consideramos 0 até ao gatilhoMax + 10
  const maxG = limites.gatilhoMax + 10;
  const pctG = Math.min(100, (gAtual / maxG) * 100);
  const pctIdeal = (limites.gatilhoIdeal / maxG) * 100;
  const pctMax = (limites.gatilhoMax / maxG) * 100;

  // Percentagem do DAP vs Alvo (estimado pela heurística: DAP ideal ~ 40cm para toras grossas)
  const dapAlvo = 40; 
  const pctDap = Math.min(100, (dapMedio / dapAlvo) * 100);

  container.innerHTML = `
    <div class="diagnostico-card" style="border-left: 5px solid ${cor}; background: ${cor}11; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 8px 0; color: ${cor}; font-size: 16px;">
        ${status.toUpperCase()} — G Atual: ${fmt(gAtual, 1)} m²/ha
      </h3>
      <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>Diagnóstico:</strong> ${mensagem}</p>
      <p style="margin: 0; font-size: 14px;"><strong>Ação:</strong> ${acao}</p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
      
      <!-- COLUNA 1: Área Basal (Termómetro) -->
      <div style="border: 1px solid #ddd; padding: 12px; border-radius: 6px; background: #fff;">
        <h4 style="margin: 0 0 8px 0; color: #555; font-size: 12px; text-transform: uppercase;">Termómetro de Área Basal (G)</h4>
        <p style="margin: 0 0 10px 0; font-size: 12px;">
          Limite Crítico: <strong>${fmt(limites.gatilhoMax, 1)} m²/ha</strong>
        </p>
        
        <!-- Barra SVG -->
        <div style="position: relative; width: 100%; height: 24px; background: #eee; border-radius: 12px; overflow: hidden; margin-bottom: 8px;">
          <!-- Zonas -->
          <div style="position: absolute; left: 0; width: ${pctIdeal}%; height: 100%; background: #c8e6c9;"></div>
          <div style="position: absolute; left: ${pctIdeal}%; width: ${pctMax - pctIdeal}%; height: 100%; background: #ffe0b2;"></div>
          <div style="position: absolute; left: ${pctMax}%; right: 0; height: 100%; background: #ffcdd2;"></div>
          <!-- Ponteiro -->
          <div style="position: absolute; left: ${pctG}%; top: 0; bottom: 0; width: 4px; background: ${cor}; transform: translateX(-50%);"></div>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
          <span>Livre</span>
          <span>Ideal</span>
          <span>Crítico</span>
        </div>

        <p style="margin: 10px 0 0 0; font-size: 12px; color: #333;">
          O povoamento atingirá o limite crítico em <strong>${projecao.anosParaMax === 0 ? 'Já atingiu' : `${projecao.anosParaMax} anos`}</strong>.
        </p>
      </div>

      <!-- COLUNA 2: Densidades e DAP -->
      <div style="border: 1px solid #ddd; padding: 12px; border-radius: 6px; background: #fff;">
        <h4 style="margin: 0 0 8px 0; color: #555; font-size: 12px; text-transform: uppercase;">Densidade e DAP</h4>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <div style="text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #666;">Potencial (Padoin)</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 700; color: #2B579A;">${Math.round(npPotencial)}</p>
          </div>
          <div style="text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #666;">Alvo (Toras)</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 700; color: #007030;">${nAlvoTorasGrossas}</p>
          </div>
          <div style="text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #666;">Actual</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 700; color: #333;">${Math.round(nAtual)}</p>
          </div>
        </div>

        <p style="margin: 0 0 4px 0; font-size: 11px; color: #666;">DAP Médio vs Alvo (${dapAlvo} cm)</p>
        <div style="position: relative; width: 100%; height: 12px; background: #eee; border-radius: 6px; overflow: hidden;">
           <div style="width: ${pctDap}%; height: 100%; background: #8B4513;"></div>
        </div>
        <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; color: #8B4513;">${fmt(dapMedio)} cm</p>
      </div>
    </div>

    <div style="background: #f4f4f4; padding: 10px; border-radius: 4px; font-size: 11px; color: #666;">
      <strong>Como ler este painel:</strong> O termómetro mostra a sua Área Basal (G) em relação ao limite crítico. 
      A caixa da direita mostra a sua densidade em relação ao modelo de Padoin e ao alvo para toras grossas. 
      O simulador é 100% opcional: nada muda nos resultados abaixo até clicar em "Aplicar Desbaste".
    </div>
  `;
}