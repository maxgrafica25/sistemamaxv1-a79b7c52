import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Calculator, Palette, FileText } from "lucide-react";

interface Consumable {
  id: string;
  name: string;
  price: number;
  yield_pages: number;
  mode: string;
}

interface CostPerPageTabProps {
  consumables: Consumable[];
  printerType: string;
}

const fmt4 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });

export default function CostPerPageTab({ consumables, printerType }: CostPerPageTabProps) {
  const isColor = printerType === "color";

  // PB cost: shared consumables only, 5% coverage
  const sharedConsumables = consumables.filter(c => c.mode === "shared");
  const colorOnlyConsumables = consumables.filter(c => c.mode === "color_only");

  const pbCostBase = sharedConsumables.reduce((sum, c) => c.yield_pages > 0 ? sum + c.price / c.yield_pages : sum, 0);
  const pbCost = pbCostBase; // 5% coverage = base

  // Color cost: all consumables, 20% coverage = base * 4
  const allCostBase = consumables.reduce((sum, c) => c.yield_pages > 0 ? sum + c.price / c.yield_pages : sum, 0);
  const colorCost = allCostBase * 4; // 20% = 4x the 5% base

  if (consumables.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calculator className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Cadastre consumíveis para ver o custo por página calculado automaticamente.</p>
      </div>
    );
  }

  const renderTable = (title: string, icon: React.ReactNode, items: Consumable[], coverage: number, totalCost: number, accent: string) => (
    <Card className="border-l-4" style={{ borderLeftColor: accent }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-sm">{title}</span>
            <Badge variant="outline" className="text-[10px]">{coverage}% cobertura</Badge>
          </div>
          <span className="text-lg font-bold font-mono" style={{ color: accent }}>{fmt4(totalCost)}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consumível</TableHead>
              <TableHead className="text-center">Modo</TableHead>
              <TableHead className="text-right">Custo/Página</TableHead>
              <TableHead className="text-right">% do Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(c => {
              const cpp = c.yield_pages > 0 ? (c.price / c.yield_pages) * (coverage / 5) : 0;
              const pct = totalCost > 0 ? (cpp / totalCost) * 100 : 0;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={c.mode === "color_only" ? "default" : "secondary"} className="text-[10px]">
                      {c.mode === "color_only" ? "Somente Color" : "Compartilhado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt4(cpp)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono text-xs">{pct.toFixed(1)}%</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/30 font-semibold">
              <TableCell colSpan={2}>TOTAL</TableCell>
              <TableCell className="text-right font-mono">{fmt4(totalCost)}</TableCell>
              <TableCell className="text-right"><Badge className="font-mono text-xs">100%</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground px-1">
        <Calculator className="h-4 w-4 inline mr-1.5" />
        Custo calculado automaticamente com base nos consumíveis cadastrados e seus modos (compartilhado / somente color).
      </div>

      {/* PB Cost */}
      {renderTable(
        "Custo PB (Preto e Branco)",
        <FileText className="h-4 w-4 text-slate-500" />,
        sharedConsumables,
        5,
        pbCost,
        "hsl(220, 13%, 46%)"
      )}

      {/* Color Cost — only show for color printers */}
      {isColor && renderTable(
        "Custo Color (Colorido)",
        <Palette className="h-4 w-4 text-violet-500" />,
        consumables,
        20,
        colorCost,
        "hsl(262, 83%, 58%)"
      )}

      {/* Summary cards */}
      <div className={`grid gap-4 ${isColor ? "grid-cols-2" : "grid-cols-1"}`}>
        <Card className="bg-slate-50 dark:bg-slate-900 border-slate-300">
          <CardContent className="p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Custo PB (5%)</p>
            <p className="text-2xl font-bold text-foreground font-mono">{fmt4(pbCost)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Apenas consumíveis compartilhados</p>
          </CardContent>
        </Card>
        {isColor && (
          <Card className="bg-violet-50 dark:bg-violet-950 border-violet-300">
            <CardContent className="p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Custo Color (20%)</p>
              <p className="text-2xl font-bold text-foreground font-mono">{fmt4(colorCost)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Todos os consumíveis</p>
            </CardContent>
          </Card>
        )}
      </div>

      {!isColor && colorOnlyConsumables.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-300">
          ⚠️ Existem consumíveis marcados como "Somente Color" neste equipamento PB. Eles não serão considerados no cálculo de custo.
        </div>
      )}
    </div>
  );
}
