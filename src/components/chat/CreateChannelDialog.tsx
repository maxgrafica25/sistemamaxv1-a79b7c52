import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SECTORS = ["Atendimento", "Produção", "Acabamento", "Financeiro", "Comercial", "Gestão"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateChannelDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [sector, setSector] = useState("");

  const handleCreate = async () => {
    if (!name.trim() || !user) {
      toast.error("Informe o nome do canal");
      return;
    }
    const { data, error } = await supabase.from("channels").insert({
      name: name.toLowerCase().replace(/\s+/g, "-"),
      description,
      type,
      sector: sector || null,
      created_by: user.id,
    }).select("id").single();

    if (error) {
      toast.error("Erro ao criar canal");
      return;
    }

    // Add creator as member
    if (data) {
      await supabase.from("channel_members").insert({
        channel_id: data.id,
        user_id: user.id,
        role: "admin",
      });
    }

    toast.success("Canal criado!");
    setName(""); setDescription(""); setType("public"); setSector("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Canal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nome do canal *</Label>
            <Input placeholder="ex: pedidos-urgentes" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea placeholder="Descreva o propósito do canal..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant={type === "public" ? "default" : "outline"} size="sm" onClick={() => setType("public")} className="flex-1">
              Público
            </Button>
            <Button type="button" variant={type === "private" ? "default" : "outline"} size="sm" onClick={() => setType("private")} className="flex-1">
              Privado
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Setor (opcional)</Label>
            <select
              value={sector}
              onChange={e => setSector(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Nenhum</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleCreate} className="flex-1">Criar Canal</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
