# HANDOFF — Sistema de Inventário Florestal
**Versão atual:** v2.8.2+SC.r2 (estável, validada)  
**Próxima versão-alvo:** v2.9.0 (Planejamento de Longo Prazo / FSC)  
**Data:** Novembro/2026  
**Sentinel:** `__MAIN_282_SC_R2__` (v2.8.2+SC.r2) → `__MAIN_290__` (v2.9.0)

---

## 1. Contexto do Projeto

Sistema web (HTML5 + ES modules, sem build step, servido por `npx serve .`) para 
inventário florestal de *Pinus taeda* e *Eucalyptus* em plantações comerciais 
brasileiras.

### Estado consolidado da v2.8.2+SC.r2

- **Hipsometria:** 24 modelos lineares + 3 não lineares; ranking por soma de ranks.
- **Volume:** fator de forma com interpolação etária e clamp.
- **Afilamento:** *Power Taper* calibrado por bisseção (motor oficial).
- **Traçamento:** cenários editáveis com `dapMin`/`dapMax`.
- **Calibração comercial:** fator de referência único por bisseção sobre volume traçado.
- **Índices e Painel CEO:** KPIs, sensibilidade a preço, FPC no IC 95%.
- **Simulador de Desbaste (Painel 2.5):** diagnóstico G vs. IS (Padoin, 2007).
- **Alvos por Idade (Painel 6):** referências de sortimento (Kohler, IPEF, Santos).
- **Schöepfer diagnóstico (Painel 7):** comparação lado a lado com o Power Taper.
  - ⚠ **NÃO é motor oficial** — diretriz v2.8.2 (ver §3).
- **Prognose (Painel 3.5):** Chapman-Richards bivariado + mortalidade + SDI.
  - Sem ingrowth (não há recrutamento em plantio comercial).

**Golden test:** `INVENTARIO-TESTE-MOBRAS-9ANOS-67HA.xlsx`  
- 2502 árvores, 119 com altura medida
- Vencedor: #1 Berkhout (R²aj=0.7337, soma de ranks=8)
- Volume físico: 219 574 m³ (Realista)
- Calibração: fatores `0.850 / 1.059 / 0.973 / 0.961 / 1.000`

---

## 2. Inventário de Ficheiros (v2.8.2+SC.r2)

```
inventario-florestal/
├── index.html                                    (v2.8.2+SC.r2)
├── README.md                                     (a criar na Fase 0)
├── .gitignore                                    (a criar na Fase 0)
├── HANDOFF - Sistema de Inventário Florestal v2.9.0.md
├── css/
│   └── style.css                                 (v2.8.2+SC.r2)
└── js/
    ├── main.js                                   (r2 — sentinel __MAIN_282_SC_R2__)
    ├── parser.js                                 (v2.8.1)
    ├── chauvenet.js                              (v2.8.1)
    ├── regressao.js                              (v2.8.1)
    ├── algebra.js                                (v2.8.1)
    ├── estatistica.js                            (v2.8.1)
    ├── selecao.js                                (v2.8.1)
    ├── constantes.js                             (v2.8.1)
    ├── unidades.js                               (v2.8.1)
    ├── volume.js                                 (v2.8.1)
    ├── afilamento.js                             (v2.8.1)
    ├── tracamento.js                             (r1 — aceita opcoes.modelo)
    ├── cenarios.js                               (v2.8.1)
    ├── calibracao-classificacao.js               (r1 — aceita opcoes.processarFn)
    ├── ui-cenarios.js                            (v2.8.1)
    ├── indices.js                                (v2.8.1)
    ├── site-index.js                             (v2.8.1)
    ├── desbaste.js                               (v2.8.1)
    ├── desbaste-diagnostico.js                   (v2.8.1 — nome corrigido)
    ├── ui-desbaste.js                            (v2.8.1)
    ├── ui-diagnostico.js                         (v2.8.1)
    ├── graficos.js                               (v2.8.1)
    ├── graficos-ceo.js                           (v2.8.1)
    ├── taper-rigoroso.js                         (r1 — NOVO, diagnóstico)
    ├── prognose.js                               (r2 — NOVO)
    ├── ui-prognose.js                            (r2 — NOVO)
    ├── tabelas/
    │   ├── fatores.js                            (v2.8.1)
    │   ├── referencia-idade.js                   (v2.8.1)
    │   ├── taper-referencia.js                   (r1)
    │   ├── schoeffer-primitivas.js               (r1 — NOVO, módulo de folha)
    │   └── area-basal-referencia.js              (legado, não usado)
    └── equacoes/
        └── hipsometricas.js                      (v2.8.1)
```

