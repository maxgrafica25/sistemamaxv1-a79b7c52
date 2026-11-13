// Ferramentas favoritas da Pré-impressão, uma lista para cada usuário.
// Fica guardada na própria conta do usuário (user_metadata do login: sem tabela nova e sem custo), então
// vale em qualquer computador; uma cópia no navegador deixa a tela instantânea e funciona se a internet cair.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FAVORITAS_PADRAO, alternarFavorito, normalizarFavoritos } from "./ferramentas";

const CAMPO = "preimpressao_favoritos";
const chaveLocal = (usuario: string) => `preimpressao.favoritos.v1.${usuario}`;

function lerLocal(usuario: string): string[] | null {
  try {
    return normalizarFavoritos(JSON.parse(window.localStorage.getItem(chaveLocal(usuario)) ?? "null"));
  } catch {
    return null;
  }
}

export function useFavoritos() {
  const { user } = useAuth();
  const usuario = user?.id ?? "anonimo";
  const daConta = normalizarFavoritos(user?.user_metadata?.[CAMPO]);
  const [lista, setLista] = useState<string[]>(() => daConta ?? lerLocal(usuario) ?? FAVORITAS_PADRAO);

  // Entrou outro usuário, ou a conta trouxe a lista de outro computador
  useEffect(() => {
    setLista(daConta ?? lerLocal(usuario) ?? FAVORITAS_PADRAO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, JSON.stringify(daConta)]);

  const alternar = useCallback(
    (key: string) => {
      const nova = alternarFavorito(lista, key);
      setLista(nova);
      try {
        window.localStorage.setItem(chaveLocal(usuario), JSON.stringify(nova));
      } catch {
        /* navegador sem localStorage */
      }
      if (user) void supabase.auth.updateUser({ data: { [CAMPO]: nova } }).catch(() => undefined);
    },
    [lista, usuario, user],
  );

  return { favoritos: lista, ehFavorita: (key: string) => lista.includes(key), alternar, usuario: user?.id ?? null };
}
