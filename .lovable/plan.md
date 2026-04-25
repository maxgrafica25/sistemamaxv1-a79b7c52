## Mudanças no `TonerChangeDialog` e botão de ação

Arquivo: `src/components/equipamentos/PrinterReadingsTab.tsx`

### 1. Remover o botão "Outra peça"
Apaga o `<button>` com `setSelectedConsumableId("__other__")` (linhas ~551-563). Restam apenas os chips de toners reais cadastrados.

### 2. Trocar título e ícone do dialog
- De "Troca de Toner/**Peça**" para "Troca de **Toner**" (foco em consumível rotineiro)
- Ícone `Wrench` → `Package` no DialogTitle

### 3. Trocar fallback de "sem consumíveis cadastrados"
Hoje diz "A troca será registrada como genérica" (linhas ~566-570). Vira aviso direcionando para Manutenção:

```text
🔧 Sem toners cadastrados. Para peças de reposição (fusor, cilindro...), 
   use a aba Manutenções.
```

### 4. Adicionar aviso discreto no rodapé do dialog
Logo acima do `DialogFooter`, bloco sutil:

```text
🔧 Para troca de peças ou chamados técnicos (fusor, cilindro, belt...), 
   utilize a aba Manutenções
```

Estilo: `text-xs`, fundo `muted/30`, ícone `Wrench` em azul, discreto — não compete com o conteúdo principal.

### 5. Ajustar botão na barra de ações principal
- Texto: "Troca de Toner/Peça" → "**Troca de Toner**"
- Ícone: `Wrench` → **`Package`** (consistência semântica: `Wrench` fica reservado para a aba Manutenções, evitando hesitação cognitiva do operador)

### 6. Limpeza de lógica
- Remover do `saveToner` o tratamento `data.consumableId === "__other__" ? null : data.consumableId` — agora `consumableId` é sempre um ID real
- `canSubmit` continua exigindo `selectedConsumableId` válido (impede submit quando não há toners cadastrados)

## Mapa final de ícones (consistência semântica)

| Contexto | Ícone | Significado |
|---|---|---|
| Botão "Leitura Rápida" | `Plus` | Adicionar leitura nova |
| Botão "Troca de Toner" (externo) | **`Package`** | Consumível embalado |
| Dialog "Troca de Toner" (título) | **`Package`** | Consumível embalado |
| Aviso de redirecionamento p/ Manutenções | `Wrench` | Manutenção / serviço técnico |
| Aba Manutenções (já existente) | `Wrench` | Manutenção / serviço técnico |

## O que NÃO muda

- Estrutura do banco
- Demais comportamentos do dialog (deltas, pré-preenchimento, foco com `requestAnimationFrame`)
- Aba Manutenção
- Dialog de Leitura Rápida