**Total:** 32 ficheiros JS + 1 HTML + 1 CSS.

---

## 3. Diretrizes Técnicas Invioláveis

### 3.1. Motor oficial = Power Taper Calibrado

> ⚠️ Os coeficientes de Schöepfer (Santos et al., 2019) exigem **cubagem 
> rigorosa** (d₁, d₂, d₄, d₆…) para calibração local. Um inventário 
> convencional (DAP + H) **não permite ajustar** esses coeficientes.
>
> **Decisão:** o motor oficial continua a ser o *Power Taper Calibrado*. 
> O Schöepfer é **exclusivamente diagnóstico** até que o módulo de cubagem 
> rigorosa esteja pronto (Fase 3).

### 3.2. Sem ingrowth em plantio comercial

> Plantações brasileiras de *Pinus*/*Eucalyptus* não têm recrutamento 
> natural significativo. O modelo de prognose trata apenas:
> - **Crescimento** das árvores existentes (diferencial por posição sociológica)
> - **Mortalidade** dependente da idade
> - **Autodesbaste** por SDI (Reineke)

### 3.3. Prognose e Desbaste (mutuamente exclusivos na v2.8.2)

> Na v2.8.2+SC.r2, os painéis 2.5 (desbaste) e 3.5 (prognose) são 
> **mutuamente exclusivos**. Aplicar um bloqueia o outro. Reverter é 
> obrigatório antes de alternar.
>
> A v2.9.0 (Planejamento) vai **unificar** os dois num simulador 
> multi-desbaste, sem essa restrição.

### 3.4. Formato dos ficheiros de entrada

Colunas reconhecidas (normalizadas, tolerantes a acentos/maiúsculas):

| Campo | Obrigatório | Exemplos |
|---|---|---|
| Parcela | recomendado | `parcela`, `parc`, `plot` |
| Árvore | recomendado | `arvore`, `arv`, `n arvore` |
| DAP (cm) | **sim** (ou CAP) | `dap`, `diametro`, `diam` |
| CAP (cm) | alternativa | `cap`, `circunferencia` |
| Altura (m) | **sim** | `altura`, `h`, `ht` |
| Área parcela (m²) | **sim** | `area_parcela`, `area` |
| Qualidade | opcional | `qualidade`, `defeito` (1–10) |
| Dominância | opcional | `dominancia`, `classe copa` |

---

## 4. Próxima Fase — v2.9.0: Planejamento de Longo Prazo (FSC)

### 4.1. Motivação

O **FSC** (Forest Stewardship Council) exige, nos P&C:
- **Compromisso de longo prazo** demonstrado por plano de manejo durável
- **Metas verificáveis** de produção e sustentabilidade
- **Monitoramento contínuo** de produtividade, crescimento, rendimento e viabilidade

Para *Pinus taeda* no Sul do Brasil, o horizonte de **23–25 anos** cobre um 
ciclo completo de rotação (20–25 anos). É plenamente justificável e 
materializa o requisito do FSC.

### 4.2. Decisões de arquitetura (aprovadas pelo utilizador)

| Ponto | Decisão | Justificação |
|---|---|---|
| **1** | **Painel autónomo** (`js/planejamento.js` + `js/ui-planejamento.js`) | Mantém `prognose.js` simples; complexidade do multi-desbaste fica isolada |
| **2** | **Manuais + 3 regimes pré-definidos** | Regimes documentados com fonte (Mainardi, Elesbão, Embrapa) são aceites pelo FSC |
| **3** | **Visualizar + Exportar CSV** | Não altera os painéis 4-9; o valor está no relatório de sustentabilidade |

### 4.3. Ficheiros previstos

**Novos (3):**
```
js/planejamento.js               (~500 linhas — motor de simulação multi-desbaste)
js/ui-planejamento.js            (~600 linhas — editor, gráficos, tabela, export)
js/tabelas/regimes-referencia.js (~100 linhas — 3 regimes pré-definidos)
```

**Modificados (3):**
```
index.html                       (+ painel 3.6)
js/main.js                       (+ wiring, ~80 linhas)
css/style.css                    (+ regras, ~80 linhas)
```

**Nada do que está funcional é tocado.**

### 4.4. Estrutura do regime

```js
// js/tabelas/regimes-referencia.js
export const REGIMES_REFERENCIA = Object.freeze({
  conservador: {
    nome: 'Conservador',
    descricao: 'Sem desbaste até 15 anos; corte raso aos 25.',
    horizonteAnos: 25,
    corteRasoIdade: 25,
    desbastes: [],
    taxaDesconto: 0.06,
    fonte: 'Mainardi (1996); Elesbão & Schneider (2011)',
  },
  balanceado: {
    nome: 'Balanceado',
    descricao: 'Um desbaste aos 10 (30%) e outro aos 15 (25%); corte raso aos 23.',
    horizonteAnos: 23,
    corteRasoIdade: 23,
    desbastes: [
      { idade: 10, tipo: 'baixo', intensidadePct: 30, removerMortas: true },
      { idade: 15, tipo: 'baixo', intensidadePct: 25, removerMortas: true },
    ],
    taxaDesconto: 0.06,
    fonte: 'Embrapa (2012); Kohler et al. (2015)',
  },
  intensivo: {
    nome: 'Intensivo',
    descricao: 'Três desbastes (8, 12, 16); corte raso aos 22.',
    horizonteAnos: 22,
    corteRasoIdade: 22,
    desbastes: [
      { idade: 8,  tipo: 'sistematico', cadaN: 3, removerMortas: true },
      { idade: 12, tipo: 'selectivo',   intensidadePct: 30, removerMortas: true },
      { idade: 16, tipo: 'baixo',       intensidadePct: 25, removerMortas: true },
    ],
    taxaDesconto: 0.06,
    fonte: 'Heberle (2024); Padoin (2007)',
  },
});
```

### 4.5. Estrutura da série ano a ano

```js
{
  serieAnoAno: [
    {
      idade: 7,
      nHa: 1500,
      gHa: 30.2,
      dgCm: 16.1,
      hDomM: 11.62,
      volumeEmPeM3Ha: 195.4,
      volumeRemovidoM3Ha: 0,
      receitaBrutaRsha: 0,
      custoRsha: 0,
      fluxoLiquidoRsha: 0,
      fluxoDescontadoRsha: 0,
      evento: null,       // 'desbaste:baixo:30%' | 'corte-raso'
      sdiOcupacao: 0.42,
    },
    // ...
  ],
  resumo: {
    horizonteAnos: 23,
    idadeCorteRaso: 23,
    vmaM3HaAno: 24.5,
    volumeTotalRemovidoM3Ha: 380.2,
    volumeCorteRasoM3Ha: 185.6,
    receitaTotalRsha: 42500.00,
    custoTotalRsha: 3500.00,
    vplRsha: 12800.00,
    tir: 0.14,
    sdiMax: 0.61,
    idadeSdiMax: 14,
    desbastes: [/* ... */],
    alertas: [/* ... */],
  },
  arvoresCorteRaso: [/* árvores finais, se aplicável */],
}
```

### 4.6. Algoritmo do motor (`planejamento.js`)

```
ENTRADA: estadoAtual (do Painel 3), regime (ver 4.4)
SAÍDA:  { serieAnoAno: [...], resumo: {...}, arvoresCorteRaso: [...] }

