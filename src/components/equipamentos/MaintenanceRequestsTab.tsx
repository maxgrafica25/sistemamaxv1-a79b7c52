import { useState, useEffect } from "react"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Wrench, Copy, Eye, Paperclip, X, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  equipmentId: string;
  equipmentName: string;
}

interface Request {
  id: string;
  equipment_id: string;
  requested_by: string;
  description: string;
  urgency: string;
  status: string;
  attachments: string[];
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

const urgencyConfig: Record<string, { label: string; class: string }> = {
  low: { label: "Baixa", class: "bg-slate-100 text-slate-700 border-slate-200" },
  normal: { label: "Normal", class: "bg-blue-50 text-blue-700 border-blue-200" },
  high: { label: "Alta", class: "bg-orange-50 text-orange-700 border-orange-200" },
  critical: { label: "Crítica", class: "bg-red-50 text-red-700 border-red-200" },
};

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: "Pendente", class: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  in_progress: { label: "Em andamento", class: "bg-blue-50 text-blue-700 border-blue-200" },
  resolved: { label: "Resolvido", class: "bg-green-50 text-green-700 border-green-200" },
};

export default function MaintenanceRequestsTab({ equipmentId, equipmentName }: Props) {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // Form
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Admin
  const [adminNotes, setAdminNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("created_at", { ascending: false });
    if (data) setRequests(data as Request[]);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [equipmentId]);

  const resetForm = () => {
    setDescription("");
    setUrgency("normal");
    setFiles([]);
  };

  const handleSave = async () => {
    if (!description.trim()) return toast.error("Descreva o problema");

    setUploading(true);
    const attachmentUrls: string[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${equipmentId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("maintenance-attachments").upload(path, file);
      if (!uploadError) {
        const { data: signData, error: signError } = await supabase.storage.from("maintenance-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (!signError) {
          attachmentUrls.push(signData.signedUrl);
        }
      }
    }

    const { error } = await supabase.from("maintenance_requests").insert({
      equipment_id: equipmentId,
      requested_by: profile?.display_name || "Desconhecido",
      description: description.trim(),
      urgency,
      attachments: attachmentUrls,
    });

    setUploading(false);
    if (error) return toast.error("Erro ao registrar solicitação");
    toast.success("Solicitação de manutenção registrada!");
    resetForm();
    setShowNewDialog(false);
    fetchRequests();
  };

  const openDetail = (req: Request) => {
    setSelectedRequest(req);
    setAdminNotes(req.admin_notes || "");
    setEditStatus(req.status);
    setShowDetailDialog(true);
  };

  const updateRequest = async () => {
    if (!selectedRequest) return;
    await supabase.from("maintenance_requests").update({
      status: editStatus,
      admin_notes: adminNotes || null,
      resolved_at: editStatus === "resolved" ? new Date().toISOString() : null,
    }).eq("id", selectedRequest.id);
    toast.success("Solicitação atualizada");
    setShowDetailDialog(false);
    fetchRequests();
  };

  const copyForTechnician = (req: Request) => {
    const urgLabel = urgencyConfig[req.urgency]?.label || req.urgency;
    const text = [
      `🔧 SOLICITAÇÃO DE MANUTENÇÃO`,
      `Equipamento: ${equipmentName}`,
      `Solicitante: ${req.requested_by}`,
      `Data: ${new Date(req.created_at).toLocaleDateString("pt-BR")}`,
      `Urgência: ${urgLabel}`,
      ``,
      `📋 Relato do operador:`,
      req.description,
      ...(req.attachments?.length ? [``, `📎 Anexos (${req.attachments.length}):`, ...req.attachments] : []),
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  const fmtDateTime = (d: string) => new Date(d).toLocaleString("pt-BR");

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowNewDialog(true); }} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Solicitar Manutenção
        </Button>
      </div>

      {/* Table */}
      {requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma solicitação de manutenção</p>
          <p className="text-xs mt-1">Operadores podem registrar problemas para solicitar manutenção</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(r)}>
                  <TableCell className="text-sm whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {fmtDate(r.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.requested_by}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${urgencyConfig[r.urgency]?.class || ""}`}>
                      {urgencyConfig[r.urgency]?.label || r.urgency}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${statusConfig[r.status]?.class || ""}`}>
                      {statusConfig[r.status]?.label || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{r.description}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {r.attachments?.length > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Paperclip className="h-3 w-3" /> {r.attachments.length}
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Copiar p/ Técnico" onClick={() => copyForTechnician(r)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver detalhes" onClick={() => openDetail(r)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Request Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Solicitar Manutenção — {equipmentName}
            </DialogTitle>
            <DialogDescription>
              Descreva o problema detalhadamente e anexe fotos/vídeos se possível
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Solicitante</Label>
                <Input value={profile?.display_name || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Urgência *</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 Baixa</SelectItem>
                    <SelectItem value="normal">🔵 Normal</SelectItem>
                    <SelectItem value="high">🟠 Alta</SelectItem>
                    <SelectItem value="critical">🔴 Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descreva o problema detalhadamente *</Label>
              <Textarea
                placeholder="O que está acontecendo? Quando começou? A máquina está funcionando ou parou?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Anexos (fotos/vídeos)</Label>
              <Input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={e => setFiles(Array.from(e.target.files || []))}
              />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                      <Paperclip className="h-3 w-3" /> {f.name}
                      <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={uploading}>
              {uploading ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog (Admin view) */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[560px]">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Detalhes da Solicitação
                </DialogTitle>
                <DialogDescription>
                  {equipmentName} — {fmtDateTime(selectedRequest.created_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Solicitante</p>
                    <p className="font-medium">{selectedRequest.requested_by}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Urgência</p>
                    <Badge variant="outline" className={`text-xs ${urgencyConfig[selectedRequest.urgency]?.class || ""}`}>
                      {urgencyConfig[selectedRequest.urgency]?.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="in_progress">Em andamento</SelectItem>
                        <SelectItem value="resolved">Resolvido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Relato do operador:</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>

                {/* Attachments */}
                {selectedRequest.attachments?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Anexos ({selectedRequest.attachments.length}):</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedRequest.attachments.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                          {url.match(/\.(mp4|mov|webm)$/i) ? (
                            <video src={url} className="rounded border w-full h-24 object-cover" />
                          ) : (
                            <img src={url} alt={`Anexo ${i + 1}`} className="rounded border w-full h-24 object-cover" />
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notas do Administrador</Label>
                  <Textarea
                    placeholder="Anotações sobre a resolução, peças necessárias, etc."
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Copy button */}
                <Button variant="outline" className="w-full gap-2" onClick={() => copyForTechnician(selectedRequest)}>
                  <Copy className="h-4 w-4" /> Copiar relato p/ Técnico (WhatsApp/E-mail)
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Fechar</Button>
                <Button onClick={updateRequest} className="gap-1.5">
                  <Check className="h-4 w-4" /> Salvar Alterações
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
