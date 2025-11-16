import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting due date reminder check...');

    // Get today's date and calculate future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Find tasks due tomorrow or in 2 days (depending on reminder_days_before)
    const { data: tasksDueTomorrow, error: error1 } = await supabase
      .from('revision_tasks')
      .select('*')
      .eq('due_date', formatDate(tomorrow))
      .eq('reminder_days_before', 1)
      .eq('is_completed', false);

    const { data: tasksDueIn2Days, error: error2 } = await supabase
      .from('revision_tasks')
      .select('*')
      .eq('due_date', formatDate(twoDaysFromNow))
      .eq('reminder_days_before', 2)
      .eq('is_completed', false);

    if (error1 || error2) {
      console.error('Error fetching tasks:', error1 || error2);
      throw error1 || error2;
    }

    const allTasks = [...(tasksDueTomorrow || []), ...(tasksDueIn2Days || [])];
    console.log(`Found ${allTasks.length} tasks requiring reminders`);

    // Create notifications for each task
    for (const task of allTasks) {
      const daysUntilDue = task.reminder_days_before === 1 ? 'tomorrow' : 'in 2 days';
      
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: task.user_id,
          type: 'due_date_reminder',
          title: `Reminder: ${task.subject} revision due soon`,
          body: `Your ${task.subject} revision task "${task.focus_topic}" is due ${daysUntilDue}.`,
          action_data: {
            task_id: task.id,
            action_type: 'view_task',
            date: task.date,
          },
        });

      if (notificationError) {
        console.error('Error creating notification for task:', task.id, notificationError);
      } else {
        console.log(`Created reminder notification for task: ${task.id}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: allTasks.length,
        message: `Processed ${allTasks.length} due date reminders` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-due-date-reminders function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