1. Ordenar os eventos por idade: [desbaste1, desbaste2, ..., corteRaso]

2. Para cada evento E (em sequência):
   a. projetarPovoamento(estadoAtual, { idadeAlvo: E.idade })
   b. Se E é desbaste:
      - aplicarDesbaste(árvores, config)
      - processarCenario(árvores removidas) → volume removido
      - acumular receita e custos no ano
      - atualizar estadoAtual com remanescentes
   c. Se E é corte raso:
      - processarCenario(árvores) → volume final
      - acumular receita no ano
      - encerrar

3. Preencher anos sem evento com dados do snapshot de projetarPovoamento

4. Calcular indicadores:
   - VMA = volume total removido / horizonte
   - VPL = Σ fluxo_ano / (1+taxa)^ano
   - TIR = raiz de Σ fluxo/(1+r)^t = 0
   - SDI máximo atingido
   - Cobertura do horizonte (anos com dados)
```

### 4.7. Indicadores de sustentabilidade (FSC)

| Indicador | Fórmula | Limite de alerta |
|---|---|---|
| VMA (m³/ha·ano) | (Vol removido + Vol corte) / horizonte | ≥ 15 m³/ha·ano |
| Produção sustentada | Desvio-padrão de VMA anual | < 20% da média |
| SDI máximo | max(SDI/N_ha·ano) | ≤ 0.65 |
| Cobertura do horizonte | anos_com_dados / horizonte | ≥ 0.95 |
| VPL | Σ fluxo_descontado | > 0 |
| TIR | raiz de Σ fluxo/(1+r)^t = 0 | > taxa de desconto |

### 4.8. Entrega em 3 fases

| Entrega | Conteúdo | Ficheiros |
|---|---|---|
| **E1** | Regimes de referência + motor de simulação | `regimes-referencia.js`, `planejamento.js` |
| **E2** | UI do painel 3.6 (editor + gráficos + tabela) | `ui-planejamento.js` |
| **E3** | Integração final + export CSV | `index.html`, `main.js`, `style.css` |

Cada entrega é testável isoladamente. **Nenhuma toca nos painéis 1-9 atuais.**

---

## 5. Fase 0 — Preparação do GitHub (antes do código)

Antes de começar E1, vamos configurar o GitHub para ter histórico rastreável.

### 5.1. Ficheiros a criar na Fase 0

- `.gitignore` (ver §5.3)
- `README.md` (ver §5.4 — será atualizado no fim da v2.9.0)

### 5.2. Passo a passo (executado pelo utilizador)

```powershell
# 1. Instalar Git (se ainda não tiver)
# Baixar de https://git-scm.com/download/win

