/**
 * Parser de Excel/CSV.
 * Aceita decimais com ponto ou vírgula.
 * Usa CAP automaticamente quando DAP está vazia.
 *
 * Suporta duas colunas opcionais:
 *  · qualidade  — código 1–10 (§16.7) ou texto ("boa", "torta", "bifurcada alta").
 *  · dominancia — classe sociológica ("dominante", "co-dominante", "dominada", "suprimida").
 *
 * Tolera erros comuns de digitação ("dominate", "tirta", "co dominante").
 */

export async function lerArquivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const primeiraAba = wb.SheetNames[0];
        const ws = wb.Sheets[primeiraAba];
        const linhas = XLSX.utils.sheet_to_json(ws, { defval: null });
        resolve(linhas);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Falha ao ler o ficheiro'));
    reader.readAsArrayBuffer(file);
  });
}

// Mapa de nomes aceites (normalizado: minúsculas, sem acentos, sem espaços)
const MAPA_COLUNAS = {
  parcela: ['parcela', 'parc', 'plot', 'unidade amostral'],
  talhao: ['talhao', 'talhão', 'talh', 'bloco', 'stand'],
  arvore: ['arvore', 'árvore', 'arv', 'num arvore', 'número árvore', 'n arvore'],
  dap: ['dap', 'dap (cm)', 'dap_cm', 'dap cm', 'diametro', 'diâmetro',
        'diametro (cm)', 'diâmetro (cm)', 'diam', 'diam (cm)'],
  cap: ['cap', 'cap (cm)', 'cap_cm', 'cap cm', 'circunferencia',
        'circunferência', 'circunferencia (cm)', 'circunferência (cm)',
        'circ', 'perimetro', 'perímetro', 'perim'],
  altura: ['altura', 'altura (m)', 'h', 'altura_m', 'altura m', 'ht',
           'h total', 'altura total', 'alt total'],
  area_parcela: ['area_parcela', 'área parcela', 'area parcela',
                 'area parcela (m2)', 'área parcela (m2)', 'area_parcela_m2',
                 'area (m2)', 'área (m2)', 'area', 'área'],
  qualidade: ['qualidade', 'qualidade (código)', 'qualidade (codigo)',
              'qual', 'defeito', 'cod qualidade'],
  dominancia: ['dominancia', 'dominância', 'dominancia (copa)',
               'classe copa', 'classe_copa', 'classe sociologica',
               'classe sociológica', 'posicao sociologica',
               'posição sociológica', 'dominance', 'copa'],
};

/**
 * Normaliza um nome de coluna: minúsculas, sem acentos, sem espaços múltiplos.
 */
