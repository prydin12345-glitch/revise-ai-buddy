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
    const file = formData.get('file') as File;
    const subjectId = formData.get('subjectId') as string;
    const examTitle = formData.get('fileName') as string;
    const examBoard = formData.get('examBoard') as string;
    const qualificationLevel = formData.get('qualificationLevel') as string | null;
    const specFile = formData.get('specFile') as File | null;

    if (!file || !subjectId || !examTitle || !examBoard) {
      return new Response(JSON.stringify({ error: 'File, subject, exam board, and file name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Uploading file:', file.name, 'for subject:', subjectId, 'with name:', examTitle);

    // Upload file to storage
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

    console.log('File uploaded:', uploadData.path);

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
        qualification_level: qualificationLevel,
        specification_file_url: specFileUrl,
        type: 'uploaded',
        status: 'draft',
        file_url: uploadData.path,
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
