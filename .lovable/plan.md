## Objetivo

Unificar tudo no novo sistema (`cv_calc_midias`, `cv_calc_impressoes`, `cv_calc_acabamentos`, `cv_calc_config`):
- As 3 abas de CRUD em `/cadastros-cv` passam a editar as tabelas novas.
- O Orçamentos V2 (`CVItemCard`) passa a usar o novo motor de cálculo da Planilha 2026.
- Tabelas antigas (`cv_materials`, `cv_printers`, `cv_finishes`) são aposentadas.

## O que muda no banco

- **Migração:** copiar dados úteis de `cv_materials → cv_calc_midias`, `cv_printers → cv_calc_impressoes`, `cv_finishes → cv_calc_acabamentos`. Como o modelo de margem é diferente (`margem_pct` vs `custo+lucro` separados), converto preservando o **preço final** (define `custo_mt2 = custo_original`, `lucro_mt2 = custo_original × margem_pct/100`).
- **Renomear tabelas antigas** para `_legacy_` (não deletar ainda, segurança).
- `cv_quote_items` continua existindo (snapshot dos cálculos já vendidos). Adicionar 3 colunas opcionais: `acabamento_id`, `acabamento_nome`, `perimetro_m` para o novo formato.
- Validação: unique `(nome, tipo_midia)` em `cv_calc_midias` para evitar duplicatas.

## O que muda no código

### `src/pages/CadastrosCV.tsx` (refactor in-place)
Abas continuam: **Calculadora**, **Mídias**, **Impressões**, **Acabamentos**, + nova **Configuração** (valor mínimo).
- **Mídias**: form com `nome`, `tipo_midia` (lona/adesivo/chapa/outro), `custo_mt2`, `lucro_mt2`, `custo_fixo`, `lucro_fixo`, `ativo`.
- **Impressões**: + `largura_max_cm`, `comprimento_max_cm`, `tipos_midia_compativeis` (checkboxes).
- **Acabamentos**: + `familia` (banner_bastao, faixa, bainha_ilhos, …), `largura_max_cm`, e os 4 pares custo/lucro (`fixo`, `mt2`, `perimetro`, `unidade`).
- **Configuração**: campo único de `valor_minimo` (singleton).
- Admin-only para criar/editar/excluir (RLS já garante).

### `src/lib/cv-calc/engine.ts` (extensão)
Hoje aceita **1 acabamento**. Estender para `acabamentos: Acabamento[]` (array) somando os preços de cada um. Auto-seleção de bastão continua aplicada apenas ao item da família `banner_bastao`. Mantém retro-compatibilidade.

### `src/components/orcamentos-v2/CVItemCard.tsx` (refactor)
Trocar import `cv-pricing/engine` → `cv-calc/engine`. Renomear props: `materiais → midias`, `impressoras → impressoes`, `acabamentos` continua (mas tipo novo). Filtro de compatibilidade passa a usar `tipo_midia` e `tipos_midia_compativeis`. Suporte a **acabamentos avulsos** preservado (acabamento sintético `familia: "outro"` com `custo_fixo` = valor informado).

### `src/components/orcamentos-v2/NewQuoteFormV2.tsx`
Trocar queries `from("cv_materials")` etc. para as 3 tabelas novas + carregar `cv_calc_config.valor_minimo`. Persistir em `cv_quote_items` (sem mudança de chamada, só novos campos).

### `src/pages/orcamentos-v2/ClientViewer.tsx`
Apenas lê `cv_quote_items` — nenhuma mudança lógica.

### `src/test/cv-calc.test.ts`
Adicionar testes para múltiplos acabamentos somados + avulsos.

### `src/lib/cv-pricing/engine.ts`
Marcar como `@deprecated` no JSDoc; remover só depois que tudo estiver migrado e em produção.

## Memória do projeto
Adicionar memória `mem://features/cv-calculadora` documentando: tabelas `cv_calc_*` são a fonte única; sistema antigo `cv_*` está deprecated.

## O que NÃO está no escopo
- Deletar fisicamente as tabelas antigas (faremos numa segunda rodada após validação em produção).
- Mudar layout/UX do `CVItemCard` — só adapto às novas tabelas mantendo a interface atual de múltiplos acabamentos e avulsos.
