## Mudanças

### 1. Renomear label (visual, em todos os orçamentos)
Trocar o título `Face de impressão` → `Lados de Impressão` em:
- `src/components/orcamentos-v3/forms/BusinessCardForm.tsx` (linha 327)
- `src/components/orcamentos-v3/forms/CertificateForm.tsx` (linha 393)

(Estes são os únicos dois formulários do V3 que exibem esse título — os demais módulos não têm seletor de face.)

### 2. Certificado — apenas "Só Frente" e "Frente x Verso"

Em `CertificateForm.tsx`:

- Reduzir `FaceKey` para `"frente" | "fv"` (remover `mix` e `fv_pb`).
- `faceOptions` passa a ter apenas 2 chips: **Só Frente** e **Frente x Verso** (grid `grid-cols-2`).
- Remover toda a lógica relacionada a PB: `pbItems`, `pbBase`, `hasPb`, `selectedPbId`, `pricingMixPb`, o seletor de PB no header, a linha "+ verso PB" e o `useEffect` de fallback para PB.
- `faceLabelMap` fica `{ frente: "Só Frente", fv: "Frente x Verso" }`.
- `defaultDesc` passa a usar esses rótulos.

### 3. Filtro de papel por lado (Certificado)

Hoje `colorItems` inclui todos os itens Couchê 210g A4 color (qualquer `side`) e usa `withSide(...)` para forçar o lado escolhido. Novo comportamento:

- Quando `face === "frente"`: `colorItems` filtra somente itens com `side` "Frente" (Só Frente), ignorando os F/V.
- Quando `face === "fv"`: `colorItems` filtra somente itens com `side` "F/V".
- Se não houver item cadastrado para o lado escolhido, mostrar o aviso atual ("Nenhum item Couchê 210g A4 cadastrado") com texto adaptado ao lado, e desabilitar o botão Adicionar (já é o comportamento natural quando `primaryItem` é null).
- Remover o uso de `withSide(...)` no Certificado, já que o item escolhido já é do lado correto. Remover também o badge "F/V calculado (2×)".

### Fora do escopo
- Nenhuma mudança em backend, RPC, RLS, tipos do Supabase, pricing engine ou `BusinessCardForm` além do rename do label.
- O termo "side" interno (`Frente` / `F/V`) usado em payloads e no engine continua igual — somente o rótulo visível muda.
