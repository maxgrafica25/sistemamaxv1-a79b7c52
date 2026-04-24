# Melhorar acessibilidade do botão da Júlia no mobile

## Problema
O botão flutuante da Júlia (canto inferior direito) às vezes não é clicável no celular, especialmente quando:
- A barra de navegação do navegador móvel (Chrome/Safari) cobre o botão
- Modais, Sheets ou Toasts aparecem com z-index maior
- O touch target é muito pequeno para dedos

## Solução
Ajustar o componente `AssistenteButton.tsx` com:

1. **Posicionamento responsivo**:
   - Mobile: `bottom-20 right-4` (mais acima, longe da barra do navegador)
   - Desktop: `sm:bottom-6 sm:right-6` (posição original)

2. **Z-index maior**: `z-[60]` para ficar acima de modais/sheets (que usam z-50)

3. **Touch target maior**: `h-14 w-14` no mobile (mínimo 44px recomendado), `sm:h-[52px] sm:w-[52px]` no desktop

4. **Remover delay de touch**: `[touch-action:manipulation]` para eliminar o delay de 300ms em dispositivos móveis

## Arquivo a modificar
- `src/components/assistente/AssistenteButton.tsx` (linhas 111-132 aproximadamente)

## Resultado esperado
- Botão sempre visível e clicável no celular
- Não fica escondido atrás da barra do navegador
- Funciona normalmente no desktop
- Responde imediatamente ao toque (sem delay)