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
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    );

    const { goal_id } = await req.json();

    // Fetch goal details with subject
    const { data: goal, error: goalError } = await supabaseClient
      .from('revision_goals')
      .select('*, subjects(*)')
      .eq('id', goal_id)
      .single();

    if (goalError) {
      console.error('Error fetching goal:', goalError);
      throw goalError;
    }

    console.log('Generating schedule for goal:', goal);

    // Get spaced repetition profile from subject
    const spacedProfile = goal.subjects?.default_spaced_profile || { intervals: [1, 3, 7, 14, 30] };
    
    // Calculate task schedule based on goal parameters
    const tasks = generateTaskSchedule(goal, spacedProfile);

    console.log(`Generated ${tasks.length} tasks`);

    // Insert tasks
    const { data: insertedTasks, error: insertError } = await supabaseClient
      .from('revision_tasks')
      .insert(tasks)
      .select();

    if (insertError) {
      console.error('Error inserting tasks:', insertError);
      throw insertError;
    }

    // Update goal status
    await supabaseClient
      .from('revision_goals')
      .update({
        schedule_status: 'scheduled',
        scheduled_tasks_count: tasks.length
      })
      .eq('id', goal_id);

    console.log('Successfully scheduled tasks');

    return new Response(
      JSON.stringify({ success: true, tasks: insertedTasks, count: tasks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-schedule-goal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function generateTaskSchedule(goal: any, spacedProfile: any) {
  const tasks = [];
  const startDate = new Date();
  const deadline = goal.deadline ? new Date(goal.deadline) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const totalDays = Math.floor((deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Generate tasks based on goal type
  if (goal.goal_type === 'improve_grade') {
    const targetExams = goal.target_metric?.exam_count || 10;
    const daysBetweenExams = Math.max(3, Math.floor(totalDays / targetExams));
    
    for (let i = 0; i < targetExams; i++) {
      const taskDate = new Date(startDate);
      taskDate.setDate(taskDate.getDate() + (i * daysBetweenExams));
      
      if (taskDate <= deadline) {
        tasks.push({
          user_id: goal.user_id,
          subject: goal.subject,
          subject_color: goal.subject_color || '#3B82F6',
          date: taskDate.toISOString(),
          day: taskDate.toLocaleDateString('en-US', { weekday: 'long' }),
          time: '14:00',
          duration: 60,
          focus_topic: `Mock Exam ${i + 1}`,
          status: 'scheduled',
          priority: 'medium',
          generated_from_goal_id: goal.id,
          is_auto_scheduled: true,
          spaced_profile: {
            interval_days: spacedProfile.intervals[Math.min(i, spacedProfile.intervals.length - 1)],
            ease_factor: 2.5,
            repetition: i + 1
          }
        });
      }
    }
  }
  
  // Add review tasks using spaced repetition intervals
  spacedProfile.intervals.forEach((interval: number, idx: number) => {
    const reviewDate = new Date(startDate);
    reviewDate.setDate(reviewDate.getDate() + interval);
    
    if (reviewDate <= deadline) {
      const nextInterval = idx < spacedProfile.intervals.length - 1 
        ? spacedProfile.intervals[idx + 1] 
        : null;
        
      tasks.push({
        user_id: goal.user_id,
        subject: goal.subject,
        subject_color: goal.subject_color || '#3B82F6',
        date: reviewDate.toISOString(),
        day: reviewDate.toLocaleDateString('en-US', { weekday: 'long' }),
        time: '10:00',
        duration: 45,
        focus_topic: `Spaced Review ${idx + 1}`,
        status: 'scheduled',
        priority: 'high',
        generated_from_goal_id: goal.id,
        is_auto_scheduled: true,
        next_review_date: nextInterval 
          ? new Date(reviewDate.getTime() + nextInterval * 24 * 60 * 60 * 1000).toISOString()
          : null,
        spaced_profile: {
          interval_days: interval,
          ease_factor: 2.5,
          repetition: idx + 1
        }
      });
    }
  });
  
  return tasks;
}