# 2. Configurar identidade
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

# 3. Inicializar repositório local
cd "H:\Inventário DeepSeek\Inventario-florestal"
git init
git add .
git commit -m "chore: import projeto v2.8.2+SC.r2 (estado estável)"

# 4. Criar repositório no GitHub
# - Abrir https://github.com/new
# - Nome: inventario-florestal
# - Privado (recomendado para dados de cliente)
# - NÃO inicializar com README/.gitignore/LICENSE

# 5. Conectar e enviar
git remote add origin https://github.com/SEU_USUARIO/inventario-florestal.git
git branch -M main
git push -u origin main

# 6. Criar branch de desenvolvimento
git checkout -b dev
git push -u origin dev

# 7. Criar branch de feature
git checkout -b feature/planejamento-longo-prazo
git push -u origin feature/planejamento-longo-prazo
```

### 5.3. `.gitignore`

```gitignore
# Dependências (não usadas neste projeto, mas por segurança)
node_modules/
package-lock.json

# Dados sensíveis de clientes (NUNCA comitar)
*.xlsx
*.xls
*.csv
!INVENTARIO-TESTE-MOBRAS-9ANOS-67HA.xlsx

# Sistema operacional
.DS_Store
Thumbs.db
desktop.ini

# Editores
.vscode/
.idea/
*.swp
*.swo

# Logs e temporários
*.log
*.tmp
*.bak
*~

