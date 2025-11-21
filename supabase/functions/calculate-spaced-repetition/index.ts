import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { taskId, confidence } = await req.json();

    if (!taskId || confidence === undefined) {
      return new Response(
        JSON.stringify({ error: 'Task ID and confidence rating are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simplified SM-2 algorithm for spaced repetition
    // Confidence: 1-5 scale
    const calculateNextReviewDays = (confidence: number): number => {
      // Very low confidence (1-2): Review in 1-2 days
      if (confidence <= 2) return 1;
      
      // Moderate confidence (3): Review in 3-4 days
      if (confidence === 3) return 3;
      
      // Good confidence (4): Review in 7 days (1 week)
      if (confidence === 4) return 7;
      
      // Very high confidence (5): Review in 14 days (2 weeks)
      return 14;
    };

    const daysUntilReview = calculateNextReviewDays(confidence);
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilReview);

    // Update the task with next review date
    const { error: updateError } = await supabaseClient
      .from('revision_tasks')
      .update({
        next_review_date: nextReviewDate.toISOString(),
        confidence_after: confidence,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('Error updating task:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update task' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Calculated next review for task ${taskId}: ${daysUntilReview} days (confidence: ${confidence})`);

    return new Response(
      JSON.stringify({
        success: true,
        nextReviewDate: nextReviewDate.toISOString(),
        daysUntilReview
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in calculate-spaced-repetition:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});