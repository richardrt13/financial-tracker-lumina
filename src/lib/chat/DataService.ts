/**
 * DataService - Serviço para buscar e processar dados financeiros
 */

import { supabase } from '@/lib/supabase';
import type { FinancialProfile, ChatContext } from './ChatEngine';

export class DataService {
  /**
   * Busca perfil financeiro completo do usuário
   */
  static async fetchFinancialProfile(userId: string): Promise<FinancialProfile> {
    try {
      // Buscar todas as transações do usuário
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        return this.getDefaultProfile();
      }

      // Calcular métricas
      const metrics = this.calculateMetrics(transactions);
      const topCategories = this.calculateTopCategories(transactions);
      const financialHealth = this.assessFinancialHealth(metrics);

      return {
        averageIncome: metrics.avgIncome,
        averageExpense: metrics.avgExpense,
        savingsRate: metrics.savingsRate,
        topCategories,
        financialHealth,
        riskTolerance: this.inferRiskTolerance(transactions, metrics)
      };

    } catch (error) {
      console.error('Error fetching financial profile:', error);
      return this.getDefaultProfile();
    }
  }

  /**
   * Busca contexto completo para o chat
   */
  static async fetchChatContext(userId: string): Promise<Partial<ChatContext>> {
    try {
      const [profile, recentTransactions, activeBudgets] = await Promise.all([
        this.fetchFinancialProfile(userId),
        this.fetchRecentTransactions(userId, 100),
        this.fetchActiveBudgets(userId)
      ]);

      return {
        userFinancialProfile: profile,
        recentTransactions,
        activeBudgets
      };
    } catch (error) {
      console.error('Error fetching chat context:', error);
      return {};
    }
  }

  /**
   * Busca transações recentes
   */
  private static async fetchRecentTransactions(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Busca orçamentos ativos
   */
  private static async fetchActiveBudgets(userId: string) {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching budgets:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Calcula métricas financeiras
   */
  private static calculateMetrics(transactions: any[]) {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    // Filtrar últimos 3 meses
    const recentTransactions = transactions.filter(t => 
      new Date(t.created_at) >= threeMonthsAgo
    );

    // Agrupar por mês
    const monthlyData: Record<string, { income: number; expense: number }> = {};

    recentTransactions.forEach(t => {
      const date = new Date(t.created_at);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = { income: 0, expense: 0 };
      }

      if (t.type === 'receita') {
        monthlyData[key].income += Number(t.amount);
      } else if (t.type === 'despesa') {
        monthlyData[key].expense += Number(t.amount);
      }
    });

    const months = Object.values(monthlyData);
    const avgIncome = months.reduce((sum, m) => sum + m.income, 0) / (months.length || 1);
    const avgExpense = months.reduce((sum, m) => sum + m.expense, 0) / (months.length || 1);
    const savingsRate = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : 0;

    return { avgIncome, avgExpense, savingsRate };
  }

  /**
   * Calcula top categorias de gastos
   */
  private static calculateTopCategories(transactions: any[]) {
    const categoryTotals: Record<string, number> = {};
    let totalExpense = 0;

    transactions.forEach(t => {
      if (t.type === 'despesa') {
        const category = t.category || 'Outros';
        categoryTotals[category] = (categoryTotals[category] || 0) + Number(t.amount);
        totalExpense += Number(t.amount);
      }
    });

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / totalExpense) * 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  /**
   * Avalia saúde financeira
   */
  private static assessFinancialHealth(metrics: { avgIncome: number; avgExpense: number; savingsRate: number }): 'excellent' | 'good' | 'fair' | 'poor' {
    if (metrics.savingsRate >= 30) return 'excellent';
    if (metrics.savingsRate >= 20) return 'good';
    if (metrics.savingsRate >= 10) return 'fair';
    return 'poor';
  }

  /**
   * Infere tolerância ao risco
   */
  private static inferRiskTolerance(transactions: any[], metrics: any): 'conservative' | 'moderate' | 'aggressive' {
    const investmentTransactions = transactions.filter(t => t.type === 'investimento');
    const investmentRate = investmentTransactions.length / transactions.length;

    if (investmentRate > 0.15 || metrics.savingsRate > 30) return 'aggressive';
    if (investmentRate > 0.05 || metrics.savingsRate > 15) return 'moderate';
    return 'conservative';
  }

  /**
   * Perfil padrão para novos usuários
   */
  private static getDefaultProfile(): FinancialProfile {
    return {
      averageIncome: 0,
      averageExpense: 0,
      savingsRate: 0,
      topCategories: [],
      financialHealth: 'poor',
      riskTolerance: 'conservative'
    };
  }
}
