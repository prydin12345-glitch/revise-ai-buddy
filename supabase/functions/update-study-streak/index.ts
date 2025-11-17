import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const today = new Date().toISOString().split('T')[0];

    // Check if user completed any task today
    const { data: completedToday } = await supabase
      .from('revision_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('updated_at', `${today}T00:00:00`)
      .limit(1);

    if (!completedToday || completedToday.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tasks completed today, streak not updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create user streak record
    const { data: existingStreak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    const now = new Date();
    let currentStreak = 1;
    let longestStreak = 1;

    if (existingStreak) {
      const lastActivity = existingStreak.last_exam_submitted_at 
        ? new Date(existingStreak.last_exam_submitted_at)
        : null;

      if (lastActivity) {
        const hoursSince = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
        
        // If activity within 48 hours, continue streak
        if (hoursSince <= 48) {
          currentStreak = existingStreak.current_streak + 1;
          longestStreak = Math.max(currentStreak, existingStreak.longest_streak);
        } else {
          // Reset streak after 48 hours
          currentStreak = 1;
          longestStreak = existingStreak.longest_streak;
        }
      }

      // Update existing streak
      await supabase
        .from('user_streaks')
        .update({
          current_streak: currentStreak,
          longest_streak: longestStreak,
          last_exam_submitted_at: now.toISOString(),
        })
        .eq('user_id', userId);
    } else {
      // Create new streak record
      await supabase
        .from('user_streaks')
        .insert({
          user_id: userId,
          current_streak: 1,
          longest_streak: 1,
          last_exam_submitted_at: now.toISOString(),
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        current_streak: currentStreak,
        longest_streak: longestStreak 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating streak:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
