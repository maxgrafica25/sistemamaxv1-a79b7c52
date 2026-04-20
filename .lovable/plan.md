

# Indicador de progresso visual durante geração de backup

Hoje, ao clicar em "Gerar backup SQL/JSON" em `Configuracoes.tsx`, o feedback é apenas:
- Spinner pequeno dentro do botão clicado (substitui o ícone).
- Toast `loading` do Sonner no canto da tela.

Pouco visível em telas grandes e fácil de não perceber. Plano: adicionar um **overlay modal bloqueante** durante a geração, deixando claro que algo está acontecendo e impedindo cliques acidentais.

## Mudanças

### `src/pages/Configuracoes.tsx`

1. **Importar** `Dialog`, `DialogContent` de `@/components/ui/dialog` e ícone `Database` de `lucide-react`.

2. **Adicionar estado de tempo decorrido** para dar sensação de progresso (não temos % real porque o stream não envia totais antecipados):
   ```ts
   const [elapsed, setElapsed] = useState(0);
   ```
   Iniciar `setInterval` quando `generating !== null`, parar no `finally`.

3. **Renderizar overlay** logo acima do `</div>` raiz, controlado por `open={generating !== null}`:
   - Dialog não-fechável (sem `onOpenChange` que feche; remover botão X via `[&>button]:hidden` no `DialogContent`).
   - Conteúdo centralizado: ícone `Database` animado (pulse) + `Loader2` girando, título **"Gerando backup, aguarde..."**, subtítulo dinâmico **"Formato: SQL"** ou **"Formato: JSON"**, contador **"Tempo decorrido: Xs"**, e nota pequena **"Não feche esta janela. O download iniciará automaticamente ao concluir."**
   - Largura `sm:max-w-md`.

4. **Manter** spinner no botão e toast atuais (redundância proposital — toast some sozinho após sucesso/erro, overlay confirma o estado em foco).

5. **Acessibilidade**: `DialogContent` já bloqueia foco e adiciona `aria-modal`. Adicionar `aria-live="polite"` no contador de tempo para leitores de tela.

### Sem outras mudanças

- Edge function `backup-database`: inalterada (não há como reportar progresso real do stream sem reescrever a arquitetura; tempo decorrido é suficiente).
- Banco: nenhuma migration.
- Outros arquivos: nenhum.

## Arquivos afetados

| Ação | Arquivo |
|---|---|
| Editar | `src/pages/Configuracoes.tsx` (overlay Dialog + timer + imports) |

## Resultado

- Ao clicar em "Gerar backup SQL/JSON", surge modal centralizado bloqueando interação.
- Modal exibe formato, animação e tempo decorrido em segundos atualizado a cada 1s.
- Modal fecha automaticamente quando o download inicia (sucesso) ou quando o erro é mostrado no toast.
- Usuário em qualquer viewport (incluindo o atual de 394px) percebe claramente que o sistema está trabalhando.

