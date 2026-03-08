import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, HelpCircle, Scale, CheckCircle2, TrendingUp, Target, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SummaryData, CompletionData, Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';

interface HealthScoreProps {
  summaryData: SummaryData;
  completionData: CompletionData;
  allTransactions: Transaction[];
  budgetId?: string;
  userId?: string | null;
}

interface CategoryBudget {
  id: string;
  category: string;
  monthly_limit: number;
}

interface PillarItem {
  key: string;
  label: string;
  icon: typeof Scale;
  percentage: number;
  weight: number;
  color: string;
  tooltip: string;
  detail: string;
  tip: string | null;
  noData?: boolean;
}

function pillarColor(pct: number): string {
  if (pct >= 70) return '#22c55e';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function calculateHealthScore(
  summaryData: SummaryData,
  completionData: CompletionData,
  allTransactions: Transaction[],
  categoryBudgets: CategoryBudget[],
): { score: number; label: string; color: string; barColor: string; pillars: PillarItem[] } {
  const { receita, despesa, investimento } = summaryData;
  const pillars: PillarItem[] = [];

  // --- Equilíbrio (35%) ---
  // Mede receita vs despesa apenas. Investimentos são premiados no pilar próprio,
  // não devem penalizar o equilíbrio — investir o que sobra é o comportamento ideal.
  const marginRate = receita > 0
    ? ((receita - despesa) / receita) * 100
    : 0;
  const targetMarginRate = 20;
  const equilibrioPct = Math.round(Math.min(100, Math.max(0, (marginRate / targetMarginRate) * 100)));
  const marginGap = receita > 0 && marginRate < targetMarginRate
    ? (targetMarginRate - marginRate) / 100 * receita
    : 0;

  pillars.push({
    key: 'equilibrio',
    label: 'Equilíbrio',
    icon: Scale,
    percentage: equilibrioPct,
    weight: 35,
    color: pillarColor(equilibrioPct),
    tooltip: 'Mede se você gasta menos do que ganha. Investimentos não são contados como gasto.',
    detail: receita > 0
      ? `${marginRate.toFixed(1)}% da renda disponível (receita − despesas) · Meta: ≥ ${targetMarginRate}%`
      : 'Sem receitas registradas neste período',
    tip: marginGap > 0
      ? `Reduza R$ ${formatCurrency(marginGap)} em despesas para atingir a meta`
      : null,
  });

  // --- Regularidade (25%) ---
  const totalCount = completionData.receita.count + completionData.despesa.count + completionData.investimento.count;
  const totalCompleted = completionData.receita.completed + completionData.despesa.completed + completionData.investimento.completed;
  const regularidadePct = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 100;
  const pendingCount = totalCount - totalCompleted;

  pillars.push({
    key: 'regularidade',
    label: 'Regularidade',
    icon: CheckCircle2,
    percentage: regularidadePct,
    weight: 25,
    color: pillarColor(regularidadePct),
    tooltip: 'Proporção de transações confirmadas ou concluídas no período atual.',
    detail: totalCount > 0
      ? `${totalCompleted} de ${totalCount} concluídas`
      : 'Nenhuma transação no período',
    tip: pendingCount > 0
      ? `${pendingCount} transaç${pendingCount === 1 ? 'ão pendente' : 'ões pendentes'} para confirmar`
      : null,
  });

  // --- Investimentos (25%) ---
  const targetInvestRate = 15;
  const investmentRate = receita > 0 ? (investimento / receita) * 100 : 0;
  const investimentosPct = Math.round(Math.min(100, Math.max(0, (investmentRate / targetInvestRate) * 100)));
  const investGap = receita > 0 && investmentRate < targetInvestRate
    ? (targetInvestRate - investmentRate) / 100 * receita
    : 0;

  pillars.push({
    key: 'investimentos',
    label: 'Investimentos',
    icon: TrendingUp,
    percentage: investimentosPct,
    weight: 25,
    color: pillarColor(investimentosPct),
    tooltip: 'Percentual da sua renda destinado a investimentos para construção de patrimônio.',
    detail: receita > 0
      ? `${investmentRate.toFixed(1)}% da renda investida · Meta: ≥ ${targetInvestRate}%`
      : 'Sem receitas registradas neste período',
    tip: investGap > 0
      ? `Invista mais R$ ${formatCurrency(investGap)} para atingir a meta`
      : null,
  });

  // --- Orçamento (15%) ---
  const categorySpending = new Map<string, number>();
  allTransactions
    .filter(t => t.type === 'despesa')
    .forEach(t => categorySpending.set(t.category, (categorySpending.get(t.category) || 0) + t.amount));

  let orcamentoPct = 0;
  let orcamentoNoData = false;

  if (categoryBudgets.length > 0) {
    const withinLimit = categoryBudgets.filter(b => {
      const spent = categorySpending.get(b.category) || 0;
      return spent <= b.monthly_limit;
    }).length;
    orcamentoPct = Math.round((withinLimit / categoryBudgets.length) * 100);
  } else {
    orcamentoNoData = true;
  }

  const overBudgetCategories = categoryBudgets
    .filter(b => (categorySpending.get(b.category) || 0) > b.monthly_limit)
    .map(b => b.category);

  pillars.push({
    key: 'orcamento',
    label: 'Orçamento',
    icon: Target,
    percentage: orcamentoPct,
    weight: 15,
    color: orcamentoNoData ? '#a1a1aa' : pillarColor(orcamentoPct),
    tooltip: 'Aderência aos limites de gasto por categoria que você definiu.',
    detail: orcamentoNoData
      ? 'Nenhum limite de categoria configurado'
      : `${categoryBudgets.filter(b => (categorySpending.get(b.category) || 0) <= b.monthly_limit).length} de ${categoryBudgets.length} categorias dentro do limite`,
    tip: orcamentoNoData
      ? 'Configure limites em "Limites por Categoria" para ativar este pilar'
      : overBudgetCategories.length > 0
        ? `Acima do limite: ${overBudgetCategories.join(', ')}`
        : null,
    noData: orcamentoNoData,
  });

  // --- Score final (média ponderada) ---
  const activePillars = pillars.filter(p => !p.noData);
  const totalWeight = activePillars.reduce((sum, p) => sum + p.weight, 0);
  const weightedSum = activePillars.reduce((sum, p) => sum + p.percentage * p.weight, 0);
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  let label: string; let color: string; let barColor: string;
  if (score >= 80) { label = 'Excelente'; color = '#22c55e'; barColor = 'bg-green-500'; }
  else if (score >= 60) { label = 'Saudável'; color = '#10b981'; barColor = 'bg-emerald-500'; }
  else if (score >= 40) { label = 'Atenção'; color = '#f59e0b'; barColor = 'bg-amber-500'; }
  else { label = 'Crítico'; color = '#ef4444'; barColor = 'bg-red-500'; }

  return { score, label, color, barColor, pillars };
}

export function HealthScore({ summaryData, completionData, allTransactions, budgetId, userId }: HealthScoreProps) {
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);

  useEffect(() => {
    if (!budgetId || !userId) return;
    supabase
      .from('category_budgets')
      .select('id, category, monthly_limit')
      .eq('budget_id', budgetId)
      .eq('user_id', userId)
      .then(({ data }) => setCategoryBudgets(data || []));
  }, [budgetId, userId]);

  const { score, label, color, barColor, pillars } = useMemo(
    () => calculateHealthScore(summaryData, completionData, allTransactions, categoryBudgets),
    [summaryData, completionData, allTransactions, categoryBudgets]
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Finance Score</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[280px] text-xs leading-relaxed p-3">
                <p className="font-semibold mb-1.5">Como funciona o Finance Score?</p>
                <p className="text-muted-foreground mb-2">Nota de 0 a 100 baseada em 4 pilares, cada um avaliado de 0% a 100% e com pesos diferentes:</p>
                <div className="space-y-1 text-muted-foreground">
                  {pillars.map(p => (
                    <div key={p.key} className="flex justify-between">
                      <span>{p.label}</span>
                      <span className="font-medium text-foreground">{p.weight}% do score</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5 text-muted-foreground">
                  <p>≥ 80 = Excelente</p>
                  <p>≥ 60 = Saudável</p>
                  <p>≥ 40 = Atenção</p>
                  <p>&lt; 40 = Crítico</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Score display */}
          <div className="flex items-end gap-3 mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tighter" style={{ color }}>{score}</span>
              <span className="text-lg text-muted-foreground font-medium">%</span>
            </div>
            <span className="text-sm font-semibold mb-1 px-2.5 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}15` }}>
              {label}
            </span>
          </div>

          {/* Main progress bar */}
          <div className="w-full bg-muted rounded-full h-3 mb-5 overflow-hidden">
            <div
              className={`h-3 rounded-full ${barColor}`}
              style={{ width: `${score}%`, transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </div>

          {/* Pillar breakdown */}
          <div className="space-y-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Tooltip key={pillar.key}>
                  <TooltipTrigger asChild>
                    <div className="cursor-help group">
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="text-muted-foreground font-medium group-hover:text-foreground transition-colors flex items-center gap-1.5">
                          <Icon className="h-3 w-3" />
                          {pillar.label}
                          <span className="text-[9px] text-muted-foreground/60 font-normal">({pillar.weight}%)</span>
                        </span>
                        <span className="font-bold tabular-nums" style={{ color: pillar.noData ? undefined : pillar.color }}>
                          {pillar.noData ? '—' : `${pillar.percentage}%`}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: pillar.noData ? '0%' : `${pillar.percentage}%`,
                            backgroundColor: pillar.color,
                            transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] p-3">
                    <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" style={{ color: pillar.color }} />
                      {pillar.label}
                      <span className="text-muted-foreground font-normal">· {pillar.weight}% do score</span>
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{pillar.tooltip}</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1.5 pt-1.5 border-t border-border/50">
                      {pillar.detail}
                    </p>
                    {pillar.tip && (
                      <p className="text-[10px] mt-1 font-medium" style={{ color: pillar.color }}>
                        💡 {pillar.tip}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
