## Diagnóstico

A "Dica de aproveitamento" só aparece quando existe matematicamente um tamanho menor que faz caber **mais** etiquetas por folha. Hoje testamos só reduções de **−1, −2, −3 mm**, e em alguns formatos (especialmente 60, 70, 85, 95, 100 mm em SRA3) essa janela é pequena demais — o próximo "salto" de coluna/linha está além de −3 mm, então nada aparece.

Confirmei no terminal mapeando todos os tamanhos quadrados de 20 a 100 mm em SRA3:

```
50mm → sugestão 48mm  (+6)   ✓ já aparece
55mm → sugestão 51mm  (+13)  ✗ −4mm, não testamos
60mm → impossível mesmo com −5  (sem dica é correto)
65mm → sugestão 61mm  (+11)  ✗ −4mm, não testamos
75mm → sugestão 72mm  (+4)   ✓
80mm → sugestão 76mm  (+5)   ✗ −4mm, não testamos
85mm → impossível mesmo com −5  (sem dica é correto)
90mm → sugestão 87mm  (+3)   ✓
95mm → impossível mesmo com −5
```

Conclusão: o range pequeno está deixando passar várias oportunidades reais. Ampliar para **−1 até −5 mm** cobre os casos importantes (55, 65, 80 etc.). Quando geometricamente não há ganho mesmo até −5 mm, a dica fica oculta de propósito (correto — não inventar sugestão sem ganho).

## Mudanças

### `src/lib/labels/layout.ts` — ampliar candidatos em `findShrinkOpportunity`

Estender a lista de reduções de `[1, 2, 3]` para `[1, 2, 3, 4, 5]` mantendo a regra de "se quadrada, só simétricas":

```ts
const reductions = [1, 2, 3, 4, 5];
const candidates = isSquare
  ? reductions.map(d => ({ dw: d, dh: d }))
  : reductions.flatMap(d => [{dw:d,dh:0},{dw:0,dh:d},{dw:d,dh:d}]);
```

### `src/lib/labels/signmaster-spec.ts` — mesmo range para o paramétrico

Em `findSignmasterShrinkOpportunity`, ampliar candidatos de `[0.5, 1, 1.5, 2, 2.5, 3]` para `[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]`. Mantém passos de 0,5 mm para granularidade fina das etiquetas redondas.

### Texto do aviso

Quando a dica não aparece (matematicamente impossível mesmo com −5 mm), nada muda — continua oculta. **Não vou** adicionar mensagem "Sem sugestão disponível" porque o usuário já tem o card de aproveitamento principal mostrando o número atual; um aviso vazio só polui.

## Arquivos editados

- `src/lib/labels/layout.ts` — ampliar candidatos
- `src/lib/labels/signmaster-spec.ts` — ampliar candidatos

### Validação

Adicionar um teste em `src/test/labels-layout.test.ts` para 55×55 mm em SRA3 (margens 7/7/7/7, sem gap) — deve agora retornar sugestão com `delta > 0`.

Aprova?