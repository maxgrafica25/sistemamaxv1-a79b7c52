# Ajuste de UX — Barra "Adicionar ao orçamento" (V3)

## Problema observado
No `/orcamentos-v3/novo` (visível no screenshot do BusinessCardForm):

1. **Sobreposição confusa**: a barra `sticky bottom-0` usa `bg-background/95 backdrop-blur`. Como é semitransparente, ao rolar o conteúdo (ex.: lista de acabamentos "Corte de 100 cartões de visita") aparece **embaixo** da barra, dando sensação de "vazamento" sobre o botão.
2. **Espaço em branco gigante**: o container do workspace tem `pb-24 lg:pb-5` (sobra de mobile aplicada em desktop também) e o `mt-2` da barra empurra o conteúdo, deixando uma área branca grande entre o último controle e a barra/rodapé.

Mesmo padrão se repete em todos os forms V3: `BusinessCardForm`, `BookletForm`, `PrintForm`, `CVForm`, `ThirdPartyForm`, `LaborForm`, `SupplyForm`, `LabelEmbeddedForm`.

## Solução proposta (UI apenas, sem mexer em lógica de cálculo)

### 1. Barra sticky 100% opaca + sombra de separação
Em cada form V3, trocar:
```
bg-background/95 backdrop-blur border-t border-border
```
por:
```
bg-background border-t border-border shadow-[0_-8px_16px_-8px_hsl(var(--background))]
```
(opacidade total + leve "fade" para indicar fim do conteúdo, sem deixar passar texto por baixo).

### 2. Remover o `pb-24` desnecessário no desktop
Em `NewQuoteFormV3.tsx` linha 192, o `pb-24` existe para não esconder conteúdo atrás do `MobileCart` fixo. No desktop o cart é coluna lateral, então o padding extra cria a "faixa branca gigante". Trocar:
```
overflow-y-auto px-4 lg:px-6 py-5 bg-background pb-24 lg:pb-5
```
por:
```
overflow-y-auto px-4 lg:px-6 py-5 bg-background pb-24 lg:pb-0
```
(remove a sobra no desktop — a própria barra sticky já é o rodapé visual).

### 3. Encostar a sticky no fim do scroll (sem `mt-2`)
Trocar `mt-2` por `mt-6` nas barras sticky para dar respiro consistente acima, e garantir que ela use `-mb-5 lg:-mb-0` para encostar exatamente no fim do scroll container (anulando o `py-5` do pai apenas embaixo).

## Arquivos afetados (apenas JSX/classes Tailwind)
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` (1 linha)
- `src/components/orcamentos-v3/forms/BusinessCardForm.tsx`
- `src/components/orcamentos-v3/forms/BookletForm.tsx`
- `src/components/orcamentos-v3/forms/PrintForm.tsx`
- `src/components/orcamentos-v3/forms/CVForm.tsx`
- `src/components/orcamentos-v3/forms/ThirdPartyForm.tsx`
- `src/components/orcamentos-v3/forms/LaborForm.tsx`
- `src/components/orcamentos-v3/forms/SupplyForm.tsx`
- `src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx`

## Fora do escopo
- Nenhuma mudança em lógica de preços, kits, faixas, presets ou estado.
- Nada de refator estrutural do split-screen.
