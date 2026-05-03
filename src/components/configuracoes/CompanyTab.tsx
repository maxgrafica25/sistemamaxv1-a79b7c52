import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Save, Loader2, Info, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings, sanitizePhone } from "@/hooks/useCompanySettings";

const formatPhoneDisplay = (digits: string) => {
  const d = digits.replace(/\D/g, "");
  // Brazil only formatting; keeps country code outside if 13 digits
  if (d.length <= 2) return d;
  if (d.length <= 4) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  // 12-13 digits → assume DDI 55 prefix
  const cc = d.slice(0, d.length - 11);
  const ddd = d.slice(-11, -9);
  const p1 = d.slice(-9, -4);
  const p2 = d.slice(-4);
  return `+${cc} (${ddd}) ${p1}-${p2}`;
};

interface Props {
  isAdmin: boolean;
}

export default function CompanyTab({ isAdmin }: Props) {
  const { id, companyName, whatsappNumber, email, address, defaultQuoteValidityDays, loading, refresh } =
    useCompanySettings();

  const [form, setForm] = useState({
    company_name: "",
    whatsapp_raw: "",
    email: "",
    address: "",
    default_quote_validity_days: "15",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setForm({
        company_name: companyName,
        whatsapp_raw: whatsappNumber,
        email,
        address,
        default_quote_validity_days: String(defaultQuoteValidityDays ?? 15),
      });
    }
  }, [loading, companyName, whatsappNumber, email, address, defaultQuoteValidityDays]);

  const whatsappDigits = sanitizePhone(form.whatsapp_raw);
  const whatsappPretty = formatPhoneDisplay(whatsappDigits);
  const phoneValid = whatsappDigits.length === 0 || whatsappDigits.length >= 10;

  const handleSave = async () => {
    if (!isAdmin) return;
    if (!phoneValid) {
      toast.error("Número de WhatsApp inválido. Inclua DDD + número.");
      return;
    }
    setSaving(true);
    const validityNum = Math.max(1, Math.floor(Number(form.default_quote_validity_days) || 15));
    const payload = {
      company_name: form.company_name.trim(),
      whatsapp_number: whatsappDigits,
      whatsapp_display: whatsappDigits ? whatsappPretty : null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      default_quote_validity_days: validityNum,
    };
    let error;
    if (id) {
      ({ error } = await supabase.from("company_settings").update(payload).eq("id", id));
    } else {
      ({ error } = await supabase.from("company_settings").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success("Dados da empresa atualizados!");
    refresh();
  };

  return (
    <div className="space-y-6 mt-4">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Dados da Empresa
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Informações de identidade e contato usadas em orçamentos enviados aos clientes.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isAdmin && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Apenas administradores podem editar estas informações.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="company_name">Nome da empresa</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              placeholder="Ex.: Max Gráfica"
              disabled={!isAdmin}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-600" />
              WhatsApp para aprovação de orçamentos
            </Label>
            <Input
              id="whatsapp"
              value={form.whatsapp_raw}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp_raw: e.target.value }))}
              placeholder="(11) 98765-4321"
              disabled={!isAdmin}
              className={!phoneValid ? "border-destructive" : ""}
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {whatsappDigits
                  ? `Será usado como: ${whatsappPretty}`
                  : "Inclua DDD. Ex: (11) 98765-4321"}
              </span>
              {!phoneValid && (
                <span className="text-destructive font-medium">Número inválido</span>
              )}
            </div>
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs">
                Este número será usado nos botões <strong>"Aprovar Orçamento"</strong> e{" "}
                <strong>"Solicitar Alteração"</strong> da página pública do orçamento. O cliente
                clica e o WhatsApp dele abre com a mensagem pronta — <strong>nenhuma mensagem é
                enviada automaticamente</strong>, então não há risco de banimento da sua conta.
              </AlertDescription>
            </Alert>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail de contato</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="contato@maxgrafica.com.br"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Rua, nº, cidade — UF"
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <Label htmlFor="default_validity">Validade padrão dos orçamentos (dias)</Label>
            <Input
              id="default_validity"
              type="number"
              min={1}
              value={form.default_quote_validity_days}
              onChange={(e) => setForm((f) => ({ ...f, default_quote_validity_days: e.target.value }))}
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground">
              Valor sugerido ao criar um novo orçamento. O vendedor pode ajustar caso a caso (ex.: licitação 60 dias).
            </p>
          </div>

          {isAdmin && (
            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
