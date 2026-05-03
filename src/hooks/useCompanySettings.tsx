import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CompanySettings {
  id: string | null;
  companyName: string;
  whatsappNumber: string;   // só dígitos, ex: "5511987654321"
  whatsappDisplay: string;  // formatado, ex: "(11) 98765-4321"
  email: string;
  address: string;
  logoUrl: string;
  defaultQuoteValidityDays: number;
}

interface CompanySettingsContextValue extends CompanySettings {
  loading: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: CompanySettings = {
  id: null,
  companyName: "",
  whatsappNumber: "",
  whatsappDisplay: "",
  email: "",
  address: "",
  logoUrl: "",
};

const CompanySettingsContext = createContext<CompanySettingsContextValue>({
  ...EMPTY,
  loading: true,
  refresh: async () => undefined,
});

export const sanitizePhone = (s: string) => (s || "").replace(/\D/g, "");

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CompanySettings>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: row } = await supabase
      .from("company_settings")
      .select("id, company_name, whatsapp_number, whatsapp_display, email, address, logo_url")
      .limit(1)
      .maybeSingle();
    if (row) {
      setData({
        id: row.id,
        companyName: row.company_name ?? "",
        whatsappNumber: sanitizePhone(row.whatsapp_number ?? ""),
        whatsappDisplay: row.whatsapp_display ?? "",
        email: row.email ?? "",
        address: row.address ?? "",
        logoUrl: row.logo_url ?? "",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CompanySettingsContext.Provider value={{ ...data, loading, refresh }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export const useCompanySettings = () => useContext(CompanySettingsContext);
