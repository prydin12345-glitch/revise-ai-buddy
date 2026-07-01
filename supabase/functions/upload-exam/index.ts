import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const parseOptionalInt = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const rawFile = formData.get('file');
    const file = (rawFile instanceof File && rawFile.size > 0) ? rawFile : null;
    const subjectId = formData.get('subjectId') as string;
    const examTitle = formData.get('fileName') as string;
    const examBoard = (formData.get('examBoard') as string) || 'custom';
    const qualificationLevel = formData.get('qualificationLevel') as string | null;
    const educationalTier = formData.get('educationalTier') as string | null;
    const specFile = formData.get('specFile') as File | null;
    const resourcePackId = formData.get('resourcePackId') as string | null;
    const profileId = (formData.get('profileId') as string | null) || null;
    const curriculumTopicsRaw = formData.get('curriculumTopics') as string | null;
    const structureMode = formData.get('structureMode') as string | null;
    const profileQuestionCount = formData.get('profileQuestionCount') as string | null;
    const profileMcqCount = formData.get('profileMcqCount') as string | null;
    const profileWrittenCount = formData.get('profileWrittenCount') as string | null;
    const profileMcqOptionsCount = formData.get('profileMcqOptionsCount') as string | null;
    const profileIncludeGraphs = formData.get('profileIncludeGraphs') as string | null;
    const profileIncludeTables = formData.get('profileIncludeTables') as string | null;

    let curriculumTopics: string[] = [];
    if (curriculumTopicsRaw) {
      try {
        const parsed = JSON.parse(curriculumTopicsRaw);
        if (Array.isArray(parsed)) {
          curriculumTopics = parsed
            .filter((topic): topic is string => typeof topic === 'string')
            .map((topic) => topic.trim())
            .filter(Boolean);
        }
      } catch (parseError) {
        console.warn('Failed to parse curriculumTopics:', parseError);
      }
    }

    if (!subjectId || !examTitle) {
      return new Response(JSON.stringify({ error: 'Subject and exam name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing exam:', examTitle, 'for subject:', subjectId, 'file:', file?.name || 'none');

    // Upload file to storage (optional)
    let filePath: string | null = null;
    if (file && file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const storagePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      const fileBuffer = await file.arrayBuffer();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('exam-files')
        .upload(storagePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return new Response(JSON.stringify({ error: 'File upload failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      filePath = uploadData.path;
      console.log('File uploaded:', filePath);
    }

    console.log('Processing exam:', examTitle, 'for subject:', subjectId);

    // Upload specification file if provided
    let specFileUrl = null;
    if (specFile) {
      const specExt = specFile.name.split('.').pop();
      const specPath = `${user.id}/specs/${crypto.randomUUID()}.${specExt}`;
      const specBuffer = await specFile.arrayBuffer();

      const { data: specUploadData, error: specUploadError } = await supabase.storage
        .from('exam-files')
        .upload(specPath, specBuffer, {
          contentType: specFile.type,
          upsert: false,
        });

      if (!specUploadError && specUploadData) {
        specFileUrl = specUploadData.path;
        console.log('Specification uploaded:', specFileUrl);
      }
    }

    // Create exam record
    const { data: examData, error: examError } = await supabase
      .from('exams')
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        title: examTitle,
        exam_board: examBoard,
        qualification_level: qualificationLevel || educationalTier,
        specification_file_url: specFileUrl,
        type: 'uploaded',
        status: 'draft',
        file_url: filePath,
        resource_pack_id: resourcePackId || null,
        profile_id: profileId,
      })
      .select()
      .single();

    if (examError) {
      console.error('Exam creation error:', examError);
      return new Response(JSON.stringify({ error: 'Failed to create exam' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Exam created:', examData.id);

    // Store structure mode and profile question split in exam_format
    if (structureMode && profileQuestionCount) {
      const questionCount = parseOptionalInt(profileQuestionCount) ?? 0;
      const mcqCount = parseOptionalInt(profileMcqCount);
      const writtenCount = parseOptionalInt(profileWrittenCount);
      const useOriginal = structureMode === 'reference';

      const profileMetadata: Record<string, any> = {};
      if (profileMcqOptionsCount) profileMetadata.mcq_options_count = parseInt(profileMcqOptionsCount, 10) || 4;
      if (profileIncludeGraphs === 'true') profileMetadata.include_graphs = true;
      if (profileIncludeTables === 'true') profileMetadata.include_tables = true;

      const { error: formatInsertError } = await supabase.from('exam_format').insert({
        exam_id: examData.id,
        use_original_structure: useOriginal,
        difficulty_calibration: useOriginal ? 'exam_board_standard' : 'profile_locked',
        mcq_count: useOriginal ? null : mcqCount,
        short_answer_count: useOriginal ? null : (writtenCount ?? questionCount),
        long_form_count: useOriginal ? null : 0,
        profile_metadata: profileMetadata,
      });

      if (formatInsertError) {
        console.error('Failed to store structure mode:', formatInsertError);
      } else {
        console.log('Stored structure mode:', structureMode, 'MCQ:', mcqCount, 'Written:', writtenCount, 'Total:', questionCount, 'Metadata:', profileMetadata);
      }
    }

    if (curriculumTopics.length > 0) {
      const uniqueTopics = [...new Set(curriculumTopics)];
      const { error: specInsertError } = await supabase
        .from('exam_specifications')
        .insert(
          uniqueTopics.map((topic) => ({
            exam_id: examData.id,
            topic_name: topic,
          }))
        );

      if (specInsertError) {
        console.error('Failed to save exam profile topics:', specInsertError);
      }
    }

    return new Response(JSON.stringify({ draftId: examData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in upload-exam:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
