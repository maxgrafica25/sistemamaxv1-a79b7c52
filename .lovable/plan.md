

# Resolver "1 duplicado(s)" e melhorar o feedback de duplicata

## Diagnóstico

A URL `https://www.ans.com.br/panfleto-90gr/` **já existe** em `sites_monitorados` (id `0dd91da9-8227-443a-ad52-fa903e7508af`, ativa, ANS, "Panfletos 10x14cm (A6) - Couchê 90g - 4x4 cor"). A guarda anti-duplicata em `NovoSiteDialog.handleSave` filtra por `url_completa` exato e descarta — daí o toast "1 duplicado(s)" e nada criado.

Hoje o usuário não tem como saber **qual** site é o duplicado nem o que fazer (atualizar? excluir o antigo? ignorar?).

## Solução (2 partes)

### Parte 1 — Excluir o duplicado pendente da extração anterior

Remover **somente** a linha duplicada que está bloqueando o cadastro agora:

```sql
DELETE FROM sites_monitorados WHERE id = '0dd91da9-8227-443a-ad52-fa903e7508af';
```

Cascata: `site_precos_tiers`, `historico_precos`, `historico_precos_tiers` e `alertas_precos` referenciando esse `site_id` somem junto via FK ON DELETE CASCADE (já configurado nas migrations existentes).

A outra linha (`b4c202c7...`, URL `panfleto-90gr-4x0-10x14cm`, "4x0 cor") **permanece** — é um site diferente, já consolidado, não é duplicata da URL atual.

Após isso o usuário recadastra normalmente clicando em "Salvar" no diálogo aberto.

### Parte 2 — Melhorar o aviso de duplicata em `NovoSiteDialog.tsx`

Mudanças no fluxo de `handleSave` para nunca mais deixar o usuário sem saber o que aconteceu:

1. **Antes de iterar para inserir**, fazer um `select` único listando todos os duplicados com nome do produto e fornecedor:
   ```ts
   const { data: existentes } = await supabase
     .from("sites_monitorados")
     .select("url_completa, nome_produto, fornecedor_nome")
     .in("url_completa", validResults.map(r => r.source_url));
   ```

2. **Se houver duplicados**, mostrar um diálogo de confirmação (`AlertDialog` shadcn, não toast) listando:
   - URLs duplicadas
   - Para cada uma: nome do produto e fornecedor já cadastrados
   - Duas opções: **"Ignorar duplicadas e salvar o resto"** (comportamento atual) ou **"Cancelar"**.
   
   Se 100% das URLs forem duplicadas, só "Cancelar" + um botão **"Ir para Gerenciar sites"** que fecha o diálogo e troca a aba ativa via callback ao parent (`onOpenChange(false)` + um novo prop `onNavigateToManagement?: () => void`).

3. **Toast final** detalhado e persistente até clicar (sem auto-dismiss em 2.5s para esse caso): em vez de `"1 duplicado(s)"`, algo como `"0 criado(s) · 1 já cadastrado(s) — veja em Gerenciar sites"`.

## Arquivos afetados

- `src/components/monitoramento/NovoSiteDialog.tsx` — pré-checagem em lote, AlertDialog de confirmação, toast detalhado, novo prop opcional `onNavigateToManagement`.
- `src/pages/Monitoramento.tsx` — passar `onNavigateToManagement={() => setActiveTab("gerenciar")}` ao `NovoSiteDialog`.
- **Migration** com o `DELETE` da Parte 1 (1 linha).

## Fora de escopo

- Lógica de scraping, schema, RLS, triggers — intactos.
- Comportamento de `findOrCreateCatalogo` — intacto.
- Demais URLs/sites do banco.

## Risco

Baixo. O `DELETE` é cirúrgico (id específico, confirmado por SELECT). A mudança no `handleSave` mantém o caminho atual quando o usuário escolhe "ignorar duplicadas"; apenas adiciona um passo de confirmação antes.

