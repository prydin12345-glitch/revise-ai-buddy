import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StudentPDFRequest {
  contentType: "exam" | "practice";
  contentId: string;
  includeAnswers: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: StudentPDFRequest = await req.json();
    const { contentType, contentId, includeAnswers } = body;

    console.log(`PDF request: type=${contentType}, id=${contentId}, includeAnswers=${includeAnswers}, user=${user.id}`);

    if (!contentType || !contentId) {
      return new Response(
        JSON.stringify({ error: "Missing contentType or contentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let pdfData: any;
    let title: string;
    let subject: string | null = null;

    if (contentType === "exam") {
      // Fetch exam and verify ownership
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .select("*")
        .eq("id", contentId)
        .single();

      if (examError || !exam) {
        console.error("Exam fetch error:", examError);
        return new Response(
          JSON.stringify({ error: "Exam not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the student owns this exam
      if (exam.user_id !== user.id) {
        console.error(`Ownership check failed: exam.user_id=${exam.user_id}, user.id=${user.id}`);
        return new Response(
          JSON.stringify({ error: "You can only download PDFs for exams you created" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      title = exam.title;
      subject = exam.subject_id;

      // Fetch questions
      const { data: questions, error: questionsError } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("exam_id", contentId)
        .order("question_number");

      if (questionsError) {
        console.error("Questions fetch error:", questionsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch questions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Optionally fetch student answers
      let studentAnswers: Record<string, any> = {};
      if (includeAnswers) {
        const { data: answers, error: answersError } = await supabase
          .from("student_answers")
          .select("*")
          .eq("exam_id", contentId)
          .eq("student_id", user.id);

        if (!answersError && answers) {
          answers.forEach((answer) => {
            studentAnswers[answer.question_id] = answer;
          });
        }
      }

      pdfData = {
        type: "student_exam",
        title: exam.title,
        subject: exam.subject_id,
        difficulty: exam.qualification_level || "Standard",
        totalQuestions: questions?.length || 0,
        dateGenerated: new Date().toISOString(),
        questions: questions?.map((q) => ({
          ...q,
          studentAnswer: includeAnswers ? studentAnswers[q.id] : null,
        })) || [],
        includeAnswers,
      };

    } else if (contentType === "practice") {
      // Fetch practice set and verify ownership
      const { data: practiceSet, error: setError } = await supabase
        .from("practice_question_sets")
        .select("*")
        .eq("id", contentId)
        .single();

      if (setError || !practiceSet) {
        console.error("Practice set fetch error:", setError);
        return new Response(
          JSON.stringify({ error: "Practice set not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      if (practiceSet.user_id !== user.id) {
        console.error(`Ownership check failed: practiceSet.user_id=${practiceSet.user_id}, user.id=${user.id}`);
        return new Response(
          JSON.stringify({ error: "You can only download PDFs for practice sets you created" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      title = practiceSet.set_name;
      subject = practiceSet.subject_id;

      // Fetch questions
      const { data: questions, error: questionsError } = await supabase
        .from("practice_questions")
        .select("*")
        .eq("set_id", contentId)
        .order("question_number_int", { ascending: true });

      if (questionsError) {
        console.error("Practice questions fetch error:", questionsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch practice questions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Optionally fetch student answers
      let studentAnswers: Record<string, any> = {};
      if (includeAnswers) {
        const { data: answers, error: answersError } = await supabase
          .from("practice_question_answers")
          .select("*")
          .eq("set_id", contentId)
          .eq("user_id", user.id);

        if (!answersError && answers) {
          answers.forEach((answer) => {
            studentAnswers[answer.question_id] = answer;
          });
        }
      }

      pdfData = {
        type: "student_practice",
        title: practiceSet.set_name,
        subject: practiceSet.subject_id,
        difficulty: practiceSet.difficulty_level || practiceSet.difficulty_mode,
        subtopics: practiceSet.subtopics,
        totalQuestions: questions?.length || 0,
        dateGenerated: new Date().toISOString(),
        questions: questions?.map((q) => ({
          ...q,
          studentAnswer: includeAnswers ? studentAnswers[q.id] : null,
        })) || [],
        includeAnswers,
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid content type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the download for audit
    console.log(`PDF generated successfully: contentType=${contentType}, contentId=${contentId}, studentId=${user.id}, includeAnswers=${includeAnswers}`);

    // Return the PDF data for client-side generation
    return new Response(
      JSON.stringify({
        success: true,
        pdfData,
        metadata: {
          title,
          subject,
          studentId: user.id,
          contentType,
          contentId,
          includeAnswers,
          generatedAt: new Date().toISOString(),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
