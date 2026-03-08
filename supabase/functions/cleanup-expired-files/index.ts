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

    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let totalDeleted = 0;

    // 1. Clean up exam files older than 24h
    const { data: expiredExams } = await supabase
      .from('exams')
      .select('id, file_url, specification_file_url')
      .lt('created_at', cutoffTime)
      .or('file_url.neq.null,specification_file_url.neq.null')
      .limit(100);

    if (expiredExams?.length) {
      for (const exam of expiredExams) {
        const filesToDelete: string[] = [];
        if (exam.file_url) filesToDelete.push(exam.file_url);
        if (exam.specification_file_url) filesToDelete.push(exam.specification_file_url);

        if (filesToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('exam-files')
            .remove(filesToDelete);

          if (!storageError) {
            await supabase
              .from('exams')
              .update({ file_url: null, specification_file_url: null, file_processed_at: new Date().toISOString() })
              .eq('id', exam.id);
            totalDeleted += filesToDelete.length;
            console.log(`Cleaned up ${filesToDelete.length} file(s) for exam ${exam.id}`);
          } else {
            console.error(`Storage delete error for exam ${exam.id}:`, storageError);
          }
        }
      }
    }

    // 2. Clean up resource pack source files older than 24h
    const { data: expiredPacks } = await supabase
      .from('resource_packs')
      .select('id, source_file_url, example_paper_url')
      .lt('created_at', cutoffTime)
      .or('source_file_url.neq.null,example_paper_url.neq.null')
      .limit(100);

    if (expiredPacks?.length) {
      for (const pack of expiredPacks) {
        const filesToDelete: string[] = [];
        if (pack.source_file_url) filesToDelete.push(pack.source_file_url);
        if (pack.example_paper_url) filesToDelete.push(pack.example_paper_url);

        if (filesToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('exam-files')
            .remove(filesToDelete);

          if (!storageError) {
            await supabase
              .from('resource_packs')
              .update({ source_file_url: null, example_paper_url: null, file_processed_at: new Date().toISOString() })
              .eq('id', pack.id);
            totalDeleted += filesToDelete.length;
            console.log(`Cleaned up ${filesToDelete.length} file(s) for resource pack ${pack.id}`);
          }
        }
      }
    }

    // 3. Clean up practice set spec/example files older than 24h
    const { data: expiredSets } = await supabase
      .from('practice_question_sets')
      .select('id, specification_file_url, example_questions_file_url')
      .lt('created_at', cutoffTime)
      .or('specification_file_url.neq.null,example_questions_file_url.neq.null')
      .limit(100);

    if (expiredSets?.length) {
      for (const set of expiredSets) {
        const filesToDelete: string[] = [];
        if (set.specification_file_url) filesToDelete.push(set.specification_file_url);
        if (set.example_questions_file_url) filesToDelete.push(set.example_questions_file_url);

        if (filesToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('exam-files')
            .remove(filesToDelete);

          if (!storageError) {
            await supabase
              .from('practice_question_sets')
              .update({ specification_file_url: null, example_questions_file_url: null })
              .eq('id', set.id);
            totalDeleted += filesToDelete.length;
            console.log(`Cleaned up ${filesToDelete.length} file(s) for practice set ${set.id}`);
          }
        }
      }
    }

    // 4. Clean up orphaned resource packs (AI-generated, older than 2h, not linked to any exam or practice set)
    const orphanCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: orphanPacks } = await supabase
      .from('resource_packs')
      .select('id')
      .eq('pack_type', 'ai_generated')
      .lt('created_at', orphanCutoff)
      .limit(50);

    let orphansDeleted = 0;
    if (orphanPacks?.length) {
      for (const pack of orphanPacks) {
        // Check if any exam or practice set references this pack
        const [examRef, setRef] = await Promise.all([
          supabase.from('exams').select('id', { count: 'exact', head: true }).eq('resource_pack_id', pack.id),
          supabase.from('practice_question_sets').select('id', { count: 'exact', head: true }).eq('resource_pack_id', pack.id),
        ]);

        const isOrphan = (examRef.count || 0) === 0 && (setRef.count || 0) === 0;
        if (isOrphan) {
          // Delete resource items first, then the pack
          await supabase.from('resource_items').delete().eq('pack_id', pack.id);
          await supabase.from('resource_packs').delete().eq('id', pack.id);
          orphansDeleted++;
          console.log(`Deleted orphaned resource pack ${pack.id}`);
        }
      }
    }

    console.log(`Cleanup complete. Files deleted: ${totalDeleted}, orphan packs: ${orphansDeleted}`);

    return new Response(
      JSON.stringify({ success: true, filesDeleted: totalDeleted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in cleanup-expired-files:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Cleanup failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
