## Diagnóstico

A alteração existe em `BookletKitPanel.tsx`, mas o comportamento mostrado na imagem indica que a tela ainda está exibindo o botão antigo quando há personalização e não está mostrando a ação de adicionar acabamento no fluxo visível.

## Plano

1. **Ajustar o gatilho do botão principal**
   - Fazer o botão trocar para **“Aplicar acabamentos”** sempre que houver qualquer personalização real no kit, incluindo:
     - capa personalizada selecionada;
     - contracapa personalizada selecionada;
     - algum item padrão desmarcado, como **Furação**;
     - acabamento extra adicionado.

2. **Garantir a opção de adicionar acabamentos no painel visível**
   - Manter um botão claro **“+ Adicionar acabamento”** dentro do painel **Kit Encadernação sugerido**, antes do botão de aplicar.
   - O botão deve aparecer mesmo quando o usuário só está usando o kit sugerido, para permitir aplicar acabamentos avulsos sem depender do kit.

3. **Validar no fluxo da imagem**
   - Abrir `/orcamentos-v3/novo`.
   - Selecionar **Apostila**.
   - Personalizar a capa.
   - Desmarcar **Furação**.
   - Confirmar que aparece **“Adicionar acabamento”** e que o botão passa a **“Aplicar acabamentos”**.