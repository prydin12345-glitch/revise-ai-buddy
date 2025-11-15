import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AIUsageStat {
  feature_name: string;
  total_tokens: number;
  total_credits: number;
  count: number;
}

export const useAIUsageStats = () => {
  const [stats, setStats] = useState<AIUsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCredits, setTotalCredits] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get current month date range
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { data, error } = await supabase
          .from('ai_usage_tracking')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString())
          .lte('created_at', endOfMonth.toISOString());

        if (error) throw error;

        // Aggregate by feature
        const aggregated = data.reduce((acc, item) => {
          const existing = acc.find(s => s.feature_name === item.feature_name);
          if (existing) {
            existing.total_tokens += item.tokens_used || 0;
            existing.total_credits += parseFloat(item.cost_credits?.toString() || '0');
            existing.count += 1;
          } else {
            acc.push({
              feature_name: item.feature_name,
              total_tokens: item.tokens_used || 0,
              total_credits: parseFloat(item.cost_credits?.toString() || '0'),
              count: 1,
            });
          }
          return acc;
        }, [] as AIUsageStat[]);

        setStats(aggregated);

        const totalCreds = aggregated.reduce((sum, s) => sum + s.total_credits, 0);
        const totalToks = aggregated.reduce((sum, s) => sum + s.total_tokens, 0);
        setTotalCredits(totalCreds);
        setTotalTokens(totalToks);
      } catch (error) {
        console.error('Error loading AI usage stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return { stats, loading, totalCredits, totalTokens };
};
