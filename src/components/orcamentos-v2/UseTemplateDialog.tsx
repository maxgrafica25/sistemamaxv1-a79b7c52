import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookmarkCheck, Search, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cloneQuote } from "@/lib/quotes-v2/clone";

interface TemplateRow {
  id: string;
  quote_number: string;
  client: string;
  product: string;
  value: number;
  materials_count: number;
  steps_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function UseTemplateDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [cloningId, setCloningId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fetchTemplates = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, client, product, value")
        .eq("is_template", true)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar modelos");
      } else {
        setTemplates((data as TemplateRow[]) || []);
      }
      setLoading(false);
    };
    fetchTemplates();
    setSearch("");
  }, [open]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return templates;
    return templates.filter(
      (t) =>
        t.product.toLowerCase().includes(s) ||
        t.client.toLowerCase().includes(s) ||
        t.quote_number.toLowerCase().includes(s),
    );
  }, [templates, search]);

  const handleUse = async (template: TemplateRow) => {
    setCloningId(template.id);
    try {
      const { newQuoteId, newQuoteNumber } = await cloneQuote(template.id);
      toast.success(`Novo orçamento ${newQuoteNumber} criado a partir do modelo`);
      onOpenChange(false);
      navigate(`/orcamentos-v2/${newQuoteId}`);
    } catch (e) {
      toast.error(`Erro ao usar modelo: ${(e as Error).message}`);
    } finally {
      setCloningId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Escolher Modelo Pronto
          </DialogTitle>
          <DialogDescription>
            Selecione um modelo salvo para criar um novo orçamento já preenchido.
            Depois é só ajustar o cliente e os detalhes.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto, cliente ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-10 px-4 text-sm text-muted-foreground space-y-2">
              <BookmarkCheck className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p>Você ainda não tem modelos prontos.</p>
              <p>
                Marque qualquer orçamento existente com o ícone de marcador
                <Badge variant="outline" className="mx-1">
                  <BookmarkCheck className="h-3 w-3" />
                </Badge>
                para transformá-lo em modelo reutilizável.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhum modelo encontrado para "{search}".
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{t.product}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {t.quote_number}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      Modelo baseado em: {t.client} · {formatBRL(t.value)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleUse(t)}
                    disabled={cloningId !== null}
                    className="gap-1.5 shrink-0"
                  >
                    {cloningId === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Usar este modelo
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
