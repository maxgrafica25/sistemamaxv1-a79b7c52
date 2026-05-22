
## Objetivo

Hoje os formulários de orçamento têm ordens de campo diferentes — e isso fica visível quando o usuário alterna entre **Produtos** e **Personalizado** (ou entre presets que roteiam para sub-formulários diferentes em Impressão). A meta é fazer com que a única coisa que mude entre os dois modos seja a presença dos chips de preset.

## Inconsistências hoje

| Form | Ordem atual |
|------|-------------|
| `CVForm` | Descrição → Mídia → Resolução → L×A×Qtd → Tiers → Acabamentos → Total/CTA |
| `PrintForm` | Catálogo → (Banner) → Qtd+Preço → **Descrição (no fim)** → Acabamentos → Total/CTA |
| `BookletForm` | Catálogo → Folhas/Qtd → F/V → Kits → Tiers → **Descrição (no fim)** → CTA |
| `LabelEmbeddedForm` | **Toggle Produtos/Personalizado duplicado** → Dim → Qtd → Papel → Acabamento → Resumo → **Descrição (no fim)** → CTA |

Além disso, `LabelEmbeddedForm` repete o toggle Produtos/Personalizado que já existe no pai (`PrintAndProductForm`), causando dois toggles na tela quando o preset é Etiqueta.

## Ordem padrão a aplicar

```text
1. (Chips de preset)               — só em modo Produtos, renderizado pelo pai
2. Descrição                       — sempre no topo, com auto-geração / botão "Regenerar"
3. Catálogo / Mídia (+ header)     — busca + chip resumo do item escolhido
4. Dimensões / Quantidade          — grid (largura, altura, qtd; ou folhas/apostilas)
5. Opções específicas              — É banner?, F/V, papel/acabamento de etiqueta
6. Acabamentos                     — chips
7. Tiers / Kits                    — painéis opcionais
8. Resumo                          — área total / folhas físicas / aproveitamento + Total
9. CTA                             — botão "Adicionar ao orçamento"
```

A descrição passa a ficar **sempre no topo** (como já é em CV), com placeholder/regenerador quando não preenchida. Isso garante a mesma "altura visual" das seções entre Personalizado e Produtos, e entre os módulos CV ↔ Impressão.

## Mudanças por arquivo

### `src/components/orcamentos-v3/forms/PrintForm.tsx`
- Mover bloco **Descrição (opcional)** para o topo do `return`, logo após `<Field label="Item do catálogo">` + header do catálogo.
- Manter o resto (banner → qtd/preço → acabamentos → total/CTA) na mesma ordem.

### `src/components/orcamentos-v3/forms/BookletForm.tsx`
- Mover bloco **Descrição (opcional)** para o topo, logo após o header do catálogo selecionado.
- Manter Folhas/Apostilas → F/V → resumo de folhas físicas → Kits → Tiers → CTA.

### `src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx`
- **Remover o toggle interno `Produtos/Personalizado`** (e o estado `mode`) — o toggle do pai já cumpre esse papel; manter apenas os chips de presets quando recebidos.
- Mover bloco **Descrição (opcional)** para o topo, logo após os chips/header "Modo Etiqueta".
- Manter Dim → Qtd → Papel → Acabamento → Resumo → CTA.

### `src/components/orcamentos-v3/forms/CVForm.tsx`
- Já segue o padrão. Pequenos ajustes para consistência visual:
  - Garantir que o bloco "Área total" fique logo acima de "Acabamentos" (já está).
  - Sem alterações funcionais.

### `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`
- Sem alterações estruturais; a faixa de **sugestão de produto** continua aparecendo só em Personalizado, posicionada acima do sub-formulário (não conta como "campo", é uma dica).

## Fora de escopo

- Engine de cálculo, regras de bastão, geração de descrição automática, kits e tiers — nenhuma lógica de negócio é alterada.
- Estilos globais e tokens do design system permanecem iguais.
- Nenhum schema de banco é tocado.

## Validação

- Abrir CV em Personalizado e em Produtos → confirmar que apenas a faixa de chips muda.
- Abrir Impressão em Personalizado e alternar entre presets Folheto, Apostila e Etiqueta → confirmar que Descrição/Catálogo/Quantidade/Acabamentos aparecem na mesma posição vertical, e que só existe um toggle Produtos/Personalizado na tela.
