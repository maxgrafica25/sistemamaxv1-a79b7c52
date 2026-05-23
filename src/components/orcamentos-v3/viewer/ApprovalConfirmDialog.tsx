import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Loader2 } from "lucide-react";

interface ApprovalItemPreview {
  description: string;
  value: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteNumber: string;
  items: ApprovalItemPreview[];
  total: number;
  termsText: string;
  defaultName?: string;
  submitting?: boolean;
  onConfirm: (approverName: string) => void | Promise<void>;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ApprovalConfirmDialog({
  open,
  onOpenChange,
  quoteNumber,
  items,
  total,
  termsText,
  defaultName = "",
  submitting = false,
  onConfirm,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setAgreed(false);
    }
  }, [open, defaultName]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 2 && trimmed.length <= 200 && agreed && !submitting;

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Confirmação de Aprovação
          </DialogTitle>
          <DialogDescription>
            Para registrar formalmente seu aceite do Orçamento Nº <strong>{quoteNumber}</strong>,
            confirme os dados abaixo. Esta confirmação tem valor de assinatura eletrônica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 max-h-40 overflow-y-auto">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
              Itens a aprovar ({items.length})
            </p>
            <ul className="space-y-1 text-xs">
              {items.map((it, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <span className="flex-1">{it.description}</span>
                  <span className="font-medium tabular-nums">{formatBRL(it.value)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Termo de aceite
            </p>
            <p className="text-xs text-foreground/90 leading-relaxed">{termsText}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approver-name" className="text-sm">
              Seu nome completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="approver-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Marcelle Pinheiro"
              maxLength={200}
              autoComplete="name"
              disabled={submitting}
            />
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={agreed}
              onCheckedChange={(c) => setAgreed(c === true)}
              disabled={submitting}
              className="mt-0.5"
            />
            <span className="text-foreground/90">
              Li e concordo com os termos acima. Confirmo que sou o responsável pela aprovação
              deste orçamento.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => void onConfirm(trimmed)}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Registrando…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Confirmar Aprovação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
