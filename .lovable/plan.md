## Ajustes nos presets de Impressão + Acabamentos

### 1) Cartão de Visita & Certificado — F/V deve refletir no card do papel

Hoje, quando você troca para **F/V**, o card continua mostrando o papel "Frente" (o motor só dobra o custo via multiplicador). Vamos:

- **BusinessCardForm**: o card do papel passa a exibir o lado efetivo (`effectiveItem.side`) — "Couchê 300g — SRA3 · **F/V**" — e, se o catálogo não tiver variante F/V, mostra badge discreta **"F/V calculado (2×)"** explicando que o multiplicador foi aplicado.
- **CertificateForm**: replicar a lógica de auto-pick por face que existe no Cartão de Visita — quando houver variantes Frente e F/V cadastradas para Couchê 210g A4, escolher automaticamente a linha cujo `side` bate com o face escolhido (e cair de volta para o multiplicador quando só existir uma linha). O card mostra o lado efetivo igualmente.

### 2) Folheto / Flyer — quantidade não deve vir preenchida

A quantidade "100" vem de um default fixo do `PrintForm` (`useState(emptyDefaults ? 0 : 100)`).

- Remover o `100` como default geral: o `PrintForm` passa a iniciar **sempre vazio** (placeholder "Ex: 1000"), tanto no Personalizado quanto nos presets que usam `PrintForm` (Folheto, Banner, Adesivo, etc.).
- `BusinessCardForm` e `CertificateForm` mantêm seus próprios defaults atuais (não usam `PrintForm`).

### 3) Apostila — pré-selecionar Sulfite 75g e deixar campos numéricos vazios

Hoje o `BookletForm` ignora os hints do preset e vem com `bookletPages=20` e `bookletUnits=10` fixos, sem pré-selecionar papel.

- Estender `BookletForm` para aceitar as mesmas props que o `PrintForm` já recebe do preset: `defaultPaperHint` (nome + gramatura + side), `preselectedFinishings`, `suggestedPapers`, `emptyDefaults`.
- `PrintAndProductForm` passa para o `BookletForm` os campos do preset (`papel_default_nome`, `papel_default_grammage`, `side_default`, `acabamentos_sugeridos`, `preselect_acabamentos`) — exatamente como já faz no ramo `formTipo === "print"`.
- Quando o preset (Apostila) define Sulfite 75g como `papel_default_nome` + `papel_default_grammage`, o `BookletForm` resolve a primeira linha do catálogo que bate (case/acentos-insensitive) e pré-seleciona como `catalog` inicial.
- `bookletPages` e `bookletUnits` iniciam vazios (`0`) com placeholders explicativos:
  - "Ex: 20 folhas por apostila"
  - "Ex: 10 apostilas"
- Se o preset Apostila tem `preselect_acabamentos = true`, os acabamentos sugeridos já vêm marcados na seção de acabamentos do `BookletForm` (mesma semântica do `PrintForm`).
- **Nota**: o preset Apostila precisa estar configurado no cadastro de Presets (`/orcamentos/presets` ou similar) com `papel_default_nome="sulfite"`, `papel_default_grammage="75g"`, `preselect_acabamentos=true` e os acabamentos sugeridos (ex.: espiral, capa). Se já estiver assim, esta mudança no código basta; se não, te aviso e ajusto o seed depois.

### Arquivos alterados

- `src/components/orcamentos-v3/forms/PrintForm.tsx` — default de quantidade vira sempre vazio.
- `src/components/orcamentos-v3/forms/BusinessCardForm.tsx` — card do papel mostra side efetivo + badge "F/V calculado".
- `src/components/orcamentos-v3/forms/CertificateForm.tsx` — auto-pick por face quando houver variantes F/V no catálogo; card mostra side efetivo.
- `src/components/orcamentos-v3/forms/BookletForm.tsx` — aceita props de preset, pré-seleciona papel, esvazia páginas/quantidade, aplica acabamentos sugeridos.
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` — repassa props do preset para o `BookletForm`.

### Fora de escopo

- Mexer no cadastro/seed dos presets no banco (faço só se o preset Apostila estiver sem os defaults certos — confirmo após implementar).
- Mudanças em outros presets (Banner, Adesivo, Etiqueta) — ficam com a quantidade vazia também por efeito colateral da mudança em `PrintForm`, mas sem outras alterações.
