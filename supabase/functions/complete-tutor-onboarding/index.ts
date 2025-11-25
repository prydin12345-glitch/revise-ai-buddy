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

    const { 
      subjects_taught,
      student_count_estimate,
      teaching_mode,
      preferred_group_size,
      availability,
      bio
    } = await req.json();

    // Get current user
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    console.log('Creating tutor profile for user:', user.id);

    // Upsert tutor profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('tutor_profiles')
      .upsert({
        user_id: user.id,
        subjects_taught,
        student_count_estimate,
        teaching_mode,
        preferred_group_size,
        availability,
        bio,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating tutor profile:', profileError);
      throw profileError;
    }

    console.log('Tutor profile created:', profile);

    // Generate suggested groups if using group mode
    const suggestedGroups = [];
    if (teaching_mode === 'groups' && student_count_estimate && preferred_group_size) {
      const groupCount = Math.ceil(student_count_estimate / preferred_group_size);
      console.log(`Generating ${groupCount} suggested groups`);
      
      for (let i = 0; i < groupCount; i++) {
        const inviteCode = generateInviteCode();
        const { data: group, error: groupError } = await supabaseClient
          .from('student_groups')
          .insert({
            tutor_id: user.id,
            name: `Group ${String.fromCharCode(65 + i)}`,
            capacity: preferred_group_size,
            is_suggested: true,
            invite_code: inviteCode,
            subjects_covered: subjects_taught
          })
          .select()
          .single();

        if (groupError) {
          console.error('Error creating group:', groupError);
          throw groupError;
        }

        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';
        suggestedGroups.push({
          ...group,
          invite_link: `${frontendUrl}/join/${inviteCode}`
        });
      }

      console.log(`Created ${suggestedGroups.length} groups`);
    }

    // Update onboarding status
    await supabaseClient
      .from('user_onboarding_status')
      .upsert({
        user_id: user.id,
        role: 'tutor',
        tutor_profile_completed: true,
        completed_at: new Date().toISOString(),
        last_step: 'tutor_profile'
      }, {
        onConflict: 'user_id,role'
      });

    console.log('Onboarding status updated');

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        suggested_groups: suggestedGroups
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in complete-tutor-onboarding:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