# Ficheiros de build (não há build, mas por segurança)
dist/
build/
```

### 5.4. `README.md` inicial

O `README.md` a criar na Fase 0 é o que já foi proposto na mensagem "Estrutura do Projeto" §4. Depois da v2.9.0, será atualizado com:
- Secção "Planejamento de Longo Prazo (FSC)"
- Indicadores de sustentabilidade
- Instruções de export CSV

### 5.5. Convenção de commits

```
feat:     nova funcionalidade (ex.: painel 3.6)
fix:      correção de bug (ex.: povoCEO → povCEO)
docs:     documentação (README, HANDOFF)
refactor: refatoração sem mudança de comportamento
style:    formatação, CSS
test:     testes (a partir da Fase 3)
chore:    tarefas de manutenção (import, config)
```

---

## 6. Roadmap Consolidado

### Fase 2 (concluída)
- ✅ v2.8.2+SC.r1 — Schöepfer diagnóstico + correções de log/perf
- ✅ v2.8.2+SC.r2 — Prognose (crescimento + mortalidade + SDI)
- ✅ **Fix**: `povoCEO` → `povCEO` na linha 1214 do `main.js`
- ✅ **Golden test** validado com `INVENTARIO-TESTE-MOBRAS-9ANOS-67HA.xlsx`

### Fase 2.5 (próxima)
- ⏳ **Fase 0 — GitHub** (`.gitignore`, `README.md`, git init, branches)
- ⏳ **E1** — `regimes-referencia.js` + `planejamento.js`
- ⏳ **E2** — `ui-planejamento.js`
- ⏳ **E3** — integração + export CSV
- ⏳ v2.9.0 — versão estável, merge `feature/` → `dev` → `main`

### Fase 3 (pós-cubagem)
- ⏳ **Módulo de cubagem rigorosa** (pré-requisito para Schöepfer oficial)
  - Adaptar `parser.js` para `d1m`, `d2m`, `d4m`, `d6m`
  - Criar `ajuste-schoeffer.js` para ajuste local
  - UI para upload/validação
- ⏳ **Schöepfer como motor principal** (só após cubagem validada)
- ⏳ Otimização económica (LEV / Rotação ótima)
- ⏳ Testes automatizados (Vitest) com golden test

### Fase 4 (extras)
- ⏳ Export PDF do dossiê FSC completo
- ⏳ Módulo de desrama (qualidade de madeira)
- ⏳ Integração com mapas SIG (shapefile de talhões)

---

## 7. Caso de Teste de Referência (Golden)

**Ficheiro:** `INVENTARIO-TESTE-MOBRAS-9ANOS-67HA.xlsx`  
**Espécie:** Pinus  
**Árvores:** 2502  
**Alturas medidas:** 119  
**Idade:** 9 anos  
**Área:** 67 ha  
**hDom:** 11.62 m  
**IS local:** 15.37 m  
**Modelo vencedor:** #1 Berkhout (R²aj=0.7337, Syx%=9.03)  
**Volume físico (Realista):** 219 574 m³  
**Receita (Realista):** R$ 33 944,99  
**Alvos por idade (banda 7–9):** `[0, 0, 20, 70, 10]`  
**Calibração:** `0.850 / 1.059 / 0.973 / 0.961 / 1.000`  
**Diagnóstico SC:** 2502/2502 árvores com perfil válido

**Comportamento esperado após qualquer release:**
- Volume físico: 219 000–220 500 m³ (tolerância 1%)
- Vencedor: #1 Berkhout (soma de ranks = 8)
- Sem erros no console do browser
- Painel 9 (CEO) renderiza sem falhas

---

## 8. Diretrizes de Desenvolvimento

1. **Não alterar o motor oficial** (Power Taper + calibração) sem revisão explícita.
2. **Schöepfer é diagnóstico** até o módulo de cubagem estar pronto.
3. **Prognose e desbaste são mutuamente exclusivos** na v2.8.2 — a v2.9.0 vai unificá-los.
4. **Toda nova funcionalidade deve ter:**
   - Log claro (auditoria)
   - Aviso no painel (banners coloridos: 🔵 projeção, 🟠 simulação, 🟡 atenção, 🔴 erro)
   - Botão "Reverter" sempre que houver estado aplicado
5. **Testes manuais obrigatórios** antes de marcar como pronto:
   - Carregar golden test e verificar log/valores
   - Testar todos os cenários de conflito entre painéis
   - Verificar performance (< 2s por simulação em 2500 árvores)
6. **Commits descritivos** seguindo a convenção do §5.5.

---

## 9. Contacto e Contexto

- **Domínio:** inventário florestal comercial (*Pinus taeda* / *Eucalyptus*).
- **Região principal:** Sul do Brasil (SC, PR, RS).
- **Referências bibliográficas:**
  - Santos et al. (2019) — Schöepfer-SC
  - Kohler et al. (2014, 2015) — Sortimentos por idade
  - Embrapa (2012) — Risco vespa-da-madeira e manejo
  - Padoin (2007) — Densidade potencial
  - Heberle (2024) — Estagnação DAP
  - Mainardi (1996) — Área basal
  - Elesbão & Schneider (2011) — Desbaste
  - FSC P&C v5-2 — Princípios e Critérios
- **Motor oficial:** Power Taper Calibrado + calibração comercial.

---

## 10. Próximos Passos Imediatos

1. **Fase 0** — Criar `.gitignore`, `README.md`, inicializar Git, criar repositório GitHub, criar branches
2. **E1** — Implementar `regimes-referencia.js` + `planejamento.js`
3. **E2** — Implementar `ui-planejamento.js`
4. **E3** — Integração final (index.html + main.js + style.css) + export CSV
5. **Validar** com golden test + teste manual do painel 3.6
6. **Merge** `feature/planejamento-longo-prazo` → `dev` → `main`
7. **Tag** `v2.9.0`

---

**Fim do handoff.**