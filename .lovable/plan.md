Vou corrigir a lógica para bater com o segundo print: para etiqueta 6,1×5,1 cm em SRA3 deve dar 38 unidades, com 6 colunas no miolo e linhas de extremidade centralizadas.

Plano de ajuste:

1. Corrigir a escolha de orientação
- Hoje o cálculo escolhe a rotação que dá maior total bruto antes da regra das marcas, por isso pode cair em um layout 4×8 = 32.
- Vou passar a comparar as orientações pelo total efetivo depois das reservas/linhas reduzidas.
- Assim, 61×51mm em SRA3 escolherá a orientação que gera 6 colunas × 7 linhas brutas, depois reduzindo só as linhas necessárias, chegando a 38.

2. Ajustar a regra dos 10mm para ser por “slot removido”, não por largura recalculada contínua
- Para plotter quadrado/personalizado:
  - aplicar somente na primeira e última linha;
  - se a etiqueta das pontas ficar a menos de 10mm da marca, remover 1 etiqueta de cada ponta;
  - centralizar a linha reduzida.
- Para plotter redondo:
  - aplicar somente na primeira linha;
  - última linha sempre cheia.
- O miolo nunca será reduzido por essa regra.

3. Garantir o caso obrigatório do usuário
- Adicionar/alterar teste para SRA3 + etiqueta 61×51mm + gap 1mm + margens 7mm:
  - bruto esperado: 6 colunas × 7 linhas;
  - primeira linha: 5 etiquetas centralizadas;
  - linhas do miolo: 6 etiquetas;
  - última linha: 5 etiquetas centralizadas;
  - total efetivo: 38 etiquetas.

4. Manter preview e PDF sincronizados
- O preview SVG e o PDF continuarão usando `cellsPerRow` e `rowOffsets` como fonte única.
- Isso garante que o desenho visto na calculadora e o PDF de produção tenham a mesma distribuição.

5. Atualizar a memória/regra interna da calculadora
- Trocar a documentação interna antiga, que dizia para remover simetricamente até folga de 10mm recalculada, pela regra correta: reduzir apenas as linhas afetadas pelas marcas e centralizar.