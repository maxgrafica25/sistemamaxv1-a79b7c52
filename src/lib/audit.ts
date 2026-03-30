import { supabase } from "@/integrations/supabase/client";

interface AuditEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  details?: string;
}

export async function logAudit(entry: AuditEntry) {
  try {
    await supabase.from("audit_logs").insert(entry);
  } catch (e) {
    console.error("Audit log error:", e);
  }
}
