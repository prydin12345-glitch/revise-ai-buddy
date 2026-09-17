import { OCR_GATEWAY_BIOLOGY_ID } from '../_shared/assessment-tier.ts';
import { paperPlanForAttempt } from '../_shared/course-selection.ts';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { storedAssessmentTier } from "../_shared/profile-context.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { draftId, format } = await req.json();

    if (!draftId || !format) {
      return new Response(JSON.stringify({ error: 'Draft ID and format required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Saving format for exam:', draftId, format);

    // Verify exam ownership and read the server-validated course context.
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, generation_context')
      .eq('id', draftId)
      .eq('user_id', user.id)
      .single();

    if (examError || !exam) {
      return new Response(JSON.stringify({ error: 'Exam not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate total questions
    const totalFromBreakdown = (format.mcq?.count || 0) + (format.shortAnswer?.count || 0) + (format.longForm?.count || 0);
    const effectiveTotal = format.totalQuestions || totalFromBreakdown || null;

    // Unpack profileMetadata for top-level columns
    const profileMeta = { ...(format.profileMetadata || {}) };
    // AUTHORITATIVE TIER: taken only from the exam's server-resolved context
    // (written by upload-exam after an ownership check). A conflicting
    // format.assessmentTier / profileMetadata.assessmentTier is ignored.
    const assessmentTier = storedAssessmentTier((exam as any).generation_context);
    if (
      (format.assessmentTier ?? profileMeta.assessmentTier ?? null) !== null &&
      (format.assessmentTier ?? profileMeta.assessmentTier) !== assessmentTier
    ) {
      console.warn('Ignoring client-supplied assessmentTier; using saved context:', assessmentTier);
    }
    delete profileMeta.assessmentTier;
    const context = exam.generation_context;
    if (context?.resolved_by === 'server' && context.context_version === 2) {
      profileMeta.paperBlueprint = context.paper_contract ? {paperContract: context.paper_contract} :
        (profileMeta.paperBlueprint?.sections ? {sections: profileMeta.paperBlueprint.sections} : null);
    }
    const plan = paperPlanForAttempt(context, profileMeta.paperBlueprint);
    const useOriginalStructure = format.useOriginal === true;
    const questionStructure = profileMeta.questionStructure
      ?? (useOriginalStructure && !format.profileMetadata ? 'original' : 'standalone');

    const formatPayload: any = {
      exam_id: draftId,
      use_original_structure: useOriginalStructure,
      difficulty_calibration: format.difficulty || 'exam_board_standard',
      mcq_count: format.mcq?.count || null,
      mcq_marks_each: format.mcq?.marksEach || null,
      short_answer_count: format.shortAnswer?.count || (effectiveTotal && !totalFromBreakdown ? effectiveTotal : null),
      short_answer_marks_each: format.shortAnswer?.marksEach || null,
      long_form_count: format.longForm?.count || null,
      long_form_marks_each: format.longForm?.marksEach || null,
      profile_metadata: { ...profileMeta, assessmentTier },
      // Top-level columns from profile metadata — source of truth for edge functions
      question_structure: questionStructure,
      difficulty_progression: profileMeta.difficultyProgression ?? 'ascending',
      calculator_policy: profileMeta.calculatorPolicy ?? 'allowed',
      include_extended: profileMeta.includeExtended ?? false,
      extended_marks: profileMeta.extendedMarks ?? 0,
      mark_distribution: profileMeta.markDistribution ?? {},
      mcq_position: profileMeta.mcqPosition ?? 'start',
      include_graphs: profileMeta.includeGraphs ?? null,
      include_tables: profileMeta.includeTables ?? null,
      include_diagrams: profileMeta.includeDiagrams ?? null,
    };

    if (plan?.courseId === OCR_GATEWAY_BIOLOGY_ID) {
      Object.assign(formatPayload, {use_original_structure: false,
        mcq_count: plan.parts.filter(p => p.responseType === 'mcq_single').length,
        short_answer_count: plan.parts.filter(p => p.responseType === 'short_answer').length,
        long_form_count: plan.parts.filter(p => p.responseType === 'long_form').length,
        mcq_marks_each: 1, question_structure: 'mixed',
        mark_distribution: {}, include_extended: false, extended_marks: 0, mcq_position: 'start',
        include_tables: plan.parts.some(p => p.resource === 'data_table'), include_graphs: plan.parts.some(p => p.resource === 'graph'),
        calculator_policy: 'allowed'});
    }
    if (format.profileMetadata) {
      console.log('Profile metadata received:', JSON.stringify(format.profileMetadata));
    }

    const { error: formatError } = await supabase
      .from('exam_format')
      .upsert(formatPayload, {
        onConflict: 'exam_id',
      });

    if (formatError) {
      console.error('Format save error:', formatError);
      return new Response(JSON.stringify({ error: 'Failed to save format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in save-exam-format:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
