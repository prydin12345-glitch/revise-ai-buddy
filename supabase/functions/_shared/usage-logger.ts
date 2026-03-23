// Shared AI usage logger — used by all edge functions after AI calls
export const logAIUsage = async (
  supabase: any,
  params: {
    userId: string;
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheHit: boolean;
    subject?: string;
    durationMs?: number;
  }
) => {
  try {
    await supabase.from('ai_usage_tracking').insert({
      user_id: params.userId,
      feature_name: params.feature,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      tokens_used: params.inputTokens + params.outputTokens,
      cache_hit: params.cacheHit,
      subject: params.subject ?? null,
      duration_ms: params.durationMs ?? null,
      cost_credits: estimateCredits(params.model, params.inputTokens, params.outputTokens),
    });
  } catch (err) {
    // Never let logging failure break the main flow
    console.error('Usage logging failed:', err);
  }
};

// Rough credit estimation based on model
function estimateCredits(model: string, inputTokens: number, outputTokens: number): number {
  const rates: Record<string, { input: number; output: number }> = {
    'google/gemini-2.5-flash': { input: 0.075, output: 0.3 },
    'google/gemini-2.5-pro': { input: 1.25, output: 5.0 },
    'google/gemini-2.5-flash-lite': { input: 0.02, output: 0.08 },
    'google/gemini-3-flash-preview': { input: 0.1, output: 0.4 },
    'openai/gpt-5-mini': { input: 0.4, output: 1.6 },
    'cache': { input: 0, output: 0 },
  };
  const rate = rates[model] || { input: 0.1, output: 0.4 };
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}
