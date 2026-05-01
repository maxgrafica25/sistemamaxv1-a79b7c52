## Diagnóstico dos 3 problemas relatados

### 1. "Cabe 40 mas o sistema mostra outro valor"
Com o perfil **Teneth A3** (default), as margens reais são `top=7, bottom=80 (tração dos roletes), left/right=7`. Para SRA3 (320×450) e etiqueta 50×50 com gap 1mm:
- usableW = 320 − 14 = 306 → **6 colunas**
- usableH = 450 − 87 = 363 → **7 linhas**
- Total = **42 etiquetas** (próximo dos 40 que o cliente espera, dentro da margem de segurança)

O cálculo está **matematicamente correto**. Para chegar a 40+, basta confirmar que o usuário esteja com o perfil Teneth ativo. Vou adicionar um pequeno **badge visual** no Card de Aproveitamento mostrando o perfil de hardware ativo (`Teneth A3 · 7/80/7/7mm`) para deixar evidente *por que* o número é o que é, evitando confusão com expectativas baseadas em outras impressoras.

### 2. Input que vira "0" e atrapalha ao digitar
Causa raiz no `NumInput` (`LabelLayoutCalculator.tsx`): quando o usuário apaga o conteúdo para digitar um novo valor, `parseFloat("")` retorna `NaN`, e o componente **força 0** imediatamente. Isso faz com que apareça um "0" antes do número que está sendo digitado (ex: "050").

**Correção**: usar estado de string interna (controlled) que aceita string vazia e só propaga número quando válido; tratar `min={undefined}` para não restringir digitação intermediária; manter `type="number"` mas permitir foco com campo vazio. Aplicar para todos os usos (largura, altura, lado/diâmetro, quantidade).

### 3. Cadastrar acabamento "Recorte eletrônico R$ 5,00 / SRA3" e validar WhatsApp
- Hoje só existem 2 itens com `price_per_sheet = 0` (vazios). Vou **inserir** um item novo: `name="Recorte eletrônico", category="recorte", size="SRA3", price_per_sheet=5.00`.
- Validar WhatsApp: o texto montado em `whatsapp.ts` está OK (Pedido + Total + Sugestão). Vou adicionar **2 linhas**: composição (`🖨️ Impressão: ...` + `✂️ Acabamento: ...`) e a quantidade de folhas, para que o cliente entenda o que está pagando.

---

## Mudanças

### Frontend

**`src/components/labels/LabelLayoutCalculator.tsx`**
- Reescrever `NumInput` com estado interno de string (`useState<string>`), commit no `onBlur` ou quando parser retorna número válido. Sem mais "0" fantasma.
- Adicionar badge `Hardware: Teneth A3 (7/80/7/7mm)` no Card de Aproveitamento, com tooltip explicando os 80mm de tração.

**`src/lib/labels/whatsapp.ts`**
- Incluir linhas de composição da folha:
  ```
  🖨️ Impressão: Adesivo Brilho · 210g · SRA3 · F · color (R$ X,XX/folha)
  ✂️ Acabamento: Recorte eletrônico (R$ 5,00/folha)
  📄 Folhas: N
  ```
- Assinatura por extenso da config.

**Parâmetros de entrada do `formatWhatsAppQuote`** ganham `printingLabel?` e `finishingLabel?` opcionais (retro-compatível). Atualizar a chamada no `LabelLayoutCalculator`.

### Banco

Inserir 1 linha em `finishings_price_items`:
```sql
INSERT INTO finishings_price_items
  (name, category, size, price_per_sheet, sort_order, is_active)
VALUES
  ('Recorte eletrônico', 'recorte', 'SRA3', 5.00, 10, true);
```

### Validação visual (QA)
- Após aplicar, abrir `/calculadora-etiquetas`, digitar etiqueta 50×50 → confirmar **42** etiquetas, perfil Teneth visível.
- Selecionar acabamento "Recorte eletrônico R$ 5,00".
- Clicar "Copiar WhatsApp" e colar em texto → confirmar que aparece composição completa.
- Apagar campo "Lado" e digitar "75" → não pode aparecer "0" no meio.

## Arquivos
- `src/components/labels/LabelLayoutCalculator.tsx` (NumInput + badge + repassar labels)
- `src/lib/labels/whatsapp.ts` (composição + assinatura)
- Nova migration ou INSERT direto em `finishings_price_items`

## Fora de escopo
- Mexer no algoritmo de layout (já está correto: 42 = limite físico real do Teneth com SRA3 + 50mm).
- Alterar margens default do Teneth (são especificação do equipamento).
