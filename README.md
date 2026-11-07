\# Inventário Florestal — Sistema de Análise

Sistema web (HTML5 + ES modules, sem build step) para inventário florestal de
*Pinus taeda* e *Eucalyptus* em plantações comerciais brasileiras.

**Versão:** v2.8.2+SC.r2 (estável)

---

## Como executar

Requisitos:
- [Node.js](https://nodejs.org/) v16+
- Um browser moderno (Chrome, Edge, Firefox, Safari)

Passos:

```bash
# 1. Navegar até a pasta do projeto
cd caminho/para/inventario-florestal

# 2. Iniciar servidor local
npx serve .

# 3. Abrir no browser
# http://localhost:3000
```

Não há build step. Não há dependências npm obrigatórias (SheetJS é
carregado via CDN no `index.html`).

---

## Estrutura de painéis

| Painel | Descrição |
|---|---|
| **1** | Entrada de dados (Excel/CSV) + configuração inicial |
| **Log** | Auditoria em tempo real de todos os passos |
| **2** | Equação hipsométrica vencedora + ranking |
| **2.5** | Simulador de desbaste silvicultural |
| **3** | Volume por fator de forma |
| **3.5** | Prognose (projeção de crescimento) |
| **4** | Afilamento (Power Taper + Schöepfer diagnóstico) |
| **5** | Cenários de traçamento (editáveis) |
| **6** | Calibração da classificação comercial |
| **7** | Traçamento + comparação Power Taper vs Schöepfer |
| **8** | Gráficos comparativos + perfil do fuste |
| **9** | Resumo executivo (Painel CEO) |

---

## Formato do ficheiro de entrada

Colunas reconhecidas (nomes normalizados, tolerantes a acentos/maiúsculas):

| Campo | Obrigatório | Exemplos |
|---|---|---|
| Parcela | recomendado | `parcela`, `parc`, `plot` |
| Árvore | recomendado | `arvore`, `arv`, `n arvore` |
| DAP (cm) | **sim** (ou CAP) | `dap`, `diametro`, `diam` |
| CAP (cm) | alternativa | `cap`, `circunferencia` |
| Altura (m) | **sim** | `altura`, `h`, `ht` |
| Área da parcela (m²) | **sim** | `area_parcela`, `area` |
| Qualidade | opcional | `qualidade`, `defeito` (códigos 1–10) |
| Dominância | opcional | `dominancia`, `classe copa` |

O parser aceita decimais com ponto ou vírgula. Quando a coluna `DAP` está
vazia mas existe `CAP`, o sistema calcula `DAP = CAP / π` automaticamente.

---

## Diretrizes técnicas

1. **Motor oficial:** Power Taper Calibrado (não Schöepfer).
2. **Schöepfer** é diagnóstico (painel 7), até haver módulo de cubagem rigorosa.
3. **Sem ingrowth** em plantio comercial — apenas crescimento + mortalidade.
4. **Prognose e desbaste** são mutuamente exclusivos na v2.8.2
   (serão unificados na v2.9.0 — Planejamento de Longo Prazo).

---

## Estado atual e roadmap

- **v2.8.2+SC.r2** (estável) — golden test validado com
  `INVENTARIO-TESTE-MOBRAS-9ANOS-67HA.xlsx`
- **v2.9.0** (em desenvolvimento) — Planejamento de Longo Prazo (FSC)
  - Horizonte 23–25 anos com desbastes manuais + 3 regimes pré-definidos
  - Indicadores de sustentabilidade (VMA, VPL, TIR, SDI máximo)
  - Export CSV para dossiê FSC
- **Fase 3** (futuro) — módulo de cubagem rigorosa (pré-requisito para
  Schöepfer oficial), otimização económica (LEV), testes automatizados

Ver `HANDOFF - Sistema de Inventário Florestal v2.9.0.md` para o plano
detalhado.

---

## Referências bibliográficas

- Santos et al. (2019) — Schöepfer-SC
- Kohler et al. (2014, 2015) — Sortimentos por idade
- Embrapa (2012) — Risco vespa-da-madeira e manejo
- Padoin (2007) — Densidade potencial
- Heberle (2024) — Estagnação DAP
- Mainardi (1996) — Área basal
- Elesbão & Schneider (2011) — Desbaste
- FSC P&C v5-2 — Princípios e Critérios

---

## Licença

A definir (recomendado: MIT se open-source, ou proprietária se comercial).