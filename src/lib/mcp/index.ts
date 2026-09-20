import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSubjectsTool from "./tools/list-subjects";
import listExamsTool from "./tools/list-exams";
import listPracticeSetsTool from "./tools/list-practice-sets";
import listExamResultsTool from "./tools/list-exam-results";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "revise-ai-buddy",
  title: "revise-ai-buddy",
  version: "0.1.0",
  instructions:
    "Read-only tools for Examly, an AI revision app. Use `list_subjects` for the signed-in user's subjects, `list_exams` for their exam papers, `list_practice_sets` for their practice quizzes, and `list_exam_results` for their scored attempts. All tools act as the signed-in user only.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSubjectsTool, listExamsTool, listPracticeSetsTool, listExamResultsTool],
});
