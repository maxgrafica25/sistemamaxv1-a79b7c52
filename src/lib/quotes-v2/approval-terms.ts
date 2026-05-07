// Termo de aceite eletrônico para aprovação de orçamentos.
// Versionado para fins de auditoria — qualquer mudança no texto deve
// gerar uma nova versão (ex.: "v2-2026-XX") sem alterar registros antigos.

export const APPROVAL_TERMS_VERSION = "v1-2026-05";

export const buildApprovalTermsText = (quoteNumber: string): string =>
  `Declaro que li e aprovo a produção dos itens listados conforme as condições apresentadas no Orçamento Nº ${quoteNumber}. ` +
  `Estou ciente de que esta confirmação tem valor de aceite formal e autoriza o início da produção dos itens selecionados, ` +
  `nos termos da MP 2.200-2/2001 (validade jurídica de manifestação de vontade por meio eletrônico). ` +
  `O sistema registrará data, horário, endereço de IP, dispositivo utilizado e o nome informado abaixo como comprovante deste aceite.`;
