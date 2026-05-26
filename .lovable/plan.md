# Mover "Face de impressão" para antes do papel

Hoje no Certificado e no Cartão a ordem é: **cabeçalho do papel → Quantidade → Face**. O padrão correto (já aplicado em PrintForm/BookletForm/CustomCover) é **escolher a face antes**, para o papel já refletir a face escolhida.

## Mudanças

### 1) `CertificateForm.tsx`
Reordenar os blocos do `return` para:
1. Aviso "Nenhum item Couchê 210g cadastrado" (quando aplicável) — permanece no topo
2. **Face de impressão** (chips compactos) ← sobe
3. Cabeçalho do papel (`primaryItem` card com nome, tier, seletor color/PB)
4. Quantidade
5. Preço por folha / Preço por certificado
6. Acabamentos (fixos + opcionais)
7. Barra inferior fixa com total + botão Adicionar

Nenhuma mudança de lógica, estado, pricing ou imports — apenas reorganização da ordem dos blocos JSX.

### 2) `BusinessCardForm.tsx`
Mesma ideia: mover o `<Field label="Face de impressão">` (chips compactos) para **antes** do card que mostra o papel auto-detectado (Couchê 300g SRA3). A `Quantidade` continua logo após a face, e o card do papel aparece em seguida.

Nenhuma mudança em layout da folha, poses, pricing ou cálculo.

## Fora de escopo
- Não mexer em PrintForm/BookletForm/CustomCover (já estão nessa ordem).
- Não alterar lógica de seleção automática de papel, pricing, nem schema.
