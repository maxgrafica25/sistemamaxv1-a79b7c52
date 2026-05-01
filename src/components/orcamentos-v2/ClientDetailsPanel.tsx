import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClientRow {
  id: string;
  nome: string;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  tipo: string | null;
  cnpj: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  municipio: string | null;
  estado: string | null;
  observacoes: string | null;
}

interface Props {
  clientId: string;
  onUpdated?: (nome: string, telefone: string | null) => void;
}

export function ClientDetailsPanel({ clientId, onUpdated }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<ClientRow | null>(null);
  const [data, setData] = useState<ClientRow | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const { data: row, error } = await supabase
        .from("clients")
        .select("id, nome, empresa, email, telefone, tipo, cnpj, cep, endereco, numero, complemento, municipio, estado, observacoes")
        .eq("id", clientId)
        .maybeSingle();
      if (!active) return;
      if (error || !row) {
        toast.error("Erro ao carregar dados do cliente");
        setLoading(false);
        return;
      }
      setOriginal(row as ClientRow);
      setData(row as ClientRow);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [clientId]);

  const dirty = data && original && JSON.stringify(data) !== JSON.stringify(original);

  const update = (k: keyof ClientRow, v: string) => {
    setData((d) => d ? { ...d, [k]: v } : d);
  };

  const handleSave = async () => {
    if (!data) return;
    if (!data.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!data.telefone?.trim()) { toast.error("Telefone é obrigatório"); return; }
    setSaving(true);
    const payload = {
      nome: data.nome.trim(),
      empresa: data.empresa?.trim() || null,
      email: data.email?.trim() || "",
      telefone: data.telefone.trim(),
      tipo: data.tipo || "cliente",
      cnpj: data.cnpj?.trim() || null,
      cep: data.cep?.trim() || null,
      endereco: data.endereco?.trim() || null,
      numero: data.numero?.trim() || null,
      complemento: data.complemento?.trim() || null,
      municipio: data.municipio?.trim() || null,
      estado: data.estado?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
    };
    const { error } = await supabase.from("clients").update(payload).eq("id", clientId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Dados do cliente atualizados");
    setOriginal(data);
    onUpdated?.(data.nome, data.telefone);
  };

  const handleCancel = () => {
    setData(original);
  };

  if (loading) {
    return (
      <Card className="bg-muted/30 border-dashed animate-in fade-in slide-in-from-top-2">
        <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados do cliente...
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="bg-muted/30 border-dashed animate-in fade-in slide-in-from-top-2">
      <CardContent className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de Pessoa</Label>
            <Select value={data.tipo || "cliente"} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
                <SelectItem value="parceiro">Parceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nome / Razão Social *</Label>
            <Input className="h-9" value={data.nome} onChange={(e) => update("nome", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Empresa / Fantasia</Label>
            <Input className="h-9" value={data.empresa ?? ""} onChange={(e) => update("empresa", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">CNPJ / CPF</Label>
            <Input className="h-9" value={data.cnpj ?? ""} onChange={(e) => update("cnpj", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone *</Label>
            <Input className="h-9" value={data.telefone ?? ""} onChange={(e) => update("telefone", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <Input className="h-9" type="email" value={data.email ?? ""} onChange={(e) => update("email", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">CEP</Label>
            <Input className="h-9" value={data.cep ?? ""} onChange={(e) => update("cep", e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Endereço</Label>
            <Input className="h-9" value={data.endereco ?? ""} onChange={(e) => update("endereco", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Número</Label>
            <Input className="h-9" value={data.numero ?? ""} onChange={(e) => update("numero", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Complemento</Label>
            <Input className="h-9" value={data.complemento ?? ""} onChange={(e) => update("complemento", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Município</Label>
            <Input className="h-9" value={data.municipio ?? ""} onChange={(e) => update("municipio", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">UF</Label>
            <Input className="h-9" maxLength={2} value={data.estado ?? ""} onChange={(e) => update("estado", e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={data.observacoes ?? ""} onChange={(e) => update("observacoes", e.target.value)} />
          </div>
        </div>

        {dirty && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar alterações
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
