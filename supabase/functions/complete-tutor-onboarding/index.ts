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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const body = await req.json();
    const {
      subjects_taught,
      student_count_estimate,
      teaching_mode,
      preferred_group_size,
      availability,
      bio,
      teaching_region,
      custom_region,
      boards_taught,
      levels_taught,
      classes,
    } = body;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    console.log('Creating tutor profile for user:', user.id);

    // Upsert tutor profile with new fields
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
        teaching_region: teaching_region || null,
        custom_region: custom_region || null,
        boards_taught: boards_taught || [],
        levels_taught: levels_taught || [],
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

    // Create named classes instead of auto-generated groups
    const suggestedGroups: any[] = [];
    const classesToCreate = (classes || [])
      .filter((c: any) => c.name && c.name.trim())
      .map((c: any) => ({
        tutor_id: user.id,
        name: c.name.trim(),
        capacity: c.studentCount || null,
        is_suggested: false,
        invite_code: generateInviteCode(),
        subjects_covered: subjects_taught,
      }));

    if (classesToCreate.length > 0) {
      const { data: groups, error: groupError } = await supabaseAdmin
        .from('student_groups')
        .insert(classesToCreate)
        .select();

      if (groupError) {
        console.error('Error creating groups:', groupError);
        throw groupError;
      }

      if (groups) {
        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';
        for (const group of groups) {
          suggestedGroups.push({
            ...group,
            invite_link: `${frontendUrl}/join/${group.invite_code}`
          });
        }
      }

      console.log(`Created ${suggestedGroups.length} named classes`);
    }

    // Update onboarding status — include subjects_completed so OnboardingGuard doesn't redirect
    await supabaseAdmin
      .from('user_onboarding_status')
      .upsert({
        user_id: user.id,
        role: 'tutor',
        subjects_completed: true,
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