function normalizarNome(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function encontrarColuna(chavesOriginais, candidatos) {
  const normalizadas = chavesOriginais.map(normalizarNome);
  for (const cand of candidatos) {
    const candNorm = normalizarNome(cand);
    const idx = normalizadas.indexOf(candNorm);
    if (idx >= 0) return chavesOriginais[idx];
  }
  return null;
}

/**
 * Converte um valor (número, string com ponto, string com vírgula) em número.
 * Devolve NaN para vazio/inválido.
 */
function parseNumero(v) {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (s === '') return NaN;
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  } else if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// ---------------------------------------------------------------------------
// Qualidade — código numérico (§16.7) ou texto
// ---------------------------------------------------------------------------

const MAPA_QUALIDADE_TEXTO = (() => {
  const mapa = {
    1:  ['falha', 'falho', 'falha mecanica'],
    2:  ['morta', 'morto', 'morte', 'dead', 'seca', 'seco'],
    3:  ['bifurcada baixa', 'bifurcada_baixa', 'bifurcada-baixa',
         'bifurcacao baixa', 'bifurcacao_baixa',
         'bifurcada baixa de copa'],
    4:  ['bifurcada alta', 'bifurcada_alta', 'bifurcada-alta',
         'bifurcacao alta', 'bifurcacao_alta'],
    5:  ['torta', 'torto', 'curvada', 'curvado', 'inclinada', 'inclinado',
         'tirta' /* typo */],
    6:  ['dupla', 'duplo', 'dupla ponta', 'dupla_ponta'],
    7:  ['final de linha', 'final_linha', 'final-linha', 'final linha'],
    8:  ['macaco prego', 'macaco_prego', 'macaco-prego',
         'macacoprego', 'macaco'],
    9:  ['boa', 'bom', 'normal', 'sadia', 'sadio', 'sao', 'good',
         'sem defeito',
         // Classes sociológicas tratadas como "Boa" (defeito ausente)
         'dominante', 'dominantes', 'd',
         'codominante', 'codominantes', 'co-dominante',
         'emergente', 'emergentes', 'superior', 'superiores'],
    10: ['copa quebrada', 'copa_quebrada', 'copa-quebrada',
         'copa quebrada', 'quebrada', 'quebrado'],
  };
  const inv = {};
  for (const [codigo, textos] of Object.entries(mapa)) {
    for (const t of textos) inv[normalizarNome(t)] = Number(codigo);
  }
  return inv;
})();

function parseQualidade(v) {
  if (v === null || v === undefined || v === '') return null;

  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v >= 1 && v <= 10) return Math.round(v);
    return null;
  }

  const s = String(v).trim();
  if (s === '') return null;

  const n = parseNumero(v);
  if (Number.isFinite(n) && n >= 1 && n <= 10) return Math.round(n);

  const norm = normalizarNome(s);
  if (MAPA_QUALIDADE_TEXTO[norm] !== undefined) {
    return MAPA_QUALIDADE_TEXTO[norm];
  }

  // Fallback: correspondência parcial
  for (const [texto, codigo] of Object.entries(MAPA_QUALIDADE_TEXTO)) {
    if (norm.includes(texto) || texto.includes(norm)) return codigo;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Dominância — classe sociológica (normalizada)
// ---------------------------------------------------------------------------

const MAPA_DOMINANCIA = (() => {
  // Valores canónicos: dominante | codominante | dominada | suprimida | morta
  const mapa = {
    'dominante':   ['dominante', 'dominantes', 'dominate', /* typo */
                    'd', 'emergente', 'emergentes', 'superior', 'superiores',
                    'kraft 1', 'kraft1', 'kraft_1', 'kraft-1'],
    'codominante': ['codominante', 'codominantes', 'co-dominante',
                    'co dominante', 'cd', 'intermediaria', 'intermediária',
                    'kraft 2', 'kraft2', 'kraft_2', 'kraft-2'],
    'dominada':    ['dominada', 'dominadas', 'dominado', 'dominados',
                    'oprimida', 'oprimido', 'kraft 3', 'kraft3', 'kraft_3'],
    'suprimida':   ['suprimida', 'suprimidas', 'suprimido', 'suprimidos',
                    'oprimida', 'inferior', 'inferiores',
                    'kraft 4', 'kraft4', 'kraft_4',
                    'kraft 5', 'kraft5', 'kraft_5'],
    'morta':       ['morta', 'morto', 'mortas', 'mortos', 'dead'],
  };
  const inv = {};
  for (const [canonico, textos] of Object.entries(mapa)) {
    for (const t of textos) inv[normalizarNome(t)] = canonico;
  }
  return inv;
})();

function parseDominancia(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = normalizarNome(String(v));
  if (s === '') return null;
  if (MAPA_DOMINANCIA[s] !== undefined) return MAPA_DOMINANCIA[s];

  // Fallback: correspondência parcial ("dominante (copa superior)")
  for (const [texto, canonico] of Object.entries(MAPA_DOMINANCIA)) {
    if (s.includes(texto) || texto.includes(s)) return canonico;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Normalização principal
// ---------------------------------------------------------------------------

/**
 * Normaliza as linhas brutas.
 * - Rejeita se faltar DAP/CAP ou área de parcela.
 * - NÃO rejeita por falta de altura — mantém a linha com altura=null.
 * - Devolve array com `_diagnostico` anexado.
 */
export function normalizarLinhas(linhasBrutas) {
  if (!linhasBrutas || linhasBrutas.length === 0)
    throw new Error('Ficheiro vazio ou sem linhas');

  const amostra = linhasBrutas[0];
  const chavesOriginais = Object.keys(amostra);

  const mapa = {};
  for (const [campo, candidatos] of Object.entries(MAPA_COLUNAS)) {
    mapa[campo] = encontrarColuna(chavesOriginais, candidatos);
  }

  const diagnostico = {
    totalLido: linhasBrutas.length,
    colunasNoFicheiro: chavesOriginais,
    colunasMapeadas: { ...mapa },
    semAltura: 0,
    semDapOuCap: 0,
    dapDireto: 0,
    dapViaCap: 0,
    aceitos: 0,
    areaInvalida: 0,
    qualidadeTexto: 0,        // quantas linhas tinham qualidade em texto
    qualidadeDesconhecida: 0, // quantas não foram reconhecidas
    dominanciaPresente: 0,    // quantas linhas tinham dominância
    dominanciaDesconhecida: 0,
  };

  if (!mapa.dap && !mapa.cap) {
    const erro = new Error(
      `Coluna DAP ou CAP não encontrada. Colunas disponíveis: ${chavesOriginais.join(', ')}`
    );
    erro.diagnostico = diagnostico;
    throw erro;
  }
  if (!mapa.altura) {
    const erro = new Error(
      `Coluna ALTURA não encontrada. Colunas disponíveis: ${chavesOriginais.join(', ')}`
    );
    erro.diagnostico = diagnostico;
    throw erro;
  }
  if (!mapa.area_parcela) {
    const erro = new Error(
      `Coluna ÁREA DA PARCELA não encontrada. Colunas disponíveis: ${chavesOriginais.join(', ')}`
    );
    erro.diagnostico = diagnostico;
    throw erro;
  }

  const PI = Math.PI;
  const resultado = [];

  linhasBrutas.forEach((r, idx) => {
    // DAP — tenta direto, depois via CAP
    let dap = NaN;
    let origemDap = null;
    if (mapa.dap) {
      dap = parseNumero(r[mapa.dap]);
      if (Number.isFinite(dap) && dap > 0) {
        origemDap = 'dap';
        diagnostico.dapDireto++;
      }
    }
    if (!Number.isFinite(dap) && mapa.cap) {
      const cap = parseNumero(r[mapa.cap]);
      if (Number.isFinite(cap) && cap > 0) {
        dap = cap / PI;
        origemDap = 'cap';
        diagnostico.dapViaCap++;
      }
    }
    if (!Number.isFinite(dap) || dap <= 0) {
      diagnostico.semDapOuCap++;
      return;
    }

    // Área da parcela
    const area = parseNumero(r[mapa.area_parcela]);
    if (!Number.isFinite(area) || area <= 0) {
      diagnostico.areaInvalida++;
      return;
    }

    // Altura — não rejeita; só marca se foi medida
    const alturaValor = r[mapa.altura];
    let altura = null;
    let alturaMedida = false;
    if (alturaValor !== null && alturaValor !== undefined && alturaValor !== '') {
      const a = parseNumero(alturaValor);
      if (Number.isFinite(a) && a > 0) {
        altura = a;
        alturaMedida = true;
      }
    }
    if (!alturaMedida) diagnostico.semAltura++;

    // Qualidade
    let qualidade = null;
    if (mapa.qualidade && r[mapa.qualidade] !== null && r[mapa.qualidade] !== '') {
      const rawQ = r[mapa.qualidade];
      if (typeof rawQ === 'string') diagnostico.qualidadeTexto++;
      qualidade = parseQualidade(rawQ);
      if (qualidade === null) diagnostico.qualidadeDesconhecida++;
    }

    // Dominância (classe sociológica)
    let dominancia = null;
    if (mapa.dominancia && r[mapa.dominancia] !== null && r[mapa.dominancia] !== '') {
      dominancia = parseDominancia(r[mapa.dominancia]);
      if (dominancia !== null) diagnostico.dominanciaPresente++;
      else diagnostico.dominanciaDesconhecida++;
    }

    const arvoreValor = mapa.arvore ? parseNumero(r[mapa.arvore]) : null;
    const parcelaValor = mapa.parcela ? r[mapa.parcela] : null;

    resultado.push({
      linha: idx + 2,
      parcela: parcelaValor,
      talhao: mapa.talhao ? r[mapa.talhao] : null,
      arvore: arvoreValor,
      dap,
      altura,                    // número ou null
      altura_medida: alturaMedida,
      area_parcela: area,
      qualidade,                 // código 1–10 ou null
      dominancia,                // 'dominante'|'codominante'|'dominada'|'suprimida'|'morta'|null
      origem_dap: origemDap
    });
    diagnostico.aceitos++;
  });

  resultado._diagnostico = diagnostico;
  return resultado;
}