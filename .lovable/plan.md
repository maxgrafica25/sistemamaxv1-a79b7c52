## Causa da diferença de R$ 4

A planilha **acrescenta sangria a cada dimensão da peça antes de calcular a área**. A sangria é configurada na aba `CONFIGURACOES` por **tipo de mídia**:

- Sangria Adesivo: **3 mm** (0,3 cm)
- Sangria Lona: 0
- Sangria Chapa: 0

Fórmula da planilha (célula AK15):
```
Área = qtd × (largura_cm + sangria_cm) × (altura_cm + sangria_cm) / 10.000
```

Validação com seu teste (6×6, qty 100, Adesivo Brilho):
- (6 + 0,3) × (6 + 0,3) × 100 = **0,3969 m²** → planilha mostra 0,40 m²
- Calculadora atual usa 6 × 6 × 100 = 0,36 m² → daí os R$ 4 a menos

## O que vou fazer

### 1. Configuração global de sangria por tipo de mídia
Já existe a aba **Configuração** no módulo Comunicação Visual e a tabela `cv_calc_config` (campo `valor_minimo`). Vou adicionar três novos campos:

- `sangria_adesivo_mm` (default 3)
- `sangria_lona_mm` (default 0)
- `sangria_chapa_mm` (default 0)
- `sangria_outro_mm` (default 0)

Migration adiciona as colunas com defaults. UI da aba **Configuração** ganha um bloco "Sangrias (mm)" com 4 inputs numéricos.

### 2. Engine — aplicar sangria na área e no perímetro
Em `src/lib/cv-calc/engine.ts`, a função `calcular()` passa a receber `sangrias_mm` (objeto por tipo). Lógica:

```text
sangria_cm = (sangrias_mm[midia.tipo_midia] ?? 0) / 10
largura_efetiva = largura_cm + sangria_cm
altura_efetiva = altura_cm + sangria_cm
area_un = (largura_efetiva × altura_efetiva) / 10.000
perim_un_m = 2 × (largura_efetiva + altura_efetiva) / 100
```

O resto do motor (job único, mínimo, arredondamento) permanece igual.

### 3. UI da Calculadora
- `CalculadoraTab` carrega `cv_calc_config` (já carrega), passa as sangrias pro engine.
- Mostra no painel **Resultado** uma linha discreta `Sangria aplicada: 3 mm (Adesivo)` quando > 0, pra ficar transparente.

### 4. Testes
- Atualizar `src/test/cv-calc.test.ts` com um caso novo: 6×6, qty 100, Adesivo, sangria 3 mm → área 0,3969 m².
- Manter testes anteriores passando setando sangria = 0 nos fixtures (que é o default antigo).

## Arquivos afetados

- **Migration**: adicionar 4 colunas em `cv_calc_config`
- `src/lib/cv-calc/engine.ts` — receber e aplicar sangrias
- `src/components/cv-calc/CalculadoraTab.tsx` — passar sangrias ao engine + linha informativa
- `src/components/cv-calc/ConfiguracaoTab.tsx` — bloco "Sangrias (mm)"
- `src/test/cv-calc.test.ts` — novo caso e ajuste dos existentes

## Resultado esperado (seu cenário)
6×6, qty 100, Adesivo Brilho, Impressão Solvente Alta, Recorte + Cartelas → **R$ 84** (bate com a planilha).
