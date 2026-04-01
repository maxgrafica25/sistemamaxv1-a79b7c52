import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Trophy, AlertTriangle, TrendingDown, Award } from "lucide-react";

interface Props {
  equipmentId: string;
  equipmentName: string;
}

interface Loss {
  operator_name: string;
  quantity: number;
  error_type: string;
  date: string;
}

const COLORS = ["hsl(var(--primary))", "#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444"];

export default function EquipmentDashboardTab({ equipmentId, equipmentName }: Props) {
  const [losses, setLosses] = useState<Loss[]>([]);
  const [allLosses, setAllLosses] = useState<Loss[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: eqLosses }, { data: all }] = await Promise.all([
        supabase.from("production_losses").select("operator_name, quantity, error_type, date").eq("equipment_id", equipmentId).order("date", { ascending: false }),
        supabase.from("production_losses").select("operator_name, quantity, error_type, date").order("date", { ascending: false }),
      ]);
      if (eqLosses) setLosses(eqLosses);
      if (all) setAllLosses(all);
      setLoading(false);
    };
    fetchData();
  }, [equipmentId]);

  // Losses by error type (Pie)
  const byType = useMemo(() => {
    const op = losses.filter(l => l.error_type === "operational").reduce((s, l) => s + l.quantity, 0);
    const eq = losses.filter(l => l.error_type === "equipment").reduce((s, l) => s + l.quantity, 0);
    return [
      { name: "Operacional", value: op },
      { name: "Equipamento", value: eq },
    ].filter(d => d.value > 0);
  }, [losses]);

  // Losses by operator (Bar)
  const byOperator = useMemo(() => {
    const map: Record<string, number> = {};
    losses.forEach(l => { map[l.operator_name] = (map[l.operator_name] || 0) + l.quantity; });
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [losses]);

  // Operator ranking (gamification) - across ALL equipment
  const ranking = useMemo(() => {
    const map: Record<string, { total: number; operational: number; equipment: number }> = {};
    allLosses.forEach(l => {
      if (!map[l.operator_name]) map[l.operator_name] = { total: 0, operational: 0, equipment: 0 };
      map[l.operator_name].total += l.quantity;
      if (l.error_type === "operational") map[l.operator_name].operational += l.quantity;
      else map[l.operator_name].equipment += l.quantity;
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.operational - b.operational); // Fewer operational errors = better rank
  }, [allLosses]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  if (losses.length === 0 && allLosses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Sem dados de perdas para exibir gráficos</p>
        <p className="text-xs mt-1">Registre perdas na aba "Perdas" para ver os indicadores aqui</p>
      </div>
    );
  }

  const getMedalColor = (idx: number) => {
    if (idx === 0) return "text-yellow-500";
    if (idx === 1) return "text-gray-400";
    if (idx === 2) return "text-amber-700";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By error type */}
        {byType.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Perdas por Tipo — {equipmentName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* By operator */}
        {byOperator.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Perdas por Operador — {equipmentName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byOperator} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Perdas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Operator Ranking (Gamification) */}
      {ranking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Ranking de Operadores — Menor Índice de Erros Operacionais
            </CardTitle>
            <p className="text-xs text-muted-foreground">Operadores com menos erros operacionais ficam no topo. Bom desempenho = bonificação!</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.map((op, idx) => (
                <div key={op.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border">
                    {idx < 3 ? (
                      <Award className={`h-5 w-5 ${getMedalColor(idx)}`} />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">{idx + 1}º</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{op.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
                        Op: {op.operational}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        Eq: {op.equipment}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-foreground">{op.total}</span>
                  <span className="text-xs text-muted-foreground">perdas</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
