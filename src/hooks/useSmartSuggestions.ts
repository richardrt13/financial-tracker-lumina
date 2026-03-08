import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface HistoricalPattern {
  description: string;
  category: string;
  type: string;
  amount: number;
  count: number;
}

export function useSmartSuggestions(userId: string | null, budgetId: string | null) {
  const [patterns, setPatterns] = useState<HistoricalPattern[]>([]);

  useEffect(() => {
    if (!userId || !budgetId) return;

    const fetchPatterns = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('description, category, type, amount')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .not('description', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!data) return;

      const patternMap = new Map<string, HistoricalPattern>();
      data.forEach(t => {
        if (!t.description) return;
        const key = t.description.toLowerCase().trim();
        if (patternMap.has(key)) {
          const existing = patternMap.get(key)!;
          existing.count++;
          existing.amount = (existing.amount + t.amount) / 2;
        } else {
          patternMap.set(key, {
            description: t.description,
            category: t.category,
            type: t.type,
            amount: t.amount,
            count: 1,
          });
        }
      });

      setPatterns(Array.from(patternMap.values()).sort((a, b) => b.count - a.count));
    };

    fetchPatterns();
  }, [userId, budgetId]);

  const suggestCategory = (description: string): string | null => {
    if (!description || description.length < 2) return null;
    const lower = description.toLowerCase().trim();
    const match = patterns.find(p => 
      p.description.toLowerCase().includes(lower) || lower.includes(p.description.toLowerCase())
    );
    return match?.category || null;
  };

  const suggestDescriptions = (input: string): string[] => {
    if (!input || input.length < 2) return [];
    const lower = input.toLowerCase();
    return patterns
      .filter(p => p.description.toLowerCase().includes(lower))
      .slice(0, 5)
      .map(p => p.description);
  };

  const suggestAmount = (description: string): number | null => {
    if (!description) return null;
    const lower = description.toLowerCase().trim();
    const match = patterns.find(p => p.description.toLowerCase() === lower);
    return match ? Math.round(match.amount * 100) / 100 : null;
  };

  return { suggestCategory, suggestDescriptions, suggestAmount, patterns };
}
