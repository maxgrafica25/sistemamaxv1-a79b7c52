import { useCallback, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export function usePermission() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const checkPermission = useCallback(async (permissionKey: string): Promise<boolean> => {
    if (!profile) return false;
    if (profile.role === "admin") return true;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("verificar_permissao", {
        p_user_id: profile.id, // The function expects p_user_id (referenced to profiles.id)
        p_permissao_chave: permissionKey
      });

      if (error) {
        console.error("Error checking permission:", error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error("Permission check failed:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [profile]);

  return { checkPermission, loading };
}
