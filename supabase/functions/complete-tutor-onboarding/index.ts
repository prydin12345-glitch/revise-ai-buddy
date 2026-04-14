import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateInviteCode(): string {
  // Exclude ambiguous characters: I, O, 1, 0 — matches CreateGroupModal format
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EXM-${code}`;
}

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

    const results = {
      profile: false,
      groups: [] as any[],
      status: false,
      errors: [] as string[],
    };

    // 1. Upsert tutor profile
    try {
      const { error: profileError } = await supabaseClient
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
        });

      if (profileError) throw profileError;
      results.profile = true;
      console.log('Tutor profile created');
    } catch (e: any) {
      results.errors.push(`Profile: ${e.message}`);
      console.error('Error creating tutor profile:', e);
    }

    // 2. Create named classes with per-class subject/level/board settings
    if (results.profile) {
      const classesToCreate = (classes || [])
        .filter((c: any) => c.name && c.name.trim())
        .map((c: any) => ({
          tutor_id: user.id,
          name: c.name.trim(),
          capacity: parseInt(c.studentCount) || null,
          is_suggested: false,
          invite_code: generateInviteCode(),
          // Store single subject ID per class, not entire array
          subjects_covered: c.subjectId ? [c.subjectId] : (subjects_taught ?? []),
          // Save settings JSONB matching CreateGroupModal format
          settings: {
            subject_id: c.subjectId ?? null,
            subject_name: c.subjectName ?? null,
            educational_level: c.educationalLevel ?? null,
            exam_board: c.examBoard ?? null,
            educational_tier: c.educationalLevel ?? null,
          },
        }));

      for (const cls of classesToCreate) {
        try {
          const { data, error } = await supabaseAdmin
            .from('student_groups')
            .insert(cls)
            .select('id, name, invite_code, settings')
            .single();

          if (error) throw error;
          if (data) {
            const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';
            results.groups.push({
              ...data,
              invite_link: `${frontendUrl}/join/${data.invite_code}`
            });
          }
        } catch (e: any) {
          results.errors.push(`Class "${cls.name}": ${e.message}`);
          console.error(`Error creating class "${cls.name}":`, e);
        }
      }

      console.log(`Created ${results.groups.length} named classes`);
    }

    // 3. Update onboarding status
    try {
      const { error: statusError } = await supabaseAdmin
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

      if (statusError) throw statusError;
      results.status = true;
      console.log('Onboarding status updated');
    } catch (e: any) {
      results.errors.push(`Status: ${e.message}`);
      console.error('Error updating onboarding status:', e);
    }

    return new Response(
      JSON.stringify({
        success: results.profile && results.status,
        profile: results.profile,
        suggested_groups: results.groups,
        results,
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
