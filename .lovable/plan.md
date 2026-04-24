## Adicionar tooltip no campo "Preço" do dialog de Consumível

Incluir um ícone `?` discreto ao lado do label **"Preço (R$)"** no dialog "Editar Consumível" (mesmo padrão visual já usado no campo "Rendimento" e na coluna "% Custo").

### Texto do tooltip
> Valor de compra do consumível. **Para Depreciação:** informe o valor pago na impressora menos o valor residual estimado de revenda (ex: pagou R$ 30.000, espera vender por R$ 5.000 → cadastre R$ 25.000). No campo Rendimento, informe o total de páginas previstas na vida útil.

### Arquivo a editar
- `src/pages/Equipamentos.tsx` — envolver o `Label` "Preço (R$)" em um wrapper flex com `Tooltip` + `HelpCircle`, idêntico ao já existente para "Rendimento".

### Característica
Zero impacto visual quando o usuário não interage. Informação aparece apenas ao passar o mouse no ícone.

**Aprova?**