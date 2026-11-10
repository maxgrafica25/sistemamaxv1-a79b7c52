// Janela "Novo atendimento": escolhe o cliente do cadastro (ou cadastra na hora) e cria o cartão.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { CANAIS, type Canal } from "@/lib/crm/fila";
import { criarAtendimento, type Crm } from "@/lib/crm/dados";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientCombobox } from "@/components/orcamentos-v3/shared/ClientCombobox";

const NENHUM = "__nenhum__";

export function NovoAtendimentoDialog({
  open,
  onOpenChange,
  crm,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  crm: Crm;
  onCriado: (id: string) => void;
}) {
  const { user } = useAuth();
  const [cliente, setCliente] = useState<{ id: string | null; nome: string }>({ id: null, nome: "" });
  const [titulo, setTitulo] = useState("");
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [etapaId, setEtapaId] = useState("");
  const [responsavel, setResponsavel] = useState<string>(NENHUM);
  const [aguardando, setAguardando] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const primeiraEtapa = crm.etapasAtivas[0]?.id ?? "";
  useEffect(() => {
    if (!open) return;
    setCliente({ id: null, nome: "" });
    setTitulo("");
    setCanal("whatsapp");
    setEtapaId(primeiraEtapa);
    setResponsavel(user?.id ?? NENHUM);
    setAguardando(true);
    setObservacao("");
  }, [open, primeiraEtapa, user?.id]);

  const criar = async () => {
    if (!cliente.id) {
      toast.error("Escolha o cliente");
      return;
    }
    if (!etapaId) {
      toast.error("Crie ao menos uma etapa em Configurar");
      return;
    }
    setSalvando(true);
    const id = await criarAtendimento({
      client_id: cliente.id,
      titulo,
      etapa_id: etapaId,
      canal,
      responsavel_id: responsavel === NENHUM ? null : responsavel,
      aguardando,
      observacao,
    });
    setSalvando(false);
    if (!id) return;
    await crm.recarregarAtendimentos();
    onOpenChange(false);
    onCriado(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo atendimento</DialogTitle>
          <DialogDescription>O cartão fica ligado ao cliente do cadastro.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Cliente *</Label>
            <ClientCombobox value={cliente} onChange={(c) => setCliente({ id: c.id, nome: c.nome })} />
          </div>
          <div className="space-y-1">
            <Label>Assunto</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: banner 90×120, 500 cartões de visita" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Canal</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v as Canal)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CANAIS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Etapa</Label>
              <Select value={etapaId} onValueChange={setEtapaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{crm.etapasAtivas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Ninguém ainda</SelectItem>
                {crm.pessoas.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>O que o cliente pediu (opcional)</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className="resize-none" />
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span className="text-sm">
              Cliente está aguardando resposta
              <span className="block text-xs text-muted-foreground">Entra na fila e começa a contar o tempo de espera.</span>
            </span>
            <Switch checked={aguardando} onCheckedChange={setAguardando} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar atendimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
