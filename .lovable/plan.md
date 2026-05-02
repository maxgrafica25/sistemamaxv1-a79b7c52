## Objetivo

Adicionar um botão **"Restaurar padrões de fábrica"** no diálogo de configurações da Calculadora de Etiquetas, que devolve TODA a configuração ao estado inicial atualmente definido como `DEFAULT_CONFIG` (incluindo seeds de favoritos).

## O que será o "padrão de fábrica"

O snapshot de hoje, já presente em `src/lib/labels/config-storage.ts`:

- **Folha:** SRA3 (320×450 mm)
- **Hardware:** SignMaster paramétrico, margens travadas
- **Corte:** plotter redondo
- **Margens:** 7/7/7/7 mm, gap 3 mm
- **Preço/folha:** 0
- **Unidade:** mm
- **Folhas personalizadas:** vazio (todas removidas)
- **Favoritos de etiqueta:** os 3 seeds (Lacre 40×40, Validade 20×20, Redonda Ø50)

> Observação: o reset zera as folhas personalizadas e devolve os 3 favoritos seed. Vou avisar isso no diálogo de confirmação.

## Mudanças

### 1. `src/lib/labels/config-storage.ts`
- Exportar `resetConfigToDefaults(): LabelCalcConfig` que escreve `DEFAULT_CONFIG` (cópia profunda dos arrays) no localStorage e retorna.

### 2. `src/components/labels/LabelCalcSettingsDialog.tsx`
- Adicionar botão **"Restaurar padrões de fábrica"** no rodapé do diálogo (à esquerda, separado dos botões Salvar/Cancelar), com ícone `RotateCcw` e variante `outline` discreta.
- Ao clicar, abrir um `AlertDialog` de confirmação avisando que:
  - margens, folha, corte, hardware, preço e unidade voltam aos padrões;
  - **folhas personalizadas serão apagadas**;
  - **favoritos de etiqueta voltam aos 3 originais** (favoritos criados pelo usuário serão perdidos).
- Confirmando: chamar `resetConfigToDefaults()`, atualizar `draft`, mostrar toast `"Configurações restauradas aos padrões de fábrica"` e chamar `onSaved?.(cfg)` para o componente pai re-renderizar com os novos valores.

Nenhuma mudança no backend. Tudo roda no localStorage.
