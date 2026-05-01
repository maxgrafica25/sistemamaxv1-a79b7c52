## Mudança

Reescrever o texto da "Dica de aproveitamento" em `src/components/labels/LabelLayoutCalculator.tsx` (linhas 867–882) para:

1. Ficar mais claro (objeto da mensagem anterior)
2. Remover o "+" antes dos números (objeto desta mensagem)

### Texto novo

> "Se diminuir a etiqueta para **48mm** (−2mm em cada lado), cabem **8 etiquetas a mais por folha** (de 40 para **48**).
>
> Usando as mesmas 3 folhas (mesmo custo de produção), o cliente leva **24 etiquetas a mais**."

### Regras de formatação

- Quando `newLabelW === newLabelH`: exibir só "**48mm**" (sem "48×48mm" redundante).
- Texto da redução em português, sem "(−2mm × −0mm)":
  - encolheu igual nos dois lados → "−2mm em cada lado"
  - só largura → "−2mm de largura"
  - só altura → "−2mm de altura"
  - valores diferentes → "−2mm de largura e −1mm de altura"
- Ganho exibido como "**N etiquetas a mais**" (sem o "+").
- Mostrar também o absoluto "(de X para Y)" pra ficar tangível.
- Quebra em 2 parágrafos: ganho/folha e ganho com mesmas folhas.

## Arquivo

- `src/components/labels/LabelLayoutCalculator.tsx` — bloco do parágrafo da dica (867–882)

Aprova?