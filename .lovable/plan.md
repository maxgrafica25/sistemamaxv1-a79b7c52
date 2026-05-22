## Objetivo

Tornar o toggle **Produtos / Personalizado** mais legível como "dois botões clicáveis" sem virar elemento de destaque (os chips de produto devem continuar puxando o olho).

## Diagnóstico

Hoje o toggle usa um segmented control bem discreto: fundo `muted/40`, botão ativo só com `bg-background + shadow-sm`. O inativo é só texto cinza, sem borda nem fundo — por isso não "lê" como botão.

## Proposta (sutil, sem brigar com os chips)

Ajustar apenas `src/components/orcamentos-v3/shared/ModeButton.tsx` e o container em `PrintAndProductForm.tsx` / `CVForm.tsx`:

1. **Container do segmented**
   - Aumentar levemente o contraste do trilho: `bg-muted` (em vez de `muted/40`) e borda mantida.
   - Adicionar um pequeno rótulo discreto antes: `"Modo:"` em `text-xs text-muted-foreground` — ajuda a comunicar que é uma escolha entre opções.

2. **Botão ativo**
   - Manter `bg-background text-foreground shadow-sm`.
   - Adicionar `ring-1 ring-border` para destacar a "pílula" selecionada dentro do trilho.
   - Ícone ganha `text-primary` (cor só no ícone, não no texto, para não competir com os chips roxos).

3. **Botão inativo**
   - Hover mais perceptível: `hover:bg-background/60` além do `hover:text-foreground` atual.
   - Cursor `cursor-pointer` explícito.
   - Adicionar `aria-pressed` para acessibilidade.

4. **Microcópia opcional**
   - Trocar `"Produtos"` por `"Produtos prontos"` e manter `"Personalizado"` — reforça que são modos diferentes. (Confirmar com o usuário se quer essa mudança de label.)

Nada de cor primária no fundo do toggle nem de bordas marcadas — assim ele continua secundário em relação aos chips de presets.

## Arquivos a editar

- `src/components/orcamentos-v3/shared/ModeButton.tsx` — novo styling ativo/inativo + `aria-pressed`.
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` — wrapper do toggle (rótulo "Modo:" + bg).
- `src/components/orcamentos-v3/forms/CVForm.tsx` — mesmo ajuste de wrapper.

## Validação

Abrir `/orcamentos-v3/novo`, conferir que:
- Os dois botões agora têm "peso" visual semelhante quando inativos (hover sugere clique).
- O ativo continua claramente selecionado, mas sem competir com a faixa de chips de produto abaixo.
- Funciona em Impressão e Comunicação Visual.